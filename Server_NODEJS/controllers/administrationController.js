
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

// Smazání uživatele a všech jeho dat
const deleteUserAndData = async (req, res) => {
    const userId = req.params.userId;
    if (req.session.user && String(req.session.user.id) === String(userId)) {
        req.flash('error', 'Root cannot delete itself.');
        return res.redirect('/administration');
    }
    try {
        // Sequelize je nakonfigurováno tak, že User má asociaci s Device.
        // Při smazání uživatele by se měla (pokud je tak nastaveno v modelu) kaskádově smazat i jeho zařízení.
        // A díky ON DELETE CASCADE u modelu Device se smažou i všechny jejich lokace.
        // Tímto jediným příkazem smažeme uživatele a všechna jeho související data.
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
        // Najdeme zařízení podle jeho unikátního device_id
        const device = await Device.findOne({ where: { device_id: deviceId } });

        if (device) {
            // Zavoláme destroy() na instanci modelu.
            // Díky nastavení 'ON DELETE CASCADE' v asociaci modelu
            // se automaticky smažou i všechny související záznamy v tabulce 'locations'.
            await device.destroy();
        }
        
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
