const express = require('express');
const router = express.Router();
const administrationController = require('../controllers/administrationController');
const { isAuthenticated, isRoot } = require('../middleware/authorization');

// Route for rendering the administration page
router.get('/administration', isAuthenticated, isRoot, administrationController.getAdminPage);

module.exports = router;
