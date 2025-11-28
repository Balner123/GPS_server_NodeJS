const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

/**
 * @swagger
 * tags:
 *   name: Hardware API
 *   description: API endpoints for hardware device operations, like registration.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     HardwareRegister:
 *       type: object
 *       required:
 *         - username
 *         - password
 *         - deviceId
 *       properties:
 *         username:
 *           type: string
 *           description: The username of the account to register the device to.
 *           example: "testuser"
 *         password:
 *           type: string
 *           description: The password for the user's account.
 *           example: "Password123!"
 *         deviceId:
 *           type: string
 *           description: The unique hardware ID of the device.
 *           example: "AABBCCDDEEFF"
 *         name:
 *           type: string
 *           description: An optional, user-friendly name for the device.
 *           example: "My Car Tracker"
 */

/**
 * @swagger
 * /api/hw/register-device:
 *   post:
 *     summary: Register a hardware device to a user account.
 *     description: Called by the hardware from OTA mode. It authenticates the user and, if successful, registers the device to their account.
 *     tags: [Hardware API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/HardwareRegister'
 *     responses:
 *       '201':
 *         description: Device registered successfully.
 *       '200':
 *         description: Device was already registered to this account.
 *       '400':
 *         description: Bad request (e.g., missing required fields).
 *       '401':
 *         description: Unauthorized (invalid username or password).
 *       '409':
 *         description: Conflict (device is already registered to another user).
 *       '500':
 *         description: Server error.
 */
router.post('/register-device', deviceController.registerDeviceFromHardware);

/**
 * @swagger
 * /api/hw/handshake:
 *   post:
 *     summary: Device handshake
 *     tags: [Hardware API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceHandshake'
 *     responses:
 *       '200':
 *         description: Returns the same payload as /api/devices/handshake.
 */
router.post('/handshake', deviceController.handleDeviceHandshake);

module.exports = router;
