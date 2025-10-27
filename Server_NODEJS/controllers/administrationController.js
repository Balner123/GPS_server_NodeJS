
const db = require('../database');

const getAdminPage = async (req, res) => {
    try {
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
        console.error("Error loading administration data:", err);
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
        await db.User.destroy({ where: { id: userId } });
        req.flash('success', 'User has been deleted successfully.');
        res.redirect('/administration');
    } catch (err) {
        console.error("Error deleting user and data:", err);
        req.flash('error', 'An error occurred while deleting the user.');
        res.redirect('/administration');
    }
};

const deleteDeviceAndData = async (req, res) => {
    const deviceId = req.params.deviceId;
    const t = await db.sequelize.transaction();

    try {
        const device = await db.Device.findOne({ where: { id: deviceId } });

        if (!device) {
            await t.rollback();
            req.flash('error', 'Device not found.');
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
        res.redirect('/administration');
    } catch (err) {
        await t.rollback();
        console.error(`Error deleting device ${deviceId}:`, err);
        req.flash('error', 'Failed to delete device. An internal server error occurred.');
        res.redirect('/administration');
    }
};

const verifyUser = async (req, res) => {
    const userId = req.params.userId;
    try {
        await db.User.update({ is_verified: true }, { where: { id: userId } });
        req.flash('success', 'User has been verified successfully.');
        res.redirect('/administration');
    } catch (err) {
        console.error("Error verifying user:", err);
        req.flash('error', 'An error occurred while verifying the user.');
        res.redirect('/administration');
    }
};

const deleteAlert = async (req, res) => {
    const alertId = req.params.alertId;
    try {
        await db.Alert.destroy({ where: { id: alertId } });
        req.flash('success', 'Alert has been deleted successfully.');
        res.redirect('/administration');
    } catch (err) {
        console.error("Error deleting alert:", err);
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
