const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/authorization');

router.get('/verify-email', authController.getVerifyEmailPage);
router.post('/verify-email', authController.verifyEmailCode);

// Here will be the routes for authentication
router.get('/login', authController.getLoginPage);
router.post('/login', authController.loginUser);
router.get('/register', authController.getRegisterPage);
router.post('/register', authController.registerUser);
router.get('/logout', isAuthenticated, authController.logoutUser);

module.exports = router;