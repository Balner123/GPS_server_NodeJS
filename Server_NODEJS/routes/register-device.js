const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { isUser } = require('../middleware/authorization');

router.get(
  '/register-device',
  isUser,
  deviceController.getRegisterDevicePage
);

router.post(
  '/register-device',
  isUser,
  deviceController.addDeviceToUser
);

module.exports = router; 