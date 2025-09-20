const db = require('../database');

const getHomePage = async (req, res) => {
    try {
        const devices = await db.Device.findAll({ 
            where: { user_id: req.session.user.id }, 
            attributes: ['id'] 
        });
        const deviceIds = devices.map(d => d.id);

        const alerts = await db.Alert.findAll({
            where: {
                device_id: deviceIds,
                is_read: false
            },
            include: {
                model: db.Device,
                attributes: ['device_id', 'name']
            },
            order: [['created_at', 'DESC']]
        });

        res.render('index', {
            currentPage: 'index',
            user: req.session.user,
            alerts: alerts
        });
    } catch (error) {
        console.error("Error fetching data for homepage:", error);
        res.render('index', {
            currentPage: 'index',
            user: req.session.user,
            alerts: [],
            error: 'Could not load alert data.'
        });
    }
};

module.exports = {
  getHomePage
}; 