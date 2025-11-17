const db = require('../database');
const { getRequestLogger } = require('../utils/requestLogger');

const getHomePage = async (req, res) => {
    try {
        const log = getRequestLogger(req, { controller: 'index', action: 'getHomePage' });
        const devices = await db.Device.findAll({ 
            where: { user_id: req.session.user.id },
            attributes: ['id', 'name', 'device_id'], // Fetch device_id for linking
            order: [['created_at', 'DESC']],
            limit: 4
        });

        const deviceIds = devices.map(d => d.id);

        const { Op } = db.Sequelize;
        let alerts = [];
        if (deviceIds && deviceIds.length > 0) {
            alerts = await db.Alert.findAll({
                where: {
                    device_id: { [Op.in]: deviceIds },
                    is_read: false
                },
                include: {
                    model: db.Device,
                    attributes: ['device_id', 'name']
                },
                order: [['created_at', 'DESC']]
            });
        }

        // Determine which devices have unread alerts
        const deviceIdsWithUnreadAlerts = new Set(alerts.map(alert => alert.device_id));
        const devicesWithAlertStatus = devices.map(device => ({
            ...device.toJSON(), // Convert to plain object to add properties
            has_unread_alerts: deviceIdsWithUnreadAlerts.has(device.id)
        }));

        log.info('Homepage data loaded', { deviceCount: devices.length, alertCount: alerts.length });
        res.render('index', {
            currentPage: 'index',
            user: req.session.user,
            devices: devicesWithAlertStatus, // Pass the augmented devices array
            alerts: alerts,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (error) {
        const log = getRequestLogger(req, { controller: 'index', action: 'getHomePage' });
        log.error('Error fetching data for homepage', error);
        res.render('index', {
            currentPage: 'index',
            user: req.session.user,
            devices: [], // Pass empty array on error
            alerts: [],
            success: [], // Pass empty array for success flash
            error: ['Could not load page data.'] // Pass error as an array
        });
    }
};

module.exports = {
  getHomePage
};