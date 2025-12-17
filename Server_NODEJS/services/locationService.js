const db = require('../database');
const geofenceService = require('./geofenceService');
const deviceService = require('./deviceService');
const logger = require('../utils/logger');
const { clusterLocations } = require('../utils/geoUtils');
const { generateGpx } = require('../utils/gpxGenerator');

class LocationService {
  /**
   * Processes a batch of location data points for a device.
   * Handles storage, device status updates, and geofence checking.
   * @param {object} device - The device instance.
   * @param {Array} dataPoints - Array of location data objects.
   * @param {string|null} clientType - The reported client type (APK/HW).
   * @param {string|null} powerStatus - The reported power status.
   * @returns {Promise<void>}
   */
  async processLocationData(device, dataPoints, clientType, powerStatus) {
    const log = logger.child({ service: 'LocationService', deviceId: device.device_id });
    
    const t = await db.sequelize.transaction();
    let lastLocation;

    try {
      const locationsToCreate = dataPoints.map(point => {
        if (point.latitude === undefined || point.longitude === undefined) {
            throw new Error('Each data point in the array must have latitude and longitude.');
        }
        return {
          device_id: device.id,
          user_id: device.user_id,
          latitude: point.latitude,
          longitude: point.longitude,
          speed: point.speed !== undefined ? point.speed : null,
          altitude: point.altitude !== undefined ? point.altitude : null,
          accuracy: point.accuracy !== undefined ? point.accuracy : null,
          satellites: point.satellites !== undefined ? point.satellites : null,
          timestamp: point.timestamp && new Date(point.timestamp).getTime() > 0 ? new Date(point.timestamp) : new Date() 
        };
      });

      if (locationsToCreate.length > 0) {
        await db.Location.bulkCreate(locationsToCreate, { transaction: t, validate: true });
        lastLocation = locationsToCreate[locationsToCreate.length - 1];
        log.info('Locations stored', { count: locationsToCreate.length });
      }

      // Update Device Status
      const now = new Date();
      device.last_seen = now;

      if (clientType && device.device_type !== clientType) {
        device.device_type = clientType;
      }

      if (powerStatus && device.power_status !== powerStatus) {
        device.power_status = powerStatus;
      }

      if (this.shouldClearPowerInstruction(device.power_instruction, device.power_status)) {
        device.power_instruction = 'NONE';
      }

      await device.save({ transaction: t });
      
      await t.commit();
      
      // Post-transaction: Check Geofence
      // We do this after commit so we don't hold the transaction open for email sending/etc
      if (lastLocation) {
        await geofenceService.checkGeofence(device, lastLocation);
      }

    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Retrieves the latest known coordinates for all devices of a user.
   * @param {number} userId 
   * @returns {Promise<Array>}
   */
  async getLatestCoordinates(userId) {
      const devices = await db.Device.findAll({
          where: { user_id: userId },
          include: [
              {
                  model: db.Location,
                  where: {
                      id: { [db.Sequelize.Op.in]: db.sequelize.literal(`(SELECT MAX(id) FROM locations GROUP BY device_id)`) }
                  },
                  required: true
              },
              {
                  model: db.Alert,
                  where: { is_read: false },
                  required: false
              }
          ]
      });

      return devices.map(d => {
          const latestLocation = d.Locations[0];
          return {
              device: d.device_id,
              name: d.name,
              longitude: latestLocation.longitude,
              latitude: latestLocation.latitude,
              timestamp: latestLocation.timestamp,
              has_unread_alerts: d.Alerts && d.Alerts.length > 0,
              power_status: d.power_status,
              power_instruction: d.power_instruction
          };
      });
  }

  /**
   * Retrieves historical location data for a device.
   * @param {string} deviceId 
   * @param {number} userId 
   * @param {boolean} clustered - Whether to apply clustering optimization.
   * @returns {Promise<Array>}
   */
  async getDeviceHistory(deviceId, userId, clustered = true) {
      const device = await db.Device.findOne({
          where: { device_id: deviceId, user_id: userId }
      });

      if (!device) throw new Error('DEVICE_NOT_FOUND');

      const rawLocations = await db.Location.findAll({
          where: { device_id: device.id },
          order: [['timestamp', 'ASC']]
      });

      if (clustered) {
          const DISTANCE_THRESHOLD_METERS = 25;
          return clusterLocations(rawLocations, DISTANCE_THRESHOLD_METERS);
      }
      return rawLocations;
  }

  /**
   * Generates GPX string for device history.
   * @param {string} deviceId 
   * @param {number} userId 
   * @returns {Promise<string>} GPX XML string
   */
  async getGpxData(deviceId, userId) {
    const device = await db.Device.findOne({
        where: { device_id: deviceId, user_id: userId }
    });

    if (!device) return null;

    const locations = await db.Location.findAll({
        where: { device_id: device.id },
        order: [['timestamp', 'ASC']]
    });

    if (locations.length === 0) return null;

    return generateGpx(device.name || device.device_id, locations);
  }

  shouldClearPowerInstruction(instruction, status) {
    if (!instruction || instruction === 'NONE' || !status) return false;
    const normInstruction = String(instruction).trim().toUpperCase();
    const normStatus = String(status).trim().toUpperCase();
    
    if (normInstruction === 'TURN_OFF' && normStatus === 'OFF') {
      return true;
    }
    return false;
  }
}

module.exports = new LocationService();
