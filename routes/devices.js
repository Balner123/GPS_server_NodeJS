const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const deviceController = require('../controllers/deviceController');
const isAuthenticated = require('../middleware/isAuthenticated');

// Validation middleware
const validateCoordinates = [
  body('device').isString().trim().escape(),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('speed').optional().isFloat({ min: 0, max: 1000 }),
  body('altitude').optional().isFloat({ min: -1000, max: 10000 }),
  body('accuracy').optional().isFloat({ min: 0, max: 100 }),
  body('satellites').optional().isInt({ min: 0, max: 50 })
];

const validateSleepInterval = [
  body('device').isString().trim().escape(),
  body('sleep_interval').isInt({ min: 1, max: 3600 * 24 * 30 }).withMessage('Sleep interval must be a valid integer of seconds (min 1s, max 30 days).')
];

// Unprotected routes
router.get("/device_settings/:device", deviceController.getDeviceSettings);
router.post("/device_settings", validateSleepInterval, deviceController.updateDeviceSettings);
router.post("/device_input", validateCoordinates, deviceController.handleDeviceInput);

// Protected routes
router.get("/current_coordinates", isAuthenticated, deviceController.getCurrentCoordinates);
router.get("/device_data", isAuthenticated, deviceController.getDeviceData);
router.delete('/api/device/:deviceName', isAuthenticated, deviceController.deleteDevice);

module.exports = router; 