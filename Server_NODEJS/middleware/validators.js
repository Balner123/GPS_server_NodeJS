const { body } = require('express-validator');

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
  body('interval_send').isInt({ min: 1, max: 3600 * 24 * 30 }).withMessage('Send interval must be a valid integer of seconds (min 1s, max 30 days).')
];

module.exports = {
    validateCoordinates,
    validateSettings
}; 