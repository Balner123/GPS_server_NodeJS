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
 *     description: Deletes a user and all of their associated devices and location data. The root user cannot delete themselves.
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
 *       '302':
 *         description: Redirects to the /administration page on success, or if the root user attempts to delete themselves.
 *       '401':
 *         description: Unauthorized (user is not a root admin). This is handled by the `isRoot` middleware.
 *       '500':
 *         description: Server error.
 */
router.post('/delete-user/:userId', isAuthenticated, isRoot, administrationController.deleteUserAndData);

/**
 * @swagger
 * /api/admin/delete-device/{deviceId}:
 *   post:
 *     summary: (Admin) Delete a device and all its associated data
 *     description: Deletes a device and all of its associated location data. This action is irreversible.
 *     tags: [Administration API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The database numeric ID (id) of the device to delete.
 *     responses:
 *       '302':
 *         description: Redirects to the /administration page on success. The redirect happens even if the device was not found.
 *       '401':
 *         description: Unauthorized (user is not a root admin). This is handled by the `isRoot` middleware.
 *       '500':
 *         description: Server error.
 */
router.post('/delete-device/:deviceId', isAuthenticated, isRoot, administrationController.deleteDeviceAndData);

module.exports = router;
