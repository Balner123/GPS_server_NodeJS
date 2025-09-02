const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Routes for API logic
router.post('/login', authController.loginUser);
router.post('/register', authController.registerUser);
router.get('/logout', authController.logoutUser); // Can be POST for stricter REST, but GET is fine for web logout

module.exports = router;
