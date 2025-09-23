const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { isAuthenticated } = require('../middleware/authorization');

// Route for rendering the device management page
router.get('/devices', isAuthenticated, deviceController.getDevicesPage);
/**
 * @swagger
 * /devices:
 *   get:
 *     summary: Retrieve the device management page
 *     description: This endpoint renders the device management page for authenticated users.
 *     tags:
 *       - Devices
 *     responses:
 *       200:
 *         description: Successfully retrieved the device management page.
 *       401:
 *         description: Unauthorized access.
 */
module.exports = router;
