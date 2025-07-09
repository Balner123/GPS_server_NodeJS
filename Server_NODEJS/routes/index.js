const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const { isUser } = require('../middleware/authorization');

// Zajistíme, že na hlavní stránku má přístup pouze běžný uživatel
router.get('/', isUser, indexController.getHomePage);

module.exports = router; 