const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Routes for rendering pages
router.get('/login', authController.getLoginPage);
router.get('/register', authController.getRegisterPage);

// Routes for email verification
router.get('/verify-email', authController.getVerifyEmailPage);
router.post('/verify-email', authController.verifyEmailCode);

// Route for resending verification code from the verification page
router.post('/resend-verification-from-page', authController.resendVerificationCodeFromPage);

// Route for web logout
router.get('/logout', authController.logoutUser);

module.exports = router;
