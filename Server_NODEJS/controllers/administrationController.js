
const { User, Device, Location, sequelize } = require('../database');

const getAdminPage = async (req, res) => {
    try {
        const users = await User.findAll({
            include: [{
                model: Device,
                as: 'devices' // Sequelize by měl toto nastavit automaticky, ale explicitnost neuškodí
            }],
            order: [['created_at', 'DESC']]
        });
        
        const devices = await Device.findAll({
            include: [
                { model: User, attributes: ['username'] },
                { model: Location, limit: 1, order: [['timestamp', 'DESC']] } // Jen poslední lokace pro přehled
            ],
            order: [['created_at', 'DESC']]
        });

        const locations = await Location.findAll({
            limit: 50, // Omezíme na posledních 50 záznamů, aby stránka nebyla přetížená
            order: [['timestamp', 'DESC']],
            include: [{
                model: Device,
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

// Smazání uživatele a všech jeho dat
const deleteUserAndData = async (req, res) => {
    const userId = req.params.userId;
    if (req.session.user && String(req.session.user.id) === String(userId)) {
        req.flash('error', 'Root cannot delete itself.');
        return res.redirect('/administration');
    }
    try {
        // Smažeme všechna zařízení uživatele a jejich data
        const devices = await Device.findAll({ where: { user_id: userId } });
        for (const device of devices) {
            await Location.destroy({ where: { device_id: device.device_id } });
            await device.destroy();
        }
        // Smažeme uživatele
        await User.destroy({ where: { id: userId } });
        res.redirect('/administration');
    } catch (err) {
        console.error("Error deleting user and data:", err);
        res.status(500).send("Chyba při mazání uživatele a jeho dat.");
    }
};

// Smazání zařízení a jeho dat
const deleteDeviceAndData = async (req, res) => {
    const deviceId = req.params.deviceId;
    try {
        await Location.destroy({ where: { device_id: deviceId } });
        await Device.destroy({ where: { device_id: deviceId } });
        res.redirect('/administration');
    } catch (err) {
        console.error("Error deleting device and data:", err);
        res.status(500).send("Chyba při mazání zařízení a jeho dat.");
    }
};

module.exports = {
    getAdminPage,
    deleteUserAndData,
    deleteDeviceAndData
};
