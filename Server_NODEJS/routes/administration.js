const express = require('express');
const router = express.Router();
const administrationController = require('../controllers/administrationController');
const { isRoot } = require('../middleware/authorization');

router.get(
  '/administration',
  isRoot,
  administrationController.getAdminPage
);

module.exports = router; 