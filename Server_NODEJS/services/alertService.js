const db = require('../database');
const { Op } = require('sequelize');

class AlertService {
    /**
     * Fetch unread alerts for a specific user.
     * @param {number} userId 
     * @returns {Promise<Array>} List of unread alerts
     */
    async getUnreadAlerts(userId) {
        // Get all device IDs for the user
        const devices = await db.Device.findAll({ 
            where: { user_id: userId }, 
            attributes: ['id'] 
        });
        
        const deviceIds = devices.map(d => d.id);
        
        if (deviceIds.length === 0) {
            return [];
        }

        return await db.Alert.findAll({
            where: {
                device_id: { [Op.in]: deviceIds },
                is_read: false
            },
            order: [['created_at', 'DESC']]
        });
    }

    /**
     * Mark specific alerts as read for a user.
     * @param {number} userId 
     * @param {Array<number>} alertIds 
     */
    async markAlertsAsRead(userId, alertIds) {
        if (!alertIds || alertIds.length === 0) return;
        const devices = await db.Device.findAll({ where: { user_id: userId }, attributes: ['id'] });
        const userDeviceIds = devices.map(d => d.id);

        await db.Alert.update(
            { is_read: true },
            {
                where: {
                    id: { [Op.in]: alertIds },
                    device_id: { [Op.in]: userDeviceIds }
                }
            }
        );
    }

    /**
     * Mark all alerts for a specific device as read.
     * @param {number} userId 
     * @param {string} deviceIdString 
     */
    async markDeviceAlertsAsRead(userId, deviceIdString) {
        const device = await db.Device.findOne({
            where: { device_id: deviceIdString, user_id: userId },
            attributes: ['id']
        });

        if (!device) {
            throw new Error('DEVICE_NOT_FOUND');
        }

        await db.Alert.update(
            { is_read: true },
            { where: { device_id: device.id, is_read: false } }
        );
    }

    /**
     * Get unread alerts for a specific device.
     * @param {number} userId 
     * @param {string} deviceIdString 
     */
    async getUnreadAlertsForDevice(userId, deviceIdString) {
        const device = await db.Device.findOne({
            where: { device_id: deviceIdString, user_id: userId },
            attributes: ['id']
        });

        if (!device) {
            throw new Error('DEVICE_NOT_FOUND');
        }

        return await db.Alert.findAll({
            where: {
                device_id: device.id,
                is_read: false
            },
            order: [['created_at', 'DESC']]
        });
    }

    /**
     * Get alerts log with pagination.
     * @param {number} userId 
     * @param {number} page 
     * @param {number} pageSize 
     */
    async getAlertsLog(userId, page = 1, pageSize = 100) {
        const devices = await db.Device.findAll({ 
            where: { user_id: userId }, 
            attributes: ['id'] 
        });
        
        const deviceIds = devices.map(d => d.id);
        
        if (deviceIds.length === 0) {
            return { count: 0, rows: [], totalPages: 0 };
        }

        const offset = (page - 1) * pageSize;
        const { count, rows } = await db.Alert.findAndCountAll({
            where: {
                device_id: { [Op.in]: deviceIds },
            },
            include: {
                model: db.Device,
                attributes: ['device_id', 'name']
            },
            order: [['created_at', 'DESC']],
            limit: pageSize,
            offset: offset
        });

        return {
            count,
            rows,
            totalPages: Math.ceil(count / pageSize)
        };
    }
}

module.exports = new AlertService();
