
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
        await User.destroy({ where: { id: userId } });
        res.redirect('/administration');
    } catch (err) {
        console.error("Error deleting user and data:", err);
        res.status(500).send("Error deleting user and data.");
    }
};

const deleteDeviceAndData = async (req, res) => {
    const deviceId = req.params.deviceId;
    try {
        const device = await Device.findOne({ where: { device_id: deviceId } });

        if (device) {
            await device.destroy();
        }
        
        res.redirect('/administration');
    } catch (err) {
        console.error("Error deleting device and data:", err);
        res.status(500).send("Error deleting device and data.");
    }
};

module.exports = {
    getAdminPage,
    deleteUserAndData,
    deleteDeviceAndData
};
