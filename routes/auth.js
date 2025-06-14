const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Here will be the routes for authentication

router.get('/login', authController.getLoginPage);
router.post('/login', authController.loginUser);
router.get('/logout', authController.logoutUser);

module.exports = router; 