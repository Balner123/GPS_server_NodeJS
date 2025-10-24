const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { validateCoordinates, validateSettings } = require('../middleware/validators');
const { isAuthenticated, isUser } = require('../middleware/authorization');

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
 *           type: string
 *           description: The name of the device. Can be used to update the device name.
 *           example: "My Car Tracker"
 *         latitude:
 *           type: number
 *           format: float
 *           description: Latitude.
 *           example: 50.08804
 *         longitude:
 *           type: number
 *           format: float
 *           description: Longitude.
 *           example: 14.42076
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
 */

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
 *         description: Data received successfully. Returns the sleep interval for the device.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sleep_interval:
 *                   type: integer
 *                   example: 60
 *       '400':
 *         description: Bad request (e.g., invalid coordinates, missing 'id').
 *       '404':
 *         description: Device not found.
 *       '500':
 *         description: Server error.
 */
router.post('/input', isAuthenticated, deviceController.handleDeviceInput);

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
 *                   device_id:
 *                     type: string
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
 *           type: integer
 *         required: true
 *         description: The database ID of the device.
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
 *           type: integer
 *         required: true
 *         description: The database ID of the device.
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
router.get('/settings/:deviceId', isAuthenticated, isUser, deviceController.getDeviceSettings);

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
router.post('/settings', isAuthenticated, isUser, validateSettings, deviceController.updateDeviceSettings);

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
router.post('/name', isAuthenticated, isUser, deviceController.updateDeviceName);

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
 *           type: integer
 *         required: true
 *         description: The database ID of the device to delete.
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
router.post('/delete/:deviceId', isAuthenticated, isUser, deviceController.deleteDevice);

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
router.post('/geofence', isAuthenticated, isUser, deviceController.updateGeofence);

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
router.get('/alerts', isAuthenticated, isUser, deviceController.getUnreadAlerts);

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
router.post('/alerts/read', isAuthenticated, isUser, deviceController.markAlertsAsRead);

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
router.post('/alerts/read-all/:deviceId', isAuthenticated, isUser, deviceController.markDeviceAlertsAsRead);

module.exports = router;
