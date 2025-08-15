const express = require('express');
const router = express.Router();
const administrationController = require('../controllers/administrationController');
const { isRoot } = require('../middleware/authorization');

router.get(
  '/administration',
  isRoot,
  administrationController.getAdminPage
);

module.exports = router; 

// Smazání uživatele a všech jeho dat
router.post('/administration/delete-user/:userId', isRoot, administrationController.deleteUserAndData);

// Smazání zařízení a všech jeho dat
router.post('/administration/delete-device/:deviceId', isRoot, administrationController.deleteDeviceAndData);