
const db = require('../database');
const { getRequestLogger } = require('../utils/requestLogger');
const adminService = require('../services/adminService');

const getAdminPage = async (req, res) => {
    try {
        const log = getRequestLogger(req, { controller: 'administration', action: 'getAdminPage' });
        const userSearch = req.query.userSearch || '';
        const deviceSearch = req.query.deviceSearch || '';
        const locationSearch = req.query.locationSearch || '';
        const alertSearch = req.query.alertSearch || '';

        const userSortBy = req.query.userSortBy || 'created_at';
        const userSortOrder = req.query.userSortOrder || 'DESC';
        const deviceSortBy = req.query.deviceSortBy || 'created_at';
        const deviceSortOrder = req.query.deviceSortOrder || 'DESC';
        const locationSortBy = req.query.locationSortBy || 'timestamp';
        const locationSortOrder = req.query.locationSortOrder || 'DESC';
        const alertSortBy = req.query.alertSortBy || 'created_at';
        const alertSortOrder = req.query.alertSortOrder || 'DESC';

        const users = await db.User.findAll({
            where: {
                username: { [db.Sequelize.Op.like]: `%${userSearch}%` }
            },
            include: [{
                model: db.Device,
                as: 'devices'
            }],
            order: [[userSortBy, userSortOrder]]
        });
        
        const devices = await db.Device.findAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { device_id: { [db.Sequelize.Op.like]: `%${deviceSearch}%` } },
                    { name: { [db.Sequelize.Op.like]: `%${deviceSearch}%` } }
                ]
            },
            include: [
                { model: db.User, attributes: ['username'] },
                { model: db.Location, limit: 1, order: [['timestamp', 'DESC']] }
            ],
            order: [[deviceSortBy, deviceSortOrder]]
        });

        const page = parseInt(req.query.page) || 1;
        const pageSize = 50; // Number of locations per page
        const offset = (page - 1) * pageSize;

        const { count, rows: locations } = await db.Location.findAndCountAll({
            where: {
                [db.Sequelize.Op.or]: [
                    { latitude: { [db.Sequelize.Op.like]: `%${locationSearch}%` } },
                    { longitude: { [db.Sequelize.Op.like]: `%${locationSearch}%` } }
                ]
            },
            offset: offset,
            limit: pageSize,
            order: [[locationSortBy, locationSortOrder]],
            include: [{
                model: db.Device,
                attributes: ['device_id', 'name']
            }]
        });

        const totalPages = Math.ceil(count / pageSize);

        const alertsPage = parseInt(req.query.alertsPage) || 1;
        const alertsPageSize = 50; // Number of alerts per page
        const alertsOffset = (alertsPage - 1) * alertsPageSize;

        const { count: alertsCount, rows: alerts } = await db.Alert.findAndCountAll({
            where: {
                message: { [db.Sequelize.Op.like]: `%${alertSearch}%` }
            },
            offset: alertsOffset,
            limit: alertsPageSize,
            order: [[alertSortBy, alertSortOrder]],
            include: [
                { model: db.Device, attributes: ['device_id', 'name'] },
                { model: db.User, attributes: ['username'] }
            ]
        });

        const alertsTotalPages = Math.ceil(alertsCount / alertsPageSize);

        log.info('Administration page data loaded', {
            userCount: users.length,
            deviceCount: devices.length,
            locationCount: locations.length,
            alertCount: alerts.length
        });

        res.render('administration', {
            currentPage: 'administration',
            users,
            devices,
            locations,
            locationsCurrentPage: page,
            locationsTotalPages: totalPages,
            alerts,
            alertsCurrentPage: alertsPage,
            alertsTotalPages: alertsTotalPages,
            userSearch, deviceSearch, locationSearch, alertSearch,
            userSortBy, userSortOrder, deviceSortBy, deviceSortOrder, locationSortBy, locationSortOrder, alertSortBy, alertSortOrder,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'getAdminPage' });
        log.error('Error loading administration data', err);
        res.status(500).send("Error loading administration data. Check server logs.");
    }
};

const deleteUserAndData = async (req, res) => {
    const userId = req.params.userId;
    if (req.session.user && String(req.session.user.id) === String(userId)) {
        req.flash('error', 'Root cannot delete itself.');
        return res.redirect('/administration');
    }
    try {
        await adminService.deleteUserAndData(userId);
        req.flash('success', 'User has been deleted successfully.');
        res.redirect('/administration');
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteUserAndData', targetUserId: userId });
        log.error('Error deleting user', err);
        req.flash('error', err.message === 'USER_NOT_FOUND' ? 'User not found.' : 'An error occurred.');
        res.redirect('/administration');
    }
};

const deleteDeviceAndData = async (req, res) => {
    const deviceId = req.params.deviceId;
    try {
        const { name } = await adminService.deleteDeviceAndData(deviceId);
        req.flash('success', `Device '${name}' and all its data have been deleted successfully.`);
        res.redirect('/administration');
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteDeviceAndData', deviceId });
        log.error('Error deleting device', err);
        req.flash('error', err.message === 'DEVICE_NOT_FOUND' ? 'Device not found.' : 'Failed to delete device.');
        res.redirect('/administration');
    }
};

const verifyUser = async (req, res) => {
    const userId = req.params.userId;
    try {
        await adminService.verifyUser(userId);
        req.flash('success', 'User has been verified successfully.');
        res.redirect('/administration');
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'verifyUser', targetUserId: userId });
        log.error('Error verifying user', err);
        req.flash('error', err.message === 'USER_NOT_FOUND' ? 'User not found.' : 'An error occurred.');
        res.redirect('/administration');
    }
};

const deleteAlert = async (req, res) => {
    const alertId = req.params.alertId;
    try {
        await adminService.deleteAlert(alertId, req.session.user);
        
        if (req.accepts('json')) {
            return res.status(200).json({ success: true, message: 'Alert deleted successfully.' });
        }
        req.flash('success', 'Alert has been deleted successfully.');
        res.redirect(req.headers.referer || '/administration');

    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteAlert', alertId });
        
        // Handle specific errors
        if (err.message === 'ALERT_NOT_FOUND') {
             if (req.accepts('json')) return res.status(404).json({ success: false, error: 'Alert not found.' });
             req.flash('error', 'Alert not found.');
             return res.redirect(req.headers.referer || '/administration');
        }
        if (err.message === 'FORBIDDEN') {
            if (req.accepts('json')) return res.status(403).json({ success: false, error: 'Permission denied.' });
            req.flash('error', 'You do not have permission to delete this alert.');
            return res.redirect(req.headers.referer || '/');
        }

        log.error('Error deleting alert', err);
        if (req.accepts('json')) {
            return res.status(500).json({ success: false, error: 'Internal server error.' });
        }
        req.flash('error', 'An error occurred while deleting the alert.');
        res.redirect(req.headers.referer || '/administration');
    }
};

module.exports = {
    getAdminPage,
    deleteUserAndData,
    deleteDeviceAndData,
    verifyUser,
    deleteAlert
};
