const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const deviceController = require('../controllers/deviceController');
const authorization = require('../middleware/authorization');

/**
 * @swagger
 * tags:
 *   name: APK API
 *   description: API endpoints specifically for the Android APK client
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ApkLogin:
 *       type: object
 *       required:
 *         - identifier
 *         - password
 *         - installationId
 *       properties:
 *         identifier:
 *           type: string
 *           description: The user's username or email.
 *           example: "testuser"
 *         password:
 *           type: string
 *           description: The user's password.
 *           example: "Password123!"
 *         installationId:
 *           type: string
 *           description: A unique ID for the app installation.
 *           example: "apk-install-uuid-12345"
 *     ApkRegisterDevice:
 *       type: object
 *       required:
 *         - deviceId
 *         - name
 *       properties:
 *         deviceId:
 *           type: string
 *           description: The unique hardware ID of the device.
 *           example: "DEV12345"
 *         name:
 *           type: string
 *           description: A user-friendly name for the device.
 *           example: "My Android Phone"
 */

/**
 * @swagger
 * /api/apk/login:
 *   post:
 *     summary: (APK) Log in a user for the APK client
 *     tags: [APK API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApkLogin'
 *     responses:
 *       '200':
 *         description: Login successful. Returns whether the device is already registered for the user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 device_is_registered:
 *                   type: boolean
 *                   example: false
 *       '400':
 *         description: Bad request (e.g., missing fields).
 *       '401':
 *         description: Unauthorized (invalid credentials).
 *       '500':
 *         description: Server error.
 */
router.post('/login', authController.loginApk);

/**
 * @swagger
 * /api/apk/logout:
 *   post:
 *     summary: (APK) Log out the user for the APK client
 *     tags: [APK API]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: Logout successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Odhlášení úspěšné."
 *       '500':
 *         description: Server error during logout.
 */
router.post('/logout', authController.logoutApk);

/**
 * @swagger
 * /api/apk/register-device:
 *   post:
 *     summary: (APK) Register a new device from the APK client
 *     tags: [APK API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApkRegisterDevice'
 *     responses:
 *       '201':
 *         description: Device registered successfully.
 *       '400':
 *         description: Bad request (e.g., missing fields).
 *       '409':
 *         description: Conflict (device with this ID already exists).
 *       '500':
 *         description: Server error.
 */
router.post('/register-device', authorization.isApiAuthenticated, deviceController.registerDeviceFromApk);

module.exports = router;
