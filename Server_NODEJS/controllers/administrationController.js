
const db = require('../database');

const getAdminPage = async (req, res) => {
    try {
        const users = await db.User.findAll({
            include: [{
                model: db.Device,
                as: 'devices'
            }],
            order: [['created_at', 'DESC']]
        });
        
        const devices = await db.Device.findAll({
            include: [
                { model: db.User, attributes: ['username'] },
                { model: db.Location, limit: 1, order: [['timestamp', 'DESC']] }
            ],
            order: [['created_at', 'DESC']]
        });

        const locations = await db.Location.findAll({
            limit: 50, // Omezíme na posledních 50 záznamů, aby stránka nebyla přetížená
            order: [['timestamp', 'DESC']],
            include: [{
                model: db.Device,
                attributes: ['device_id', 'name']
            }]
        });

        res.render('administration', {
            currentPage: 'administration',
            users,
            devices,
            locations
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
    } catch (err) {
        console.error("Error deleting user and data:", err);
        res.status(500).send("Error deleting user and data.");
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

module.exports = {
    getAdminPage,
    deleteUserAndData,
    deleteDeviceAndData
};
