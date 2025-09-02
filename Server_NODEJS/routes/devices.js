const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { isUser } = require('../middleware/authorization');
const { validateCoordinates, validateSleepInterval, validateDeviceName } = require('../middleware/validators');

router.get(
    '/current_coordinates',
    isUser,
    deviceController.getCurrentCoordinates
);

router.get(
    '/device_data',
    isUser,
    deviceController.getDeviceData
);

router.get(
    '/devices',
    isUser,
    deviceController.getDevicesPage
);

router.post("/device_input", validateCoordinates, deviceController.handleDeviceInput);

router.post(
    '/devices/delete/:deviceId',
    isUser,
    deviceController.deleteDevice
);

router.get(
    '/device_settings/:device',
    isUser,
    deviceController.getDeviceSettings
);

router.post(
    '/device_settings',
    isUser,
    validateSleepInterval,
    deviceController.updateDeviceSettings
);

module.exports = router; 