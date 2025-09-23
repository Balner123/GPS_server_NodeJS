const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { isAuthenticated } = require('../middleware/authorization');

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: Retrieve the settings page
 *     description: This endpoint retrieves the settings page for authenticated users.
 *     tags:
 *       - Settings
 *     responses:
 *       200:
 *         description: Successfully retrieved the settings page.
 *       401:
 *         description: Unauthorized access.
 */
router.get('/settings', isAuthenticated, settingsController.getSettingsPage);

module.exports = router;
