const express = require('express');
const router = express.Router();
const administrationController = require('../controllers/administrationController');
const { isAuthenticated, isRoot } = require('../middleware/authorization');

// Route for rendering the administration page
router.get('/administration', isAuthenticated, isRoot, administrationController.getAdminPage);
/**
 * @swagger
 * /administration:
 *   get:
 *     summary: Retrieve the administration page
 *     description: This endpoint renders the administration page. Access is restricted to authenticated users with root privileges.
 *     tags:
 *       - Administration
 *     responses:
 *       200:
 *         description: Successfully retrieved the administration page.
 *       401:
 *         description: Unauthorized access.
 *       403:
 *         description: Forbidden access.
 */
module.exports = router;
