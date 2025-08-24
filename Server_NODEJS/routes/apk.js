const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const deviceController = require('../controllers/deviceController');
const authorization = require('../middleware/authorization');

router.post('/login', authController.loginApk);
router.post('/logout', authController.logoutApk);
router.post('/register-device', authorization.isAuthenticated, deviceController.registerDeviceFromApk);

module.exports = router;
