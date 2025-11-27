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
