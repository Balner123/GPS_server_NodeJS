const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { isAuthenticated, isUser } = require('../middleware/authorization');

// API routes for updating user settings
router.post('/username', isAuthenticated, isUser, settingsController.updateUsername);
router.post('/password', isAuthenticated, isUser, settingsController.updatePassword);
router.post('/email', isAuthenticated, isUser, settingsController.updateEmail);
router.post('/delete-account', isAuthenticated, isUser, settingsController.deleteAccount);

module.exports = router;
