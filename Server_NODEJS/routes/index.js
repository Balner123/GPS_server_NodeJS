const express = require('express');
const router = express.Router();
const indexController = require('../controllers/indexController');
const { isUser } = require('../middleware/authorization');

/**
 * @swagger
 * /:
 *   get:
 *     summary: Retrieve the home page
 *     description: This endpoint returns the home page of the application.
 *     responses:
 *       200:
 *         description: Successfully retrieved the home page.
 *       401:
 *         description: Unauthorized access.
 */
router.get('/', isUser, indexController.getHomePage);

module.exports = router; 