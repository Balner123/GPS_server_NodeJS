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
