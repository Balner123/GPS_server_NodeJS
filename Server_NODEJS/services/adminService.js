const db = require('../database');
const logger = require('../utils/logger');

class AdminService {
    /**
     * Deletes a user and all their associated data (Devices, Locations, Alerts).
     * @param {number} userId - The ID of the user to delete.
     * @returns {Promise<void>}
     */
    async deleteUserAndData(userId) {
        const log = logger.child({ service: 'AdminService', action: 'deleteUserAndData', targetUserId: userId });
        
        const user = await db.User.findByPk(userId);
        if (!user) {
            throw new Error('USER_NOT_FOUND');
        }
        await db.User.destroy({ where: { id: userId } });
        log.info('User deleted');
    }

    /**
     * Deletes a device and all its associated data.
     * @param {number|string} deviceId - The ID (PK) of the device.
     * @returns {Promise<void>}
     */
    async deleteDeviceAndData(deviceId) {
        const log = logger.child({ service: 'AdminService', action: 'deleteDeviceAndData', deviceId });
        
        const t = await db.sequelize.transaction();
        try {
            const device = await db.Device.findOne({ where: { id: deviceId } });
            if (!device) {
                throw new Error('DEVICE_NOT_FOUND');
            }

            // Manual cleanup as per original controller logic
            await db.Location.destroy({ where: { device_id: device.id }, transaction: t });
            await db.Alert.destroy({ where: { device_id: device.id }, transaction: t });
            await device.destroy({ transaction: t });

            await t.commit();
            log.info('Device and associated data deleted');
            return { name: device.name || device.device_id };
        } catch (err) {
            await t.rollback();
            throw err;
        }
    }

    /**
     * Verifies a user.
     * @param {number} userId 
     * @returns {Promise<void>}
     */
    async verifyUser(userId) {
        const result = await db.User.update({ is_verified: true }, { where: { id: userId } });
        if (result[0] === 0) {
             throw new Error('USER_NOT_FOUND');
        }
    }

    /**
     * Deletes a specific alert.
     * @param {number} alertId 
     * @param {object} requestingUser - The user object from session (to check permissions).
     * @returns {Promise<void>}
     */
    async deleteAlert(alertId, requestingUser) {
        const alert = await db.Alert.findOne({ where: { id: alertId } });

        if (!alert) {
            throw new Error('ALERT_NOT_FOUND');
        }

        // Permission check
        if (!requestingUser.isRoot && alert.user_id !== requestingUser.id) {
            throw new Error('FORBIDDEN');
        }

        await alert.destroy();
    }
}

module.exports = new AdminService();
