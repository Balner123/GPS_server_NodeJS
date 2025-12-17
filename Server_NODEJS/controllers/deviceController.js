const db = require('../database');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const { getRequestLogger } = require('../utils/requestLogger');
const deviceService = require('../services/deviceService');
const locationService = require('../services/locationService');
const alertService = require('../services/alertService');

const getDeviceSettings = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDeviceSettings' });
    const deviceId = req.params.deviceId;
    log.info('Fetching device settings', { deviceId });
    
    const settings = await deviceService.getSettings(deviceId, req.session.user.id);
    
    log.info('Device settings fetched', { deviceId });
    res.json(settings);
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getDeviceSettings' });
    if (err.message === 'DEVICE_NOT_FOUND') {
        log.warn('Device not found', { deviceId: req.params.deviceId });
        return res.status(404).json({ error: 'Device not found' });
    }
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
      return res.status(400).json({ success: false, error: 'Validation failed', details: errors.array() });
    }
    const { deviceId, interval_gps, interval_send, satellites, mode } = req.body;
    log.info('Updating device settings', { deviceId, mode });

    try {
        const result = await deviceService.updateSettings(deviceId, req.session.user.id, {
            interval_gps, interval_send, satellites, mode
        });
        
        if (!result.updated) {
            log.info('Device settings unchanged', { deviceId });
            return res.status(200).json({ success: true, message: 'No changes detected.' });
        }

        log.info('Device settings updated', { deviceId });
        res.json({ success: true, message: 'Settings updated successfully.' });

    } catch (err) {
        if (err.message === 'DEVICE_NOT_FOUND') {
             log.warn('Device not found', { deviceId });
             return res.status(404).json({ error: 'Device not found' });
        }
        throw err;
    }
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'updateDeviceSettings' });
    log.error('Error in updateDeviceSettings', err);
    res.status(500).json({ error: err.message });
  }
};

const handleDeviceInput = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'handleDeviceInput' });
    // Note: Request logger middleware already logs the payload

    let dataPoints = Array.isArray(req.body) ? req.body : [req.body];
    
    if (dataPoints.length === 0) {
        log.warn('Device input was empty');
        return res.status(400).json({ error: 'Request body cannot be empty.' });
    }

    const firstPoint = dataPoints[0];
    const { device: deviceId } = firstPoint;
    log.info('Processing device payload', { deviceId, points: dataPoints.length });

    if (!deviceId) {
      log.warn('Device ID missing in payload');
      return res.status(400).json({ error: 'Device ID is missing in the payload.' });
    }

    const device = req.device; // Set by authenticateDevice middleware

    if (!device || !req.user) {
      log.error('Device authentication context missing', { deviceId });
      return res.status(500).json({ error: 'Device context not available after authentication.' });
    }

    if (device.device_id !== deviceId) {
      log.warn('Payload deviceId mismatch', { deviceId, authenticatedDevice: device.device_id });
      return res.status(400).json({ error: 'Payload device ID does not match authenticated device.' });
    }

    const reportedPowerStatus = deviceService.normalizePowerStatus(
      firstPoint.power_status || firstPoint.powerStatus || req.body.power_status || req.body.powerStatus
    );
    const clientTypeFromPayload = deviceService.normalizeClientType(
      firstPoint.client_type || firstPoint.clientType || req.body.client_type || req.body.clientType
    );

    try {
      await locationService.processLocationData(device, dataPoints, clientTypeFromPayload, reportedPowerStatus);
      
      log.info('Device payload processed successfully', { deviceId });
      res.status(200).json({ success: true });

    } catch (err) {
      log.error('Error processing device input', err);
      if (err.message && err.message.includes('latitude and longitude')) {
          return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: 'An error occurred during data processing.' });
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

    const instruction = deviceService.normalizePowerInstruction(rawInstruction);

    if (!instruction) {
      return res.status(400).json({ success: false, error: `Unsupported or missing power instruction.` });
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

    device.power_instruction = instruction === 'NONE' ? 'NONE' : instruction;
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
      // Request logger handles payload logging
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

      const clientType = deviceService.normalizeClientType(req.body.client_type || req.body.clientType) || device.device_type || null;
      const reportedPowerStatus = deviceService.normalizePowerStatus(req.body.power_status || req.body.powerStatus);

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

      if (deviceService.shouldClearPowerInstruction(device.power_instruction, resolvedPowerStatus)) {
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
        config: deviceService.buildDeviceConfigPayload(device),
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
    const coordinates = await locationService.getLatestCoordinates(req.session.user.id);
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
    
    try {
        const data = await locationService.getDeviceHistory(deviceId, req.session.user.id, true);
        log.info('Device data returned', { deviceId, count: data.length });
        res.json(data);
    } catch (err) {
        if (err.message === 'DEVICE_NOT_FOUND') {
            return res.status(404).json({ error: 'Device not found' });
        }
        throw err;
    }
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

  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'deleteDevice', deviceId });
    
    if (req.session.user.isRoot) {
         const device = await db.Device.findOne({ where: { device_id: deviceId } });
         if (!device) return res.status(404).json({ error: 'Device not found' });
         
         const adminService = require('../services/adminService'); 
         await adminService.deleteDeviceAndData(device.id);
         
         log.info('Device deleted by root via device endpoint');
         return res.status(200).json({ message: `Device '${deviceId}' deleted.` });
    } else {
         await deviceService.deleteDevice(deviceId, req.session.user.id);
         log.info('Device deleted by user');
         return res.status(200).json({ message: `Device '${deviceId}' deleted.` });
    }

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'deleteDevice', deviceId });
    log.error('Error deleting device', err);
    if (err.message === 'DEVICE_NOT_FOUND') {
        return res.status(404).json({ error: 'Device not found or permission denied.' });
    }
    res.status(500).json({ error: 'Failed to delete device.' });
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

const registerDeviceUnified = async (req, res) => {
  const clientType = deviceService.normalizeClientType(req.body.client_type || req.body.clientType);
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

      const result = await deviceService.registerDeviceForUser({
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

      const result = await deviceService.registerDeviceForUser({
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
    const alerts = await alertService.getUnreadAlerts(req.session.user.id);

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
    
    await alertService.markAlertsAsRead(req.session.user.id, alertIds);

    log.info('Alerts marked as read', { alertCount: alertIds ? alertIds.length : 0 });
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
    
    await alertService.markDeviceAlertsAsRead(req.session.user.id, deviceId);

    log.info('Alerts for device marked as read', { deviceId });
    res.json({ success: true, message: `Alerts for device ${deviceId} marked as read.` });

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'markDeviceAlertsAsRead' });
    if (err.message === 'DEVICE_NOT_FOUND') {
         return res.status(404).json({ success: false, error: 'Device not found.' });
    }
    log.error('Error marking device alerts as read', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const getUnreadAlertsForDevice = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'getUnreadAlertsForDevice' });
    const { deviceId } = req.params;
    
    const alerts = await alertService.getUnreadAlertsForDevice(req.session.user.id, deviceId);

    log.info('Unread alerts for device fetched', { deviceId, count: alerts.length });
    res.json(alerts);

  } catch (err) {
    const log = getRequestLogger(req, { controller: 'device', action: 'getUnreadAlertsForDevice' });
    if (err.message === 'DEVICE_NOT_FOUND') {
         return res.status(404).json({ success: false, error: 'Device not found.' });
    }
    log.error('Error fetching unread alerts for device', err);
    res.status(500).json({ success: false, error: 'An internal server error occurred.' });
  }
};

const exportDeviceDataAsGpx = async (req, res) => {
  try {
    const log = getRequestLogger(req, { controller: 'device', action: 'exportDeviceDataAsGpx' });
    const deviceId = req.params.deviceId;
    
    try {
        const gpxData = await locationService.getGpxData(deviceId, req.session.user.id);
        
        if (!gpxData) {
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="device_${deviceId}_no_data.txt"`);
            log.info('GPX export had no data', { deviceId });
            return res.status(404).send('No location data found for this device.');
        }

        res.setHeader('Content-Type', 'application/gpx+xml');
        res.setHeader('Content-Disposition', `attachment; filename="device_${deviceId}_export.gpx"`);
        log.info('GPX export generated', { deviceId });
        res.send(gpxData);

    } catch (err) {
        if (err.message === 'DEVICE_NOT_FOUND') {
            return res.status(404).json({ error: 'Device not found' });
        }
        throw err;
    }

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
    log.info('Fetching device data', { deviceId });
    
    try {
        const rawLocations = await locationService.getDeviceHistory(deviceId, req.session.user.id, false);
        log.info('Raw device data returned', { deviceId, count: rawLocations.length });
        res.json(rawLocations);
    } catch (err) {
         if (err.message === 'DEVICE_NOT_FOUND') {
            return res.status(404).json({ error: 'Device not found' });
        }
        throw err;
    }

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
  handleDeviceInput,
  getCurrentCoordinates,
  getDeviceData,
  getRawDeviceData,
  deleteDevice,
  getDevicesPage,
  removeDeviceFromUser,
  registerDeviceUnified,
  handleDeviceHandshake,
  getUnreadAlertsForDevice,
  exportDeviceDataAsGpx,
  updatePowerInstruction
};