const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { validateCoordinates, validateSleepInterval } = require('../middleware/validators');
const { isAuthenticated, isUser } = require('../middleware/authorization');

// API routes for device data and actions
router.post('/input', validateCoordinates, deviceController.handleDeviceInput);
router.get('/coordinates', isAuthenticated, deviceController.getCurrentCoordinates);
router.get('/data', isAuthenticated, deviceController.getDeviceData);
router.get('/settings/:deviceId', isAuthenticated, isUser, deviceController.getDeviceSettings);
router.post('/settings', isAuthenticated, isUser, validateSleepInterval, deviceController.updateDeviceSettings);
router.post('/delete/:deviceId', isAuthenticated, isUser, deviceController.deleteDevice);

module.exports = router;
