const db = require('../database');
const bcrypt = require('bcryptjs');

class DeviceService {
  /**
   * Centralized logic to register a device for a user.
   * This method handles checking for existing devices and creating new ones.
   * @param {object} user - The user object for whom the device is being registered.
   * @param {string} deviceId - The unique identifier for the device.
   * @param {string} name - The desired name for the device.
   * @param {string} deviceType - The type of the device (e.g., 'APK', 'HW').
   * @returns {object} An object containing the registration status and the device object.
   * @throws {Error} If the device is already registered to another user.
   */
  async registerDeviceForUser({ user, deviceId, name, deviceType }) {
    if (!user || !user.id) {
      throw new Error('registerDeviceForUser requires a valid user with an id');
    }
    if (!deviceId) {
      throw new Error('registerDeviceForUser requires deviceId');
    }

    const normalizedDeviceType = deviceType || null;
    const existingDevice = await db.Device.findOne({ where: { device_id: deviceId } });

    if (existingDevice) {
      if (existingDevice.user_id === user.id) {
        return { status: 'already-owned', device: existingDevice };
      }
      return { status: 'conflict', device: existingDevice }; // Device registered to another user
    }

    const fallbackName = deviceId.length > 6 ? `Device ${deviceId.slice(0, 6)}` : `Device ${deviceId}`;
    const deviceName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : fallbackName;

    const device = await db.Device.create({
      device_id: deviceId,
      user_id: user.id,
      name: deviceName,
      device_type: normalizedDeviceType
    });

    return { status: 'created', device };
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

  /**
   * Deletes a device and its data for a specific user.
   * @param {string} deviceIdString - The hardware ID (device_id string).
   * @param {number} userId - The owner's ID.
   */
  async deleteDevice(deviceIdString, userId) {
      const t = await db.sequelize.transaction();
      try {
          const device = await db.Device.findOne({ 
              where: { 
                  device_id: deviceIdString,
                  user_id: userId
              } 
          });

          if (!device) {
              await t.rollback();
              throw new Error('DEVICE_NOT_FOUND');
          }

          // Manual cleanup
          await db.Location.destroy({ where: { device_id: device.id }, transaction: t });
          await db.Alert.destroy({ where: { device_id: device.id }, transaction: t });
          await device.destroy({ transaction: t });

          await t.commit();
      } catch (err) {
          await t.rollback();
          throw err;
      }
  }

  /**
   * Retrieves settings for a specific device.
   * @param {string} deviceId 
   * @param {number} userId 
   */
  async getSettings(deviceId, userId) {
      const device = await db.Device.findOne({ 
          where: { device_id: deviceId, user_id: userId } 
      });
      if (!device) throw new Error('DEVICE_NOT_FOUND');
      
      return {
          interval_gps: device.interval_gps,
          interval_send: device.interval_send,
          satellites: device.satellites,
          geofence: device.geofence,
          created_at: device.created_at,
          device_type: device.device_type,
          mode: device.mode,
          power_status: device.power_status,
          power_instruction: device.power_instruction
      };
  }

  /**
   * Updates settings for a device.
   * @param {string} deviceId 
   * @param {number} userId 
   * @param {object} settings - { interval_gps, interval_send, satellites, mode }
   */
  async updateSettings(deviceId, userId, settings) {
      const device = await db.Device.findOne({
          where: { device_id: deviceId, user_id: userId }
      });

      if (!device) throw new Error('DEVICE_NOT_FOUND');

      const nextIntervalGps = Number(settings.interval_gps);
      const nextIntervalSend = Number(settings.interval_send);
      const nextSatellites = Number(settings.satellites);
      const nextMode = settings.mode;

      const noChanges = (
          Number(device.interval_gps) === nextIntervalGps &&
          Number(device.interval_send) === nextIntervalSend &&
          Number(device.satellites) === nextSatellites &&
          device.mode === nextMode
      );

      if (noChanges) return { updated: false };

      await db.Device.update(
          { 
              interval_gps: nextIntervalGps, 
              interval_send: nextIntervalSend, 
              satellites: nextSatellites, 
              mode: nextMode 
          },
          { where: { id: device.id } }
      );

      return { updated: true };
  }

  /**
   * Builds the configuration payload sent to the device during handshake.
   * @param {object} device 
   */
  buildDeviceConfigPayload(device) {
    return {
      interval_gps: Number(device.interval_gps),
      interval_send: Number(device.interval_send),
      satellites: Number(device.satellites),
      mode: device.mode
    };
  }

  normalizePowerStatus(status) {
    if (!status) return null;
    const normalized = String(status).trim().toUpperCase();
    return (normalized === 'ON' || normalized === 'OFF') ? normalized : null;
  }

  normalizeClientType(clientType) {
    if (!clientType) return null;
    return String(clientType).trim().toUpperCase();
  }

  normalizePowerInstruction(instruction) {
    if (!instruction) return null;
    const normalized = String(instruction).trim().toUpperCase();
    return (normalized === 'NONE' || normalized === 'TURN_OFF') ? normalized : null;
  }

  /**
   * Fetches devices for the dashboard (limit 4).
   * @param {number} userId 
   */
  async getDashboardDevices(userId) {
      return await db.Device.findAll({ 
          where: { user_id: userId },
          attributes: ['id', 'name', 'device_id', 'last_seen'], 
          order: [['created_at', 'DESC']],
          limit: 4
      });
  }

  async isDeviceRegistered(userId, deviceId) {
      const device = await db.Device.findOne({
          where: {
              user_id: userId,
              device_id: deviceId
          }
      });
      return !!device;
  }
}

module.exports = new DeviceService();
