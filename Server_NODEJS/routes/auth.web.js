const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Routes for rendering pages
router.get('/login', authController.getLoginPage);
router.get('/register', authController.getRegisterPage);
// router.get('/verify-email/:verificationCode', authController.verifyEmail); // This route is commented out as the controller function is missing and causes a server crash.

module.exports = router;
