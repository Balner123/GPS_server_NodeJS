const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const isAuthenticated = require('../middleware/isAuthenticated');

router.get(
  '/settings',
  isAuthenticated,
  settingsController.getSettingsPage
);

router.post(
  '/settings/change-password',
  isAuthenticated,
  settingsController.passwordValidationRules,
  settingsController.changePassword
);

module.exports = router; 