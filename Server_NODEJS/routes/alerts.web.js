const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authorization');
const alertsController = require('../controllers/alertsController');

// Web routes
router.get('/alerts', isAuthenticated, alertsController.getAlertsLogPage);

module.exports = router;
