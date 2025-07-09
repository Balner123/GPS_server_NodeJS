const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { isUser } = require('../middleware/authorization');

router.get(
  '/settings',
  isUser,
  settingsController.getSettingsPage
);

router.post(
  '/settings/username',
  isUser,
  settingsController.updateUsername
);

router.post(
  '/settings/password',
  isUser,
  settingsController.updatePassword
);

router.post(
  '/settings/delete',
  isUser,
  settingsController.deleteAccount
);

module.exports = router; 