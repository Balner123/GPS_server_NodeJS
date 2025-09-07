const express = require('express');
const router = express.Router();
const administrationController = require('../controllers/administrationController');
const { isAuthenticated, isRoot } = require('../middleware/authorization');

/**
 * @swagger
 * tags:
 *   name: Administration API
 *   description: Managing users and devices as an administrator
 */

/**
 * @swagger
 * /api/admin/delete-user/{userId}:
 *   post:
 *     summary: (Admin) Delete a user and all their associated data
 *     tags: [Administration API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The database ID of the user to delete.
 *     responses:
 *       '200':
 *         description: User and their data deleted successfully.
 *       '401':
 *         description: Unauthorized (user is not a root admin).
 *       '404':
 *         description: User not found.
 *       '500':
 *         description: Server error.
 */
router.post('/delete-user/:userId', isAuthenticated, isRoot, administrationController.deleteUserAndData);

/**
 * @swagger
 * /api/admin/delete-device/{deviceId}:
 *   post:
 *     summary: (Admin) Delete a device and all its associated data
 *     tags: [Administration API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The database ID of the device to delete.
 *     responses:
 *       '200':
 *         description: Device and its data deleted successfully.
 *       '401':
 *         description: Unauthorized (user is not a root admin).
 *       '404':
 *         description: Device not found.
 *       '500':
 *         description: Server error.
 */
router.post('/delete-device/:deviceId', isAuthenticated, isRoot, administrationController.deleteDeviceAndData);

module.exports = router;
