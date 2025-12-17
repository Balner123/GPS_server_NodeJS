const { getRequestLogger } = require('../utils/requestLogger');
const deviceService = require('../services/deviceService');
const alertService = require('../services/alertService');

const getHomePage = async (req, res) => {
    try {
        const log = getRequestLogger(req, { controller: 'index', action: 'getHomePage' });
        
        const devices = await deviceService.getDashboardDevices(req.session.user.id);
        const alerts = await alertService.getUnreadAlerts(req.session.user.id);

        // Determine which devices have unread alerts
        const deviceIdsWithUnreadAlerts = new Set(alerts.map(alert => alert.device_id));
        const devicesWithAlertStatus = devices.map(device => ({
            ...device.toJSON(),
            has_unread_alerts: deviceIdsWithUnreadAlerts.has(device.id)
        }));

        log.info('Homepage data loaded', { deviceCount: devices.length, alertCount: alerts.length });
        res.render('index', {
            currentPage: 'index',
            user: req.session.user,
            devices: devicesWithAlertStatus,
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
            devices: [],
            alerts: [],
            success: [],
            error: ['Could not load page data.']
        });
    }
};

module.exports = {
  getHomePage
};