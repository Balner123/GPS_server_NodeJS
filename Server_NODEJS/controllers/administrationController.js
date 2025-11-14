
const db = require('../database');
const { getRequestLogger } = require('../utils/requestLogger');

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
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteUserAndData', targetUserId: userId });
        await db.User.destroy({ where: { id: userId } });
        req.flash('success', 'User has been deleted successfully.');
        log.info('User deleted from administration');
        res.redirect('/administration');
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteUserAndData', targetUserId: userId });
        log.error('Error deleting user and data', err);
        req.flash('error', 'An error occurred while deleting the user.');
        res.redirect('/administration');
    }
};

const deleteDeviceAndData = async (req, res) => {
    const deviceId = req.params.deviceId;
    const t = await db.sequelize.transaction();

    try {
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteDeviceAndData', deviceId });
        const device = await db.Device.findOne({ where: { id: deviceId } });

        if (!device) {
            await t.rollback();
            req.flash('error', 'Device not found.');
            log.warn('Attempted to delete missing admin device');
            return res.redirect('/administration');
        }

        // 1. Manually delete associated locations
        await db.Location.destroy({ where: { device_id: device.id }, transaction: t });

        // 2. Manually delete associated alerts
        await db.Alert.destroy({ where: { device_id: device.id }, transaction: t });

        // 3. Finally, delete the device itself
        await device.destroy({ transaction: t });

        await t.commit();
        req.flash('success', `Device '${device.name || device.device_id}' and all its data have been deleted successfully.`);
        log.info('Device deleted from admin panel');
        res.redirect('/administration');
    } catch (err) {
        await t.rollback();
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteDeviceAndData', deviceId });
        log.error('Error deleting device from administration', err);
        req.flash('error', 'Failed to delete device. An internal server error occurred.');
        res.redirect('/administration');
    }
};

const verifyUser = async (req, res) => {
    const userId = req.params.userId;
    try {
        const log = getRequestLogger(req, { controller: 'administration', action: 'verifyUser', targetUserId: userId });
        await db.User.update({ is_verified: true }, { where: { id: userId } });
        req.flash('success', 'User has been verified successfully.');
        log.info('User verified via admin');
        res.redirect('/administration');
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'verifyUser', targetUserId: userId });
        log.error('Error verifying user in admin', err);
        req.flash('error', 'An error occurred while verifying the user.');
        res.redirect('/administration');
    }
};

const deleteAlert = async (req, res) => {
    const alertId = req.params.alertId;
    try {
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteAlert', alertId });
        await db.Alert.destroy({ where: { id: alertId } });
        req.flash('success', 'Alert has been deleted successfully.');
        log.info('Alert deleted from admin');
        res.redirect('/administration');
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'administration', action: 'deleteAlert', alertId });
        log.error('Error deleting alert in admin', err);
        req.flash('error', 'An error occurred while deleting the alert.');
        res.redirect('/administration');
    }
};

module.exports = {
    getAdminPage,
    deleteUserAndData,
    deleteDeviceAndData,
    verifyUser,
    deleteAlert
};
