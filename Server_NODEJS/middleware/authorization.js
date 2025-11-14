const { getRequestLogger } = require('../utils/requestLogger');

const isAuthenticated = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return next();
  }
  res.redirect('/login');
};

const isApiAuthenticated = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required.' });
};

const isUser = (req, res, next) => {
  if (req.session.isAuthenticated && req.session.user.username !== 'root') {
    return next();
  }
  // If root user tries to access user pages, redirect them to their dashboard
  if (req.session.isAuthenticated && req.session.user.username === 'root') {
      return res.redirect('/administration');
  }
  req.flash('error', 'Please log in to view this page.');
  res.redirect('/login');
};

const isRoot = (req, res, next) => {
  if (req.session.isAuthenticated && req.session.user.username === 'root') {
    return next();
  }
   // If a normal user tries to access admin page, redirect to their dashboard
  if (req.session.isAuthenticated && req.session.user.username !== 'root') {
      req.flash('error', 'You do not have permission to view this page.');
      return res.redirect('/');
  }
  req.flash('error', 'Please log in to view this page.');
  res.redirect('/login');
};

const authenticateDevice = async (req, res, next) => {
  const deviceId = req.body.device || (Array.isArray(req.body) && req.body.length > 0 ? req.body[0].device : null);
  const log = getRequestLogger(req, { middleware: 'authenticateDevice', deviceId });

  if (!deviceId) {
    log.warn('Device authentication missing deviceId');
    return res.status(400).json({ success: false, error: 'Device ID is missing in the request body.' });
  }

  try {
    const device = await require('../database').Device.findOne({ where: { device_id: deviceId } });

    if (!device) {
      log.warn('Device not found during authentication');
      return res.status(404).json({ success: false, error: `Device with ID ${deviceId} not found or not registered.` });
    }

    const user = await require('../database').User.findByPk(device.user_id);

    if (!user) {
      // This should ideally not happen if device.user_id is a valid foreign key
      return res.status(500).json({ success: false, error: 'Associated user not found for device.' });
    }

    const clientTypeFromRequest = req.body.client_type || req.body.clientType || (Array.isArray(req.body) && req.body[0] ? req.body[0].client_type || req.body[0].clientType : null);

    req.device = device;
    req.user = user; // Attach the user object associated with the device
    req.clientType = device.device_type || (clientTypeFromRequest ? String(clientTypeFromRequest).trim().toUpperCase() : null);
    log.info('Device authenticated', { userId: user.id, clientType: req.clientType });
    next();

  } catch (error) {
    log.error('Error in authenticateDevice middleware', error);
    res.status(500).json({ success: false, error: 'Internal server error during device authentication.' });
  }
};

module.exports = { isAuthenticated, isUser, isRoot, authenticateDevice, isApiAuthenticated };