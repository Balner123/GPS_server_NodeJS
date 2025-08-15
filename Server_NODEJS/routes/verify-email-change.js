const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/authorization');

router.get('/verify-email-change', authController.getVerifyEmailChangePage);
router.post('/verify-email-change', authController.verifyEmailChangeCode);

module.exports = router;
