const express = require('express');
const router = express.Router();
const administrationController = require('../controllers/administrationController');
const { isAuthenticated, isRoot } = require('../middleware/authorization');

// API routes for admin actions
router.post('/delete-user/:userId', isAuthenticated, isRoot, administrationController.deleteUserAndData);
router.post('/delete-device/:deviceId', isAuthenticated, isRoot, administrationController.deleteDeviceAndData);

module.exports = router;
