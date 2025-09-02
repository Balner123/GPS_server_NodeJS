const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { isAuthenticated } = require('../middleware/authorization');

// Route for rendering the settings page
router.get('/settings', isAuthenticated, settingsController.getSettingsPage);

module.exports = router;
