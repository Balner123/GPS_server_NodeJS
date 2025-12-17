const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/authorization');
const alertsController = require('../controllers/alertsController');


/** * @swagger
 * tags:
 *   name: Alerts
 *   description: Alerts log page access
 */

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: Get the alerts log page
 *     tags: [Alerts]
 *     responses:
 *       200:
 *         description: Alerts log page retrieved successfully.
 *       401:
 *         description: Unauthorized access.
 * 
 */

// Web routes
router.get('/alerts', isAuthenticated, alertsController.getAlertsLogPage);

module.exports = router;
