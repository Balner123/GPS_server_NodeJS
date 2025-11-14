const { body } = require('express-validator');

function normalizePoints(bodyPayload) {
  if (Array.isArray(bodyPayload)) {
    return bodyPayload;
  }
  if (bodyPayload && typeof bodyPayload === 'object') {
    return [bodyPayload];
  }
  return null;
}

const validateDeviceInputPayload = (req, res, next) => {
  const points = normalizePoints(req.body);

  if (!points || points.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Request body must contain at least one device data point.'
    });
  }

  const errors = [];
  const firstPoint = points[0];
  const deviceId = firstPoint && (firstPoint.device || firstPoint.device_id || firstPoint.deviceId);

  if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
    errors.push({ index: 0, field: 'device', message: 'Device ID is required on the first data point.' });
  }

  points.forEach((point, index) => {
    if (!point || typeof point !== 'object') {
      errors.push({ index, field: 'point', message: 'Each data point must be an object.' });
      return;
    }

    const toNumber = value => (value === null || value === undefined ? NaN : Number(value));
    const latitude = toNumber(point.latitude);
    const longitude = toNumber(point.longitude);

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.push({ index, field: 'latitude', message: 'Latitude must be a number between -90 and 90.' });
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.push({ index, field: 'longitude', message: 'Longitude must be a number between -180 and 180.' });
    }

    if (point.speed !== undefined) {
      const speed = toNumber(point.speed);
      if (!Number.isFinite(speed) || speed < 0 || speed > 1000) {
        errors.push({ index, field: 'speed', message: 'Speed must be a positive number up to 1000 km/h.' });
      }
    }

    if (point.altitude !== undefined) {
      const altitude = toNumber(point.altitude);
      if (!Number.isFinite(altitude) || altitude < -1000 || altitude > 10000) {
        errors.push({ index, field: 'altitude', message: 'Altitude must be between -1000 and 10000 meters.' });
      }
    }

    if (point.accuracy !== undefined) {
      const accuracy = toNumber(point.accuracy);
      if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100) {
        errors.push({ index, field: 'accuracy', message: 'Accuracy must be between 0 and 100.' });
      }
    }

    if (point.satellites !== undefined) {
      const satellites = Math.trunc(toNumber(point.satellites));
      if (!Number.isFinite(satellites) || satellites < 0 || satellites > 50) {
        errors.push({ index, field: 'satellites', message: 'Satellites must be an integer between 0 and 50.' });
      }
    }
  });

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid device payload.',
      details: errors
    });
  }

  next();
};

const validateCoordinates = [
  body('device').isString().trim().escape(),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('speed').optional().isFloat({ min: 0, max: 1000 }),
  body('altitude').optional().isFloat({ min: -1000, max: 10000 }),
  body('accuracy').optional().isFloat({ min: 0, max: 100 }),
  body('satellites').optional().isInt({ min: 0, max: 50 })
];

const validateSettings = [
  body('deviceId').isString().trim().escape(),
  body('interval_gps').isInt({ min: 1, max: 3600 * 24 * 30 }).withMessage('GPS interval must be a valid integer of seconds (min 1s, max 30 days).'),
  body('interval_send').isInt({ min: 1, max: 3600 * 24 * 30 }).withMessage('Send interval must be a valid integer of seconds (min 1s, max 30 days).'),
  body('satellites').isInt({ min: 1, max: 50 }).withMessage('Satellites must be a valid integer (min 1, max 50).'),
  body('mode').isIn(['simple', 'batch']).withMessage('Mode must be either "simple" or "batch".')
];

module.exports = {
    validateCoordinates,
  validateSettings,
  validateDeviceInputPayload
}; 