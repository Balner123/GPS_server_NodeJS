const db = require('../database');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const { sendGeofenceAlertEmail, sendGeofenceReturnEmail } = require('../utils/emailSender');
const logger = require('../utils/logger');
const { sanitizePayload } = require('../utils/logger');
const { getRequestLogger } = require('../utils/requestLogger');
const { isPointInPolygon, isPointInCircle, clusterLocations } = require('../utils/geoUtils');
const { generateGpx } = require('../utils/gpxGenerator');

// --- Geofencing Helper Functions ---

// Note: isPointInPolygon and isPointInCircle are imported from utils/geoUtils

/**
 * Creates a geofence alert record in the database.
 * @param {object} device - The Sequelize device object.
 * @param {object} location - The location object that triggered the alert.
 */
async function createGeofenceAlertRecord(device, location) {
  const geofenceLogger = logger.child({
    controller: 'device',
    action: 'createGeofenceAlertRecord',
    deviceId: device.device_id,
    userId: device.user_id
  });
  geofenceLogger.info('Creating geofence alert record');
  try {
    await db.Alert.create({
      device_id: device.id,
      user_id: device.user_id,
      type: 'geofence',
      message: `Device '${device.name || device.device_id}' has left the defined geofence area.`
    });
    geofenceLogger.info('Geofence alert record stored');
  } catch (error) {
    geofenceLogger.error('Failed to create geofence alert record', error);
  }
}

function buildDeviceConfigPayload(device) {
  return {
    interval_gps: Number(device.interval_gps),
    interval_send: Number(device.interval_send),
    satellites: Number(device.satellites),
    mode: device.mode
  };
}

function normalizePowerStatus(status) {
  if (!status) {
    return null;
  }
  const normalized = String(status).trim().toUpperCase();
  if (normalized === 'ON' || normalized === 'OFF') {
    return normalized;
  }
  return null;
}

function normalizeClientType(clientType) {
  if (!clientType) {
    return null;
  }
  return String(clientType).trim().toUpperCase();
}

function normalizePowerInstruction(instruction) {
  if (!instruction) {
    return null;
  }
  const normalized = String(instruction).trim().toUpperCase();
  if (normalized === 'NONE' || normalized === 'TURN_OFF') {
    return normalized;
  }
  return null;
}

function shouldClearPowerInstruction(instruction, status) {
  const normalizedInstruction = normalizePowerInstruction(instruction);
  const normalizedStatus = normalizePowerStatus(status);

  if (!normalizedInstruction || normalizedInstruction === 'NONE') {
    return false;
  }

  if (!normalizedStatus) {
    return false;
  }

  if (normalizedInstruction === 'TURN_OFF' && normalizedStatus === 'OFF') {
    return true;
  }

  return false;
}

// --- End Geofencing Helpers ---

const MAX_PAYLOAD_LOG_LENGTH = 4096;

function truncateString(value, maxLength = MAX_PAYLOAD_LOG_LENGTH) {
  if (typeof value !== 'string') {
    return value;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}... [truncated ${value.length - maxLength} chars]`;
}

function snapshotPayload(payload, maxArrayItems = 5) {
  if (payload === null || payload === undefined) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return {
      type: 'array',
      totalItems: payload.length,
      sample: payload.slice(0, maxArrayItems).map(item => sanitizePayload(item))
    };
  }

  if (typeof payload === 'object') {
    return sanitizePayload(payload);
  }

  return payload;
}

function logRequestPayload(log, req, label) {
  try {
    const snapshot = snapshotPayload(req.body);
    const rawBody = typeof req.rawBody === 'string' ? truncateString(req.rawBody) : undefined;
    log.info(label, { rawBody, snapshot });
  } catch (error) {
    log.warn('Failed to log payload snapshot', { error: error.message });
  }
}



const getDeviceSettings = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDeviceSettings' });
    const deviceId = req.params.deviceId;
    log.info('Fetching device settings', { deviceId });
    const device = await db.Device.findOne({ 
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      } 
    });
    if (!device) {
      log.warn('Device not found when requesting settings', { deviceId });
      return res.status(404).json({ error: 'Device not found' });
    }
    log.info('Device settings fetched', { deviceId });
    res.json({
      interval_gps: device.interval_gps,
      interval_send: device.interval_send,
      satellites: device.satellites,
      geofence: device.geofence,
      created_at: device.created_at,
      device_type: device.device_type,
      mode: device.mode,
      power_status: device.power_status,
      power_instruction: device.power_instruction
    });
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDeviceSettings' });
    log.error('Error getting device settings', err);
    res.status(500).json({ error: err.message });
  }
};

const updateDeviceSettings = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'updateDeviceSettings' });
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      log.warn('Device settings validation failed', { errors: errors.array() });
      // Surface a clear error message for the frontend while preserving details
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { deviceId, interval_gps, interval_send, satellites, mode } = req.body;
    log.info('Updating device settings', { deviceId, mode });

    // Find device to disambiguate between "not found" and "no changes"
    const device = await db.Device.findOne({
      where: {
        device_id: deviceId,
        user_id: req.session.user.id
      }
    });

    if (!device) {
      log.warn('Device not found while updating settings', { deviceId });
      return res.status(404).json({ error: 'Device not found' });
    }

    // If nothing changes, return a 200 with an informative message to avoid confusing the UI
    const nextIntervalGps = Number(interval_gps);
    const nextIntervalSend = Number(interval_send);
    const nextSatellites = Number(satellites);

    const noChanges = (
      Number(device.interval_gps) === nextIntervalGps &&
      Number(device.interval_send) === nextIntervalSend &&
      Number(device.satellites) === nextSatellites &&
      device.mode === mode
    );

    if (noChanges) {
      log.info('Device settings unchanged', { deviceId });
      return res.status(200).json({ success: true, message: 'No changes detected.' });
    }

    await db.Device.update(
      { interval_gps: nextIntervalGps, interval_send: nextIntervalSend, satellites: nextSatellites, mode: mode },
      {
        where: {
          device_id: deviceId,
          user_id: req.session.user.id
        }
      }
    );

    log.info('Device settings updated', { deviceId });
    res.json({ success: true, message: 'Settings updated successfully.' });
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'updateDeviceSettings' });
    log.error('Error in updateDeviceSettings', err);
    res.status(500).json({ error: err.message });
  }
};

const handleDeviceInput = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'handleDeviceInput' });
    logRequestPayload(log, req, 'Device input payload received');

    let dataPoints = Array.isArray(req.body) ? req.body : [req.body];
    
    if (dataPoints.length === 0) {
        log.warn('Device input was empty');
        return res.status(400).json({ error: 'Request body cannot be empty.' });
    }

  const firstPoint = dataPoints[0];
  const { device: deviceId } = firstPoint;
    log.info('Processing device payload', { deviceId, points: dataPoints.length });
    const reportedPowerStatus = normalizePowerStatus(
      firstPoint.power_status || firstPoint.powerStatus || req.body.power_status || req.body.powerStatus
    );
    const clientTypeFromPayload = normalizeClientType(
      firstPoint.client_type || firstPoint.clientType || req.body.client_type || req.body.clientType
    );

    if (!deviceId) {
      log.warn('Device ID missing in payload');
      return res.status(400).json({ error: 'Device ID is missing in the payload.' });
    }

    const device = req.device;

    if (!device || !req.user) {
      log.error('Device authentication context missing', { deviceId });
      return res.status(500).json({ error: 'Device context not available after authentication.' });
    }

    if (device.device_id !== deviceId) {
      log.warn('Payload deviceId mismatch', { deviceId, authenticatedDevice: device.device_id });
      return res.status(400).json({ error: 'Payload device ID does not match authenticated device.' });
    }

    const t = await db.sequelize.transaction();
    let lastLocation;
    try {
      const locationsToCreate = dataPoints.map(point => {
        if (point.latitude === undefined || point.longitude === undefined) {
            throw new Error('Each data point in the array must have latitude and longitude.');
        }
        return {
          device_id: device.id,
          user_id: device.user_id,
          latitude: point.latitude,
          longitude: point.longitude,
          speed: point.speed !== undefined ? point.speed : null,
          altitude: point.altitude !== undefined ? point.altitude : null,
          accuracy: point.accuracy !== undefined ? point.accuracy : null,
          satellites: point.satellites !== undefined ? point.satellites : null,
          timestamp: point.timestamp && new Date(point.timestamp).getTime() > 0 ? new Date(point.timestamp) : new Date() 
        };
      });

      if (locationsToCreate.length > 0) {
        await db.Location.bulkCreate(locationsToCreate, { transaction: t, validate: true });
        lastLocation = locationsToCreate[locationsToCreate.length - 1];
        log.info('Locations stored for device', { deviceId, count: locationsToCreate.length });
      }

      const now = new Date();
      device.last_seen = now;

      if (clientTypeFromPayload && device.device_type !== clientTypeFromPayload) {
        device.device_type = clientTypeFromPayload;
      }

      if (reportedPowerStatus && device.power_status !== reportedPowerStatus) {
        device.power_status = reportedPowerStatus;
      }

      const resolvedPowerStatus = reportedPowerStatus || device.power_status;

      if (shouldClearPowerInstruction(device.power_instruction, resolvedPowerStatus)) {
        device.power_instruction = 'NONE';
      }

      await device.save({ transaction: t });
      
      await t.commit();
      log.info('Device payload transaction committed', { deviceId });
      
      // --- Geofence Check ---
      if (lastLocation && device.geofence) {
        const geofence = device.geofence;
        let isInside = false;

        if (geofence.type === 'circle') {
            const circle = { center: [geofence.lng, geofence.lat], radius: geofence.radius };
            isInside = isPointInCircle(lastLocation, circle);
        } else if (geofence.type === 'Feature') { // GeoJSON for polygon
            isInside = isPointInPolygon(lastLocation, geofence.geometry.coordinates[0]);
        }

        const user = await device.getUser();

        // Case 1: Device is OUTSIDE and alert is NOT active yet
        if (!isInside && !device.geofence_alert_active) {
            log.warn('Device left geofence', { deviceId: device.device_id });
            device.geofence_alert_active = true;
            await device.save(); // Save the new alert state
            await createGeofenceAlertRecord(device, lastLocation); // Create DB record
            if (user && user.email) {
                await sendGeofenceAlertEmail(user.email, device, lastLocation);
            }
        }
        // Case 2: Device is INSIDE and alert IS active
        else if (isInside && device.geofence_alert_active) {
            log.info('Device returned to geofence', { deviceId: device.device_id });
            device.geofence_alert_active = false;
            await device.save(); // Save the new alert state
            // Create an alert record for returning to geofence
            await db.Alert.create({
                device_id: device.id,
                user_id: device.user_id,
                type: 'geofence_return',
                message: `Device '${device.name || device.device_id}' has returned to the defined geofence area.`
            });
            if (user && user.email) {
                await sendGeofenceReturnEmail(user.email, device, lastLocation);
            }
        }
      }
      // --- End Geofence Check ---

      log.info('Device payload processed successfully', { deviceId });
      res.status(200).json({ 
        success: true,
      });

    } catch (err) {
      await t.rollback();
      log.error('Error in handleDeviceInput transaction', err);
      if (err.message.includes('latitude and longitude')) {
          return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'An error occurred during the database transaction.' });
    }
  } catch (err) {
      const log = getRequestLogger(req, { controller: 'device', action: 'handleDeviceInput' });
      log.error('Error in handleDeviceInput', err);
      res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

const updatePowerInstruction = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'updatePowerInstruction' });
    const deviceId = req.body.deviceId || req.body.device_id;
    const rawInstruction = req.body.power_instruction || req.body.powerInstruction;

    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID is required.' });
    }

    if (!rawInstruction) {
      return res.status(400).json({ success: false, error: 'Power instruction is required.' });
    }

    const instruction = String(rawInstruction).trim().toUpperCase();
    const allowedInstructions = ['NONE', 'TURN_OFF'];

    if (!allowedInstructions.includes(instruction)) {
      return res.status(400).json({ success: false, error: `Unsupported power instruction '${instruction}'.` });
    }

    log.info('Updating power instruction', { deviceId, instruction });

    const device = await db.Device.findOne({
      where: {
        device_id: deviceId,
        user_id: req.session.user.id
      }
    });

    if (!device) {
      log.warn('Device not found when updating power instruction', { deviceId });
      return res.status(404).json({ success: false, error: 'Device not found or you do not have permission to control it.' });
    }

    if (instruction === 'NONE') {
      device.power_instruction = 'NONE';
    } else {
      device.power_instruction = instruction;
    }

    await device.save();

    log.info('Power instruction updated', { deviceId, instruction: device.power_instruction });
    return res.json({
      success: true,
      power_instruction: device.power_instruction,
      power_status: device.power_status
    });
  } catch (error) {
    const log = getRequestLogger(req, { controller: 'device', action: 'updatePowerInstruction' });
    log.error('Error updating power instruction', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

  const handleDeviceHandshake = async (req, res) => {
    try {
      const log = getRequestLogger(req, { controller: 'device', action: 'handleDeviceHandshake' });
      logRequestPayload(log, req, 'Device handshake payload received');
      const deviceId = req.body.device_id || req.body.deviceId || req.body.device;

      if (!deviceId) {
        log.warn('Handshake missing device ID');
        return res.status(400).json({ success: false, error: 'Missing device_id.' });
      }

      const device = await db.Device.findOne({ where: { device_id: deviceId } });

      if (!device) {
        log.warn('Handshake from unregistered device', { deviceId });
        return res.status(200).json({ registered: false });
      }

      const clientType = normalizeClientType(req.body.client_type || req.body.clientType) || device.device_type || null;
      const reportedPowerStatus = normalizePowerStatus(req.body.power_status || req.body.powerStatus);

      let shouldSave = false;

      if (!device.device_type && clientType) {
        device.device_type = clientType;
        shouldSave = true;
      }

      if (reportedPowerStatus && device.power_status !== reportedPowerStatus) {
        device.power_status = reportedPowerStatus;
        shouldSave = true;
      }

      const resolvedPowerStatus = reportedPowerStatus || device.power_status;

      if (shouldClearPowerInstruction(device.power_instruction, resolvedPowerStatus)) {
        device.power_instruction = 'NONE';
        shouldSave = true;
      }

      device.last_seen = new Date();
      shouldSave = true;

      if (shouldSave) {
        await device.save();
      }

      log.info('Handshake successful', { deviceId });
      return res.status(200).json({
        registered: true,
        config: buildDeviceConfigPayload(device),
        power_instruction: device.power_instruction
      });
    } catch (error) {
      const log = getRequestLogger(req, { controller: 'device', action: 'handleDeviceHandshake' });
      log.error('Error during device handshake', error);
      return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
  };

const getCurrentCoordinates = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getCurrentCoordinates' });
    const devices = await db.Device.findAll({
      where: { 
        user_id: req.session.user.id
      },
      include: [
        {
          model: db.Location,
          where: {
            id: {
              [db.Sequelize.Op.in]: db.sequelize.literal(`(SELECT MAX(id) FROM locations GROUP BY device_id)`)
            }
          },
          required: true
        },
        {
          model: db.Alert,
          where: { is_read: false },
          required: false
        }
      ]
    });

    const coordinates = devices.map(d => {
      const latestLocation = d.Locations[0];
      return {
        device: d.device_id,
        name: d.name,
        longitude: latestLocation.longitude,
        latitude: latestLocation.latitude,
        timestamp: latestLocation.timestamp,
        has_unread_alerts: d.Alerts && d.Alerts.length > 0,
        power_status: d.power_status,
        power_instruction: d.power_instruction
      };
    });

    log.info('Returning current coordinates', { count: coordinates.length });
    res.json(coordinates);
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getCurrentCoordinates' });
    log.error('Error fetching current coordinates', err);
    res.status(500).json({ error: err.message });
  }
};

const getDeviceData = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDeviceData' });
    const deviceId = req.query.id;
    log.info('Fetching device data', { deviceId });
    const device = await db.Device.findOne({
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      }
    });

    if (!device) {
      log.warn('Device not found when fetching data', { deviceId });
      return res.status(404).json({ error: 'Device not found' });
    }
    // Načteme lokace seřazené VZESTUPNĚ pro správnou funkci algoritmu
    const rawLocations = await db.Location.findAll({
      where: { device_id: device.id },
      order: [['timestamp', 'ASC']] 
    });

    const DISTANCE_THRESHOLD_METERS = 25; // Updated threshold
    const processedLocations = clusterLocations(rawLocations, DISTANCE_THRESHOLD_METERS);

    log.info('Device data returned', { deviceId, count: processedLocations.length });
    res.json(processedLocations);

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDeviceData' });
    log.error('Error in getDeviceData', err);
    res.status(500).json({ error: err.message });
  }
};

const deleteDevice = async (req, res) => {
  const deviceId = req.params.deviceId;
  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required.' });
  }

  const t = await db.sequelize.transaction(); // Start transaction

  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'deleteDevice', deviceId });
    // Find device to get its internal ID. Admin (root) can delete any device.
    const findOptions = { where: { device_id: deviceId } };
    if (!req.session.user.isRoot) {
        findOptions.where.user_id = req.session.user.id;
    }

    const device = await db.Device.findOne(findOptions);

    if (!device) {
      log.warn('Attempt to delete non-existent device');
      await t.rollback();
      return res.status(404).json({ error: 'Device not found or you do not have permission to delete it.' });
    }

    // 1. Manually delete associated locations
    await db.Location.destroy({ where: { device_id: device.id }, transaction: t });

    // 2. Manually delete associated alerts
    await db.Alert.destroy({ where: { device_id: device.id }, transaction: t });

    // 3. Finally, delete the device itself
    await device.destroy({ transaction: t });

    await t.commit(); // Commit the transaction

    log.info('Device deleted with associated data');
    res.status(200).json({ message: `Device '${deviceId}' and all its data have been deleted successfully.` });
  } catch (err) {
    await t.rollback(); // Rollback on any error
    const log = getRequestLogger(req, { controller: 'device', action: 'deleteDevice', deviceId });
    log.error('Error deleting device', err);
    res.status(500).json({ error: 'Failed to delete device. An internal server error occurred.' });
  }
};

const removeDeviceFromUser = async (req, res) => {
  const { deviceId } = req.params;
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'removeDeviceFromUser', deviceId });
    const device = await db.Device.findOne({ 
      where: { 
        device_id: deviceId, 
        user_id: req.session.user.id 
      } 
    });

    if (!device) {
      req.flash('error', 'Device not found or you do not have permission to remove it.');
      log.warn('Attempted to remove device without permission');
      return res.redirect('/devices');
    }

    await device.destroy();
    log.info('Device unregistered for user');

    req.flash('success', `Registration for device "${deviceId}" has been successfully canceled.`);
    res.redirect('/devices');

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'removeDeviceFromUser', deviceId });
    log.error('Error removing device from user', err);
    req.flash('error', 'Error during device removal.');
    res.redirect('/devices');
  }
};

const getDevicesPage = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDevicesPage' });
    const userDevices = await db.Device.findAll({
      where: { user_id: req.session.user.id },
      order: [['created_at', 'DESC']]
    });
    log.info('Devices page loaded', { count: userDevices.length });
    res.render('manage-devices', { 
      devices: userDevices,
      error: req.flash('error'),
      success: req.flash('success'),
      currentPage: 'devices'
    });
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDevicesPage' });
    log.error('Error fetching devices for management page', err);
    res.status(500).render('manage-devices', { 
      devices: [], 
      error: ['Error loading your devices.'],
      success: null,
      currentPage: 'devices'
    });
  }
};

async function registerDeviceForUser({ user, deviceId, name, deviceType }) {
  if (!user || !user.id) {
    throw new Error('registerDeviceForUser requires a valid user with an id');
  }
  if (!deviceId) {
    throw new Error('registerDeviceForUser requires deviceId');
  }

  const normalizedDeviceType = deviceType || null;
  const existingDevice = await db.Device.findOne({ where: { device_id: deviceId } });

  if (existingDevice) {
    if (existingDevice.user_id === user.id) {
      return { status: 'already-owned', device: existingDevice };
    }
    return { status: 'conflict', device: existingDevice };
  }

  const fallbackName = deviceId.length > 6 ? `Device ${deviceId.slice(0, 6)}` : `Device ${deviceId}`;
  const deviceName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : fallbackName;

  const device = await db.Device.create({
    device_id: deviceId,
    user_id: user.id,
    name: deviceName,
    device_type: normalizedDeviceType
  });

  return { status: 'created', device };
}

const registerDeviceFromApk = async (req, res) => {
  const { installationId, deviceName } = req.body;

  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ success: false, error: 'User is not logged in.' });
  }

  if (!installationId || !deviceName) {
    return res.status(400).json({ success: false, error: 'Missing device ID or name.' });
  }

  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'registerDeviceFromApk', deviceId: installationId });
    log.info('Registering device from APK', { deviceName });
    const result = await registerDeviceForUser({
      user: req.session.user,
      deviceId: installationId,
      name: deviceName,
      deviceType: 'APK'
    });

    if (result.status === 'created') {
      log.info('Device registered from APK');
      return res.status(201).json({ success: true, message: 'Device registered successfully.' });
    }

    if (result.status === 'already-owned') {
      log.info('Device already owned by user via APK');
      return res.status(200).json({ success: true, message: 'Device is already registered.' });
    }

    if (result.status === 'conflict') {
      log.warn('APK registration conflict', { ownerId: result.device.user_id });
      return res.status(409).json({ success: false, error: 'This device ID already exists.' });
    }

    return res.status(500).json({ success: false, error: 'Unexpected registration state.' });
  } catch (error) {
    const log = getRequestLogger(req, { controller: 'device', action: 'registerDeviceFromApk', deviceId: installationId });
    log.error('Error during device registration from APK', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, error: 'This device ID already exists.' });
    }
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

const registerDeviceFromHardware = async (req, res) => {
  const { username, password, deviceId, name } = req.body;

  if (!username || !password || !deviceId) {
    return res.status(400).json({ success: false, error: 'Missing username, password, or deviceId.' });
  }

  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'registerDeviceFromHardware', deviceId });
    log.info('Hardware registration request received', { username });
    // 1. Authenticate user
    const user = await db.User.findOne({ where: { username: username } });

    // Also check if the user has a password set, to prevent bcrypt from crashing
    if (!user || !user.password) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const result = await registerDeviceForUser({
      user,
      deviceId,
      name,
      deviceType: 'HW'
    });

    if (result.status === 'created') {
      log.info('Hardware device registered');
      return res.status(201).json({ success: true, message: 'Device registered successfully.' });
    }

    if (result.status === 'already-owned') {
      log.info('Hardware device already registered to user');
      return res.status(200).json({ success: true, message: 'Device already registered to your account.' });
    }

    if (result.status === 'conflict') {
      log.warn('Hardware registration conflict');
      return res.status(409).json({ success: false, error: 'Device already registered to another user.' });
    }

    return res.status(500).json({ success: false, error: 'Unexpected registration state.' });

  } catch (error) {
    const log = getRequestLogger(req, { controller: 'device', action: 'registerDeviceFromHardware', deviceId });
    log.error('Error during hardware device registration', error);
    res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};

const registerDeviceUnified = async (req, res) => {
  const clientType = normalizeClientType(req.body.client_type || req.body.clientType);
  const deviceId = req.body.device_id || req.body.deviceId || req.body.device;
  const providedName = req.body.name || req.body.deviceName;

  if (!clientType) {
    return res.status(400).json({ success: false, error: 'Missing client_type.' });
  }




  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'Missing device_id.' });
  }

  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'registerDeviceUnified', deviceId, clientType });
    log.info('Unified registration request received');
    if (clientType === 'APK') {
      if (!req.session.user || !req.session.user.id) {
        return res.status(401).json({ success: false, error: 'User is not logged in.' });
      }

      const result = await registerDeviceForUser({
        user: req.session.user,
        deviceId,
        name: providedName,
        deviceType: 'APK'
      });

      if (result.status === 'created') {
        log.info('Unified APK registration created');
        return res.status(201).json({ success: true, message: 'Device registered successfully.' });
      }
      if (result.status === 'already-owned') {
        log.info('Unified APK registration already owned');
        return res.status(200).json({ success: true, message: 'Device is already registered.' });
      }
      if (result.status === 'conflict') {
        log.warn('Unified APK registration conflict');
        return res.status(409).json({ success: false, error: 'Device already registered to another user.' });
      }

      return res.status(500).json({ success: false, error: 'Unexpected registration state.' });
    }

    if (clientType === 'HW') {
      const username = req.body.username || req.body.user;
      const password = req.body.password;

      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Missing username or password.' });
      }

      const user = await db.User.findOne({ where: { username } });

      if (!user || !user.password) {
        return res.status(401).json({ success: false, error: 'Invalid credentials.' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials.' });
      }

      const result = await registerDeviceForUser({
        user,
        deviceId,
        name: providedName,
        deviceType: 'HW'
      });

      if (result.status === 'created') {
        log.info('Unified HW registration created', { userId: user.id });
        return res.status(201).json({ success: true, message: 'Device registered successfully.' });
      }
      if (result.status === 'already-owned') {
        log.info('Unified HW registration already owned', { userId: user.id });
        return res.status(200).json({ success: true, message: 'Device already registered to your account.' });
      }
      if (result.status === 'conflict') {
        log.warn('Unified HW registration conflict');
        return res.status(409).json({ success: false, error: 'Device already registered to another user.' });
      }

      return res.status(500).json({ success: false, error: 'Unexpected registration state.' });
    }

    log.warn('Unsupported client type for unified registration');
    return res.status(400).json({ success: false, error: `Unsupported client_type '${clientType}'.` });
  } catch (error) {
    const log = getRequestLogger(req, { controller: 'device', action: 'registerDeviceUnified', deviceId, clientType });
    log.error('Error during unified device registration', error);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
};



const updateDeviceName = async (req, res) => {
  const { deviceId, newName } = req.body;
  const userId = req.session.user.id;

  if (!deviceId || !newName) {
    return res.status(400).json({ success: false, error: 'Device ID and new name are required.' });
  }

  if (typeof newName !== 'string' || newName.trim().length === 0 || newName.length > 255) {
      return res.status(400).json({ success: false, error: 'Invalid name provided.' });
  }

  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'updateDeviceName', deviceId });
    const [affectedRows] = await db.Device.update(
      { name: newName.trim() },
      { 
        where: { 
          device_id: deviceId,
          user_id: userId 
        } 
      }
    );

    if (affectedRows === 0) {
      log.warn('Device name update affected no rows');
      return res.status(404).json({ success: false, error: 'Device not found or you do not have permission to edit it.' });
    }

    log.info('Device name updated');
    res.json({ success: true, message: 'Device name updated successfully.' });

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'updateDeviceName', deviceId });
    log.error('Error updating device name', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const updateGeofence = async (req, res) => {
  const { deviceId, geofence } = req.body;
  const userId = req.session.user.id;

  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'Device ID is required.' });
  }

  if (geofence) { // Only validate if a geofence object is present
    if (typeof geofence !== 'object' || !geofence.type) {
        return res.status(400).json({ success: false, error: 'Invalid geofence data: missing type property.' });
    }
    // Validation for GeoJSON polygons
    if (geofence.type === 'Feature' && !geofence.geometry) {
        return res.status(400).json({ success: false, error: 'Invalid GeoJSON Feature: missing geometry property.' });
    }
    // Validation for custom circles
    if (geofence.type === 'circle' && (geofence.lat === undefined || geofence.lng === undefined || geofence.radius === undefined)) {
        return res.status(400).json({ success: false, error: 'Invalid circle object: missing lat, lng, or radius.' });
    }
  }

  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'updateGeofence', deviceId });
    const [affectedRows] = await db.Device.update(
      { geofence: geofence },
      { 
        where: { 
          device_id: deviceId,
          user_id: userId
        } 
      }
    );

    if (affectedRows > 0) {
    log.info('Geofence updated');
    res.json({ success: true, message: 'Geofence updated successfully.' });
    } else {
    // Pokud byla geofence null a snažíme se ji znovu nastavit na null, není to chyba.
    // Záznam se neaktualizoval, ale stav je správný.
    if (geofence === null) {
        log.info('Geofence removed');
        res.json({ success: true, message: 'Geofence removed.' });
    } else {
        log.warn('Geofence update attempted on unavailable device');
        return res.status(404).json({ success: false, error: 'Device not found or you do not have permission to edit it.' });
    }
}


  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'updateGeofence', deviceId });
    log.error('Error updating geofence', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const getUnreadAlerts = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getUnreadAlerts' });
    const userId = req.session.user.id;
    const devices = await db.Device.findAll({ where: { user_id: userId }, attributes: ['id'] });
    const deviceIds = devices.map(d => d.id);

    const { Op } = db.Sequelize;
    let alerts = [];
    if (deviceIds && deviceIds.length > 0) {
      alerts = await db.Alert.findAll({
        where: {
          device_id: { [Op.in]: deviceIds },
          is_read: false
        },
        order: [['created_at', 'DESC']]
      });
    }

    log.info('Unread alerts fetched', { count: alerts.length });
    res.json(alerts);

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getUnreadAlerts' });
    log.error('Error fetching unread alerts', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const markAlertsAsRead = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'markAlertsAsRead' });
    const { alertIds } = req.body;
    const userId = req.session.user.id;

    if (!alertIds || !Array.isArray(alertIds) || alertIds.length === 0) {
      return res.status(400).json({ success: false, error: 'Alert IDs must be a non-empty array.' });
    }

    const devices = await db.Device.findAll({ where: { user_id: userId }, attributes: ['id'] });
    const userDeviceIds = devices.map(d => d.id);

    const { Op } = db.Sequelize;
    await db.Alert.update(
      { is_read: true },
      {
        where: {
          id: { [Op.in]: alertIds },
          device_id: { [Op.in]: userDeviceIds }
        }
      }
    );

    log.info('Alerts marked as read', { alertCount: alertIds.length });
    res.json({ success: true, message: 'Alerts marked as read.' });

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'markAlertsAsRead' });
    log.error('Error marking alerts as read', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const markDeviceAlertsAsRead = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'markDeviceAlertsAsRead' });
    const { deviceId } = req.params;
    const userId = req.session.user.id;

    const device = await db.Device.findOne({
      where: { device_id: deviceId, user_id: userId },
      attributes: ['id']
    });

    if (!device) {
      log.warn('Attempt to mark alerts for missing device', { deviceId });
      return res.status(404).json({ success: false, error: 'Device not found.' });
    }

    const unreadAlerts = await db.Alert.findAll({
      where: {
        device_id: device.id,
        is_read: false
      }
    });

    // Bulk update to mark unread alerts as read for the device (single query)
    if (unreadAlerts && unreadAlerts.length > 0) {
      const alertIdsToUpdate = unreadAlerts.map(a => a.id);
      await db.Alert.update(
        { is_read: true },
        { where: { id: alertIdsToUpdate } }
      );
    }

    log.info('Alerts for device marked as read', { deviceId });
    res.json({ success: true, message: `Alerts for device ${deviceId} marked as read.` });

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'markDeviceAlertsAsRead' });
    log.error('Error marking device alerts as read', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const getUnreadAlertsForDevice = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getUnreadAlertsForDevice' });
    const { deviceId } = req.params;
    const userId = req.session.user.id;

    const device = await db.Device.findOne({
      where: { device_id: deviceId, user_id: userId },
      attributes: ['id']
    });

    if (!device) {
      log.warn('Attempt to get alerts for missing or unauthorized device', { deviceId });
      return res.status(404).json({ success: false, error: 'Device not found.' });
    }

    const alerts = await db.Alert.findAll({
      where: {
        device_id: device.id,
        is_read: false
      },
      order: [['created_at', 'DESC']]
    });

    log.info('Unread alerts for device fetched', { deviceId, count: alerts.length });
    res.json(alerts);

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getUnreadAlertsForDevice' });
    log.error('Error fetching unread alerts for device', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const exportDeviceDataAsGpx = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'exportDeviceDataAsGpx' });
    const deviceId = req.params.deviceId;
    const device = await db.Device.findOne({
      where: {
        device_id: deviceId,
        user_id: req.session.user.id
      }
    });

    if (!device) {
      log.warn('GPX export requested for missing device', { deviceId });
      return res.status(404).json({ error: 'Device not found' });
    }

    const locations = await db.Location.findAll({
      where: { device_id: device.id },
      order: [['timestamp', 'ASC']]
    });

    if (locations.length === 0) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="device_${deviceId}_no_data.txt"`);
      log.info('GPX export had no data', { deviceId });
        return res.status(404).send('No location data found for this device.');
    }

    const gpxData = generateGpx(device.name || device.device_id, locations);

    res.setHeader('Content-Type', 'application/gpx+xml');
    res.setHeader('Content-Disposition', `attachment; filename="device_${deviceId}_export.gpx"`);
    log.info('GPX export generated', { deviceId, points: locations.length });
    res.send(gpxData);

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'exportDeviceDataAsGpx' });
    log.error('Error exporting GPX data', err);
    res.status(500).json({ error: err.message });
  }
};

const getRawDeviceData = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getRawDeviceData' });
    const deviceId = req.query.id;
    const device = await db.Device.findOne({
      where: { 
        device_id: deviceId,
        user_id: req.session.user.id 
      }
    });

    if (!device) {
      log.warn('Raw data requested for missing device', { deviceId });
      return res.status(404).json({ error: 'Device not found' });
    }

    const rawLocations = await db.Location.findAll({
      where: { device_id: device.id },
      order: [['timestamp', 'ASC']] 
    });

    log.info('Raw device data returned', { deviceId, count: rawLocations.length });
    res.json(rawLocations);

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getRawDeviceData' });
    log.error('Error in getRawDeviceData', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getDeviceSettings,
  updateDeviceSettings,
  updateDeviceName,
  updateGeofence,
  getUnreadAlerts,
  markAlertsAsRead,
  markDeviceAlertsAsRead,
  registerDeviceFromApk,
  handleDeviceInput,
  getCurrentCoordinates,
  getDeviceData,
  getRawDeviceData,
  deleteDevice,
  getDevicesPage,
  removeDeviceFromUser,
  registerDeviceFromHardware,
  registerDeviceUnified,
  handleDeviceHandshake,
  getUnreadAlertsForDevice,
  exportDeviceDataAsGpx,
  updatePowerInstruction
};