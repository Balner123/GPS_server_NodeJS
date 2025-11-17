const db = require('../database');
const { getRequestLogger } = require('../utils/requestLogger');

const getAlertsLogPage = async (req, res) => {
    try {
        const log = getRequestLogger(req, { controller: 'alerts', action: 'getAlertsLogPage' });
            const devices = await db.Device.findAll({ 
                where: { user_id: req.session.user.id },
                attributes: ['id']
            });

            const deviceIds = devices.map(d => d.id);

            // If user has no devices, return empty list early to avoid SQL errors
            if (!deviceIds || deviceIds.length === 0) {
                log.info('No devices for user, returning empty alerts list');
                return res.render('alert-log', {
                    currentPage: 'alerts',
                    user: req.session.user,
                    alerts: [],
                    success: req.flash('success'),
                    error: req.flash('error')
                });
            }

            const { Op } = db.Sequelize;
            // Pagination support for alerts log
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 100;
            const offset = (page - 1) * pageSize;

            const { count, rows: alerts } = await db.Alert.findAndCountAll({
                where: {
                    device_id: { [Op.in]: deviceIds },
                },
                include: {
                    model: db.Device,
                    attributes: ['device_id', 'name']
                },
                order: [['created_at', 'DESC']],
                limit: pageSize,
                offset: offset
            });

            const totalPages = Math.ceil(count / pageSize);

        log.info('Alerts log page data loaded', { alertCount: alerts.length, page, pageSize });
        res.render('alert-log', {
            currentPage: 'alerts',
            user: req.session.user,
            alerts: alerts,
            alertsCurrentPage: page,
            alertsTotalPages: totalPages,
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (error) {
        const log = getRequestLogger(req, { controller: 'alerts', action: 'getAlertsLogPage' });
        log.error('Error fetching data for alerts log page', error);
        res.render('alert-log', {
            currentPage: 'alerts',
            user: req.session.user,
            alerts: [],
            success: [],
            error: ['Could not load page data.']
        });
    }
};

module.exports = {
    getAlertsLogPage
};
