const { getRequestLogger } = require('../utils/requestLogger');
const alertService = require('../services/alertService');

const getAlertsLogPage = async (req, res) => {
    try {
        const log = getRequestLogger(req, { controller: 'alerts', action: 'getAlertsLogPage' });
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 100;

        const { rows: alerts, totalPages } = await alertService.getAlertsLog(req.session.user.id, page, pageSize);

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
