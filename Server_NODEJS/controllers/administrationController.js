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

module.exports = {
    getAdminPage
}; 