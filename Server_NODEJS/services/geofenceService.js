const db = require('../database');
const { isPointInPolygon, isPointInCircle } = require('../utils/geoUtils');
const { sendGeofenceAlertEmail, sendGeofenceReturnEmail } = require('../utils/emailSender');
const logger = require('../utils/logger');

class GeofenceService {
  /**
   * Checks if a device has entered or exited its geofence and triggers alerts if necessary.
   * @param {object} device - The device instance (Sequelize model).
   * @param {object} location - The latest location object.
   */
  async checkGeofence(device, location) {
    if (!device.geofence) {
      return;
    }

    const geofenceLogger = logger.child({
      service: 'GeofenceService',
      deviceId: device.device_id,
      userId: device.user_id
    });

    const geofence = device.geofence;
    let isInside = false;

    if (geofence.type === 'circle') {
      const circle = { center: [geofence.lng, geofence.lat], radius: geofence.radius };
      isInside = isPointInCircle(location, circle);
    } else if (geofence.type === 'Feature') { // GeoJSON for polygon
      isInside = isPointInPolygon(location, geofence.geometry.coordinates[0]);
    }

    const user = await device.getUser();

    // Case 1: Device is OUTSIDE and alert is NOT active yet
    if (!isInside && !device.geofence_alert_active) {
      geofenceLogger.warn('Device left geofence');
      device.geofence_alert_active = true;
      await device.save(); // Save the new alert state

      await this.createAlertRecord(device, 'geofence', `Device '${device.name || device.device_id}' has left the defined geofence area.`);
      
      if (user && user.email) {
        await sendGeofenceAlertEmail(user.email, device, location);
      }
    }
    // Case 2: Device is INSIDE and alert IS active (returned)
    else if (isInside && device.geofence_alert_active) {
      geofenceLogger.info('Device returned to geofence');
      device.geofence_alert_active = false;
      await device.save(); // Save the new alert state
      
      await this.createAlertRecord(device, 'geofence_return', `Device '${device.name || device.device_id}' has returned to the defined geofence area.`);
      
      if (user && user.email) {
        await sendGeofenceReturnEmail(user.email, device, location);
      }
    }
  }

  /**
   * Internal helper to create an alert record in the database.
   */
  async createAlertRecord(device, type, message) {
    try {
      await db.Alert.create({
        device_id: device.id,
        user_id: device.user_id,
        type: type,
        message: message
      });
    } catch (error) {
      logger.error('Failed to create geofence alert record', error);
    }
  }
}

module.exports = new GeofenceService();
