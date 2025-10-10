const db = require('../database');

const getHomePage = async (req, res) => {
    try {
        const devices = await db.Device.findAll({ 
            where: { user_id: req.session.user.id },
            attributes: ['id', 'name'] // Fetch attributes needed by the template
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
            devices: devices, // Pass the full devices array
            alerts: alerts,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (error) {
        console.error("Error fetching data for homepage:", error);
        res.render('index', {
            currentPage: 'index',
            user: req.session.user,
            devices: [], // Pass empty array on error
            alerts: [],
            success: [], // Pass empty array for success flash
            error: ['Could not load page data.'] // Pass error as an array
        });
    }
};

module.exports = {
  getHomePage
};