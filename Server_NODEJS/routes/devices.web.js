const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { isAuthenticated } = require('../middleware/authorization');

// Route for rendering the device management page
router.get('/devices', isAuthenticated, deviceController.getDevicesPage);

module.exports = router;
