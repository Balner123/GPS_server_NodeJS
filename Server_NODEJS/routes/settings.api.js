const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { isAuthenticated, isUser } = require('../middleware/authorization');

/**
 * @swagger
 * tags:
 *   name: Settings API
 *   description: Managing user account settings
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UpdateUsername:
 *       type: object
 *       required:
 *         - newUsername
 *       properties:
 *         newUsername:
 *           type: string
 *           description: The new desired username.
 *           example: "myNewUsername"
 *     UpdatePassword:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *         - confirmNewPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *           description: The user's current password.
 *         newPassword:
 *           type: string
 *           description: The new password.
 *         confirmNewPassword:
 *           type: string
 *           description: Confirmation of the new password.
 *     UpdateEmail:
 *       type: object
 *       required:
 *         - newEmail
 *         - password
 *       properties:
 *         newEmail:
 *           type: string
 *           format: email
 *           description: The new desired email address.
 *           example: "new.email@example.com"
 *         password:
 *           type: string
 *           description: The user's current password to confirm the change.
 *     DeleteAccount:
 *       type: object
 *       required:
 *         - password
 *       properties:
 *         password:
 *           type: string
 *           description: The user's current password to confirm account deletion.
 */

/**
 * @swagger
 * /api/settings/username:
 *   post:
 *     summary: Update the username for the logged-in user
 *     tags: [Settings API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUsername'
 *     responses:
 *       '200':
 *         description: Username updated successfully.
 *       '400':
 *         description: Bad request (e.g., username already exists).
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Server error.
 */
router.post('/username', isAuthenticated, isUser, settingsController.updateUsername);

/**
 * @swagger
 * /api/settings/password:
 *   post:
 *     summary: Update the password for the logged-in user
 *     tags: [Settings API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePassword'
 *     responses:
 *       '200':
 *         description: Password updated successfully.
 *       '400':
 *         description: Bad request (e.g., passwords don't match, current password is wrong).
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Server error.
 */
router.post('/password', isAuthenticated, isUser, settingsController.updatePassword);

/**
 * @swagger
 * /api/settings/email:
 *   post:
 *     summary: Initiate an email change for the logged-in user
 *     tags: [Settings API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateEmail'
 *     responses:
 *       '200':
 *         description: Email change initiated. A verification code has been sent to the new email address.
 *       '400':
 *         description: Bad request (e.g., email already in use, incorrect password).
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Server error.
 */
router.post('/email', isAuthenticated, isUser, settingsController.updateEmail);

/**
 * @swagger
 * /api/settings/delete-account:
 *   post:
 *     summary: Delete the account of the logged-in user
 *     tags: [Settings API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeleteAccount'
 *     responses:
 *       '200':
 *         description: Account deleted successfully. User is logged out and redirected.
 *       '400':
 *         description: Bad request (e.g., incorrect password).
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Server error.
 */
router.post('/delete-account', isAuthenticated, isUser, settingsController.deleteAccount);

/**
 * @swagger
 * /api/settings/set-password:
 *   post:
 *     summary: Set the initial password for a user registered via a third-party provider
 *     tags: [Settings API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Password set successfully.
 *       '400':
 *         description: Bad request (e.g., passwords don't match, user not eligible).
 *       '401':
 *         description: Unauthorized.
 */
router.post('/set-password', isAuthenticated, isUser, settingsController.setPassword);
router.post('/disconnect', isAuthenticated, isUser, settingsController.disconnect);
router.post('/confirm-delete', isAuthenticated, isUser, settingsController.confirmDeleteAccount);
router.post('/resend-deletion-code', isAuthenticated, isUser, settingsController.resendDeletionCode);

/**
 * @swagger
 * /api/settings/cancel-delete:
 *   post:
 *     summary: Cancel a pending account deletion
 *     tags: [Settings API]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '302':
 *         description: Redirects to the /settings page after cancellation.
 *       '401':
 *         description: Unauthorized.
 */
router.post('/cancel-delete', isAuthenticated, isUser, settingsController.cancelDeleteAccount);

module.exports = router;
