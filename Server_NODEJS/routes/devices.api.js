const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { validateSettings, validateDeviceInputPayload } = require('../middleware/validators');
const { isAuthenticated, isUser, authenticateDevice, isNotRootApi } = require('../middleware/authorization');

/**
 * @swagger
 * tags:
 *   name: Devices API
 *   description: Managing devices and their data
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceInput:
 *       type: object
 *       required:
 *         - device
 *         - latitude
 *         - longitude
 *       properties:
 *         device:
 *           type: string
 *           description: The unique ID of the device.
 *           example: "AC12345678"
 *         name:
 *         speed:
 *           type: number
 *           format: float
 *           description: Speed in km/h.
 *           example: 50.5
 *         altitude:
 *           type: number
 *           format: float
 *           description: Altitude in meters.
 *           example: 200.1
 *         accuracy:
 *           type: number
 *           format: float
 *           description: Accuracy of the location (HDOP value).
 *           example: 1.2
 *         satellites:
 *           type: integer
 *           description: Number of satellites.
 *           example: 8
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: The UTC timestamp of the reading.
 *           example: "2025-09-08T12:34:56Z"
 *         error:
 *           type: string
 *           description: An error message if no GPS fix was obtained.
 *           example: "No GPS fix (External)"
 *         power_status:
 *           type: string
 *           description: Current power state reported by the device.
 *           enum: ["ON", "OFF"]
 *           example: "ON"
 *         power_instruction_ack:
 *           type: string
 *           description: Token acknowledging the last power instruction.
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         client_type:
 *           type: string
 *           description: Declared device type (APK/HW/etc.).
 *           example: "HW"
 *     DeviceSettingsUpdate:
 *        type: object
 *        required:
 *          - deviceId
 *          - interval_gps
 *          - interval_send
 *          - satellites
 *        properties:
 *          deviceId:
 *            type: string
 *            description: The ID of the device to update.
 *            example: "1"
 *          interval_gps:
 *            type: integer
 *            description: The new GPS interval in seconds.
 *            example: 60
 *          interval_send:
 *            type: integer
 *            description: The new send interval in seconds.
 *            example: 300
 *          satellites:
 *            type: integer
 *            description: The new number of satellites.
 *            example: 7
 *     DeviceRegister:
 *       type: object
 *       required:
 *         - client_type
 *         - device_id
 *       properties:
 *         client_type:
 *           type: string
 *           description: Declared device type (`HW`, `APK`, ...).
 *           example: "HW"
 *         device_id:
 *           type: string
 *           description: Unique device identifier.
 *           example: "AABBCCDDEEFF"
 *         name:
 *           type: string
 *           description: Optional friendly name.
 *           example: "testuser"
 *         password:
 *           type: string
 *           description: Required for HW registration.
 *           example: "Secret123!"
 *     DeviceHandshake:
 *       type: object
 *       required:
 *         - device_id
 *       properties:
 *         client_type:
 *           type: string
 *           description: Declared device type.
 *           example: "APK"
 *         device_id:
 *           type: string
 *           description: Unique device identifier.
 *           example: "AABBCCDDEEFF"
 *         power_status:
 *           type: string
 *           description: Current power state (`ON`/`OFF`).
 *           enum: ["ON", "OFF"]
 *           example: "ON"
 *         app_version:
 *           type: string
 *           description: Optional firmware/app version for diagnostics.
 *           example: "1.0.5"
 *         battery:
 *           type: number
 *           format: float
 *           description: Optional battery level or voltage.
 *           example: 4.07
 *         uptime:
 *           type: integer
 *           description: Optional uptime in seconds.
 *           example: 3600
 */

/**
 * @swagger
 * /api/devices/register:
 *   post:
 *     summary: Register a device (HW/APK) using a unified endpoint
 *     tags: [Devices API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceRegister'
 *     responses:
 *       '201':
 *         description: Device registered successfully.
 *       '200':
 *         description: Device already registered to the same account.
 *       '400':
 *         description: Bad request (missing fields, unsupported client type).
 *       '401':
 *         description: Unauthorized (invalid credentials / missing session).
 *       '409':
 *         description: Device already registered to another user.
 *       '500':
 *         description: Server error.
 */
router.post('/register', deviceController.registerDeviceUnified);

/**
 * @swagger
 * /api/devices/handshake:
 *   post:
 *     summary: Perform a configuration handshake with the server
 *     tags: [Devices API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceHandshake'
 *     responses:
 *       '200':
 *         description: Handshake successful.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 registered:
 *                   type: boolean
 *                   example: true
 *                 config:
 *                   type: object
 *                   properties:
 *                     interval_gps:
 *                       type: integer
 *                       example: 60
 *                     interval_send:
 *                       type: integer
 *                       example: 1
 *                     satellites:
 *                       type: integer
 *                       example: 7
 *                     mode:
 *                       type: string
 *                       example: "simple"
 *                 power_instruction:
 *                   type: string
 *                   example: "NONE"
 *       '500':
 *         description: Server error.
 */
router.post('/handshake', deviceController.handleDeviceHandshake);

/**
 * @swagger
 * /api/devices/input:
 *   post:
 *     summary: Receive location data from a GPS device
 *     tags: [Devices API]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceInput'
 *     responses:
 *       '200':
 *         description: Data received successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       '400':
 *         description: Bad request (e.g., invalid coordinates, missing 'id').
 *       '404':
 *         description: Device not found.
 *       '500':
 *         description: Server error.
 */
router.post('/input', authenticateDevice, validateDeviceInputPayload, deviceController.handleDeviceInput);

/**
 * @swagger
 * /api/devices/coordinates:
 *   get:
 *     summary: Get current coordinates for all of the user's devices
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: An array of device locations.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   device:
 *                     type: string
 *                     description: The hardware ID of the device.
 *                     example: "DEV123"
 *                   name:
 *                     type: string
 *                     example: "My Car"
 *                   latitude:
 *                     type: number
 *                     example: 50.08804
 *                   longitude:
 *                     type: number
 *                     example: 14.42076
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                   has_unread_alerts:
 *                     type: boolean
 *                     example: false
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Server error.
 */
router.get('/coordinates', isAuthenticated, deviceController.getCurrentCoordinates);

/**
 * @swagger
 * /api/devices/data:
 *   get:
 *     summary: Get historical location data for a specific device
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The hardware ID of the device (device_id).
 *     responses:
 *       '200':
 *         description: An array of location history points.
 *       '400':
 *         description: Bad request (missing device ID).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found or does not belong to the user.
 *       '500':
 *         description: Server error.
 */
router.get('/data', isAuthenticated, deviceController.getDeviceData);

router.get('/raw-data', isAuthenticated, deviceController.getRawDeviceData);

/**
 * @swagger
 * /api/devices/export/gpx/{deviceId}:
 *   get:
 *     summary: Export historical location data for a specific device as a GPX file
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         schema:
 *           type: string
 *         required: true
 *         description: The hardware ID of the device.
 *     responses:
 *       '200':
 *         description: A GPX file of the device's location history.
 *         content:
 *           application/gpx+xml:
 *             schema:
 *               type: string
 *               format: binary
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found or does not belong to the user.
 *       '500':
 *         description: Server error.
 */
router.get('/export/gpx/:deviceId', isAuthenticated, isUser, deviceController.exportDeviceDataAsGpx);

/**
 * @swagger
 * /api/devices/settings/{deviceId}:
 *   get:
 *     summary: Get settings for a specific device
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         schema:
 *           type: string
 *         required: true
 *         description: The hardware ID of the device.
 *     responses:
 *       '200':
 *         description: Device settings.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found or does not belong to the user.
 *       '500':
 *         description: Server error.
 */
router.get('/settings/:deviceId', isAuthenticated, isNotRootApi, deviceController.getDeviceSettings);

/**
 * @swagger
 * /api/devices/settings:
 *   post:
 *     summary: Update settings for a device
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DeviceSettingsUpdate'
 *     responses:
 *       '200':
 *         description: Settings updated successfully.
 *       '400':
 *         description: Bad request (invalid data).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found or does not belong to the user.
 *       '500':
 *         description: Server error.
 */
router.post('/settings', isAuthenticated, isNotRootApi, validateSettings, deviceController.updateDeviceSettings);

/**
 * @swagger
 * /api/devices/power-instruction:
 *   post:
 *     summary: Set or clear a power instruction for a device
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - power_instruction
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: Hardware ID of the device to control.
 *                 example: "ABC1234567"
 *               power_instruction:
 *                 type: string
 *                 description: Instruction to apply (`NONE`, `TURN_OFF`).
 *                 example: "TURN_OFF"
 *     responses:
 *       '200':
 *         description: Power instruction updated successfully.
 *       '400':
 *         description: Missing or unsupported input.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found or not owned by the user.
 *       '500':
 *         description: Server error.
 */
router.post('/power-instruction', isAuthenticated, isNotRootApi, deviceController.updatePowerInstruction);

/**
 * @swagger
 * /api/devices/name:
 *   post:
 *     summary: Update the name for a device
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - newName
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: The hardware ID of the device to update.
 *                 example: "AABBCCDDEEFF"
 *               newName:
 *                 type: string
 *                 description: The new desired name for the device.
 *                 example: "My Favorite Tracker"
 *     responses:
 *       '200':
 *         description: Device name updated successfully.
 *       '400':
 *         description: Bad request (e.g., missing fields, invalid name).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found or does not belong to the user.
 *       '500':
 *         description: Server error.
 */
router.post('/name', isAuthenticated, isNotRootApi, deviceController.updateDeviceName);

/**
 * @swagger
 * /api/devices/delete/{deviceId}:
 *   post:
 *     summary: Delete a specific device
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         schema:
 *           type: string
 *         required: true
 *         description: The hardware ID of the device to delete.
 *     responses:
 *       '200':
 *         description: Device deleted successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found or does not belong to the user.
 *       '500':
 *         description: Server error.
 */
router.post('/delete/:deviceId', isAuthenticated, isNotRootApi, deviceController.deleteDevice);

/**
 * @swagger
 * /api/devices/geofence:
 *   post:
 *     summary: Save or update a geofence for a device
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceId
 *               - geofence
 *             properties:
 *               deviceId:
 *                 type: string
 *                 description: The hardware ID of the device.
 *               geofence:
 *                 type: object
 *                 description: A GeoJSON object representing the geofence polygon or circle.
 *     responses:
 *       '200':
 *         description: Geofence saved successfully.
 *       '400':
 *         description: Bad request (e.g., missing fields).
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found.
 *       '500':
 *         description: Server error.
 */
router.post('/geofence', isAuthenticated, isNotRootApi, deviceController.updateGeofence);

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get all unread alerts for the current user
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       '200':
 *         description: An array of unread alert objects.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Server error.
 */
router.get('/alerts', isAuthenticated, deviceController.getUnreadAlerts);
router.get('/alerts/unread/:deviceId', isAuthenticated, deviceController.getUnreadAlertsForDevice);

/**
 * @swagger
 * /api/alerts/read:
 *   post:
 *     summary: Mark alerts as read
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alertIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: An array of alert IDs to mark as read.
 *     responses:
 *       '200':
 *         description: Alerts marked as read successfully.
 *       '400':
 *         description: Bad request.
 *       '401':
 *         description: Unauthorized.
 *       '500':
 *         description: Server error.
 */
router.post('/alerts/read', isAuthenticated, isNotRootApi, deviceController.markAlertsAsRead);

/**
 * @swagger
 * /api/alerts/read-all/{deviceId}:
 *   post:
 *     summary: Mark all unread alerts for a specific device as read
 *     tags: [Devices API]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: deviceId
 *         schema:
 *           type: string
 *         required: true
 *         description: The hardware ID of the device.
 *     responses:
 *       '200':
 *         description: Alerts marked as read successfully.
 *       '401':
 *         description: Unauthorized.
 *       '404':
 *         description: Device not found.
 *       '500':
 *         description: Server error.
 */
router.post('/alerts/read-all/:deviceId', isAuthenticated, isNotRootApi, deviceController.markDeviceAlertsAsRead);

module.exports = router;
