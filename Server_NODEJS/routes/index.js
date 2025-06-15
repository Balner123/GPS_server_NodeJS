const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const isAuthenticated = require('../middleware/isAuthenticated');

router.get('/', isAuthenticated, indexController.getIndexPage);
router.get('/device', isAuthenticated, indexController.getDevicePage);

module.exports = router; 