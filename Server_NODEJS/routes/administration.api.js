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
 * /api/admin/users/{userId}:
 *   delete:
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
 *       '302':
 *         description: Redirects to /administration (legacy behavior).
 *       '401':
 *         description: Unauthorized.
 */
router.delete('/users/:userId', isAuthenticated, isRoot, administrationController.deleteUserAndData);

// Legacy POST wrapper
router.post('/delete-user/:userId', isAuthenticated, isRoot, administrationController.deleteUserAndData);

/**
 * @swagger
 * /api/admin/devices/{deviceId}:
 *   delete:
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
 *       '302':
 *         description: Redirects to /administration (legacy behavior).
 *       '401':
 *         description: Unauthorized.
 */
router.delete('/devices/:deviceId', isAuthenticated, isRoot, administrationController.deleteDeviceAndData);

// Legacy POST wrapper
router.post('/delete-device/:deviceId', isAuthenticated, isRoot, administrationController.deleteDeviceAndData);

/**
 * @swagger
 * /api/admin/verify-user/{userId}:
 *   post:
 *     summary: (Admin) Verify a user manually
 *     tags: [Administration API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the user to verify.
 *     responses:
 *       '200':
 *         description: User verified successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: User not found.
 *       '500':
 *         description: Server error.
 */
router.post('/verify-user/:userId', isAuthenticated, isRoot, administrationController.verifyUser);

/**
 * @swagger
 * /api/admin/alerts/{alertId}:
 *   delete:
 *     summary: (Admin) Delete a specific system alert
 *     tags: [Administration API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the alert to delete.
 *     responses:
 *       '200':
 *         description: Alert deleted successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Alert not found.
 *       '500':
 *         description: Server error.
 */
router.delete('/alerts/:alertId', isAuthenticated, isRoot, administrationController.deleteAlert);

/**
 * @swagger
 * /api/admin/delete-alert/{alertId}:
 *   post:
 *     summary: (Admin) Delete a specific system alert (Alternative Method)
 *     description: Useful for clients (like HTML forms) that cannot issue DELETE requests.
 *     tags: [Administration API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         schema:
 *           type: integer
 *         required: true
 *         description: The ID of the alert to delete.
 *     responses:
 *       '200':
 *         description: Alert deleted successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Alert not found.
 *       '500':
 *         description: Server error.
 */
router.post('/delete-alert/:alertId', isAuthenticated, isRoot, administrationController.deleteAlert);

module.exports = router;
