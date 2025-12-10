const { getRequestLogger } = require('../utils/requestLogger');

function hasUserSession(req) {
  return Boolean(req.session?.isAuthenticated && req.session?.user);
}

const isAuthenticated = (req, res, next) => {
  if (hasUserSession(req)) {
    return next();
  }
  req.flash?.('error', 'Please log in to view this page.');
  res.redirect('/login');
};

const isApiAuthenticated = (req, res, next) => {
  if (hasUserSession(req)) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required.' });
};

const isNotRootApi = (req, res, next) => {
  if (hasUserSession(req) && req.session.user.username === 'root') {
    return res.status(403).json({ success: false, error: 'Root user cannot access this API endpoint.' });
  }
  if (hasUserSession(req)) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required.' });
};

const isUser = (req, res, next) => {
  if (hasUserSession(req) && req.session.user.username !== 'root') {
    return next();
  }
  if (hasUserSession(req) && req.session.user.username === 'root') {
    return res.redirect('/administration');
  }
  
  if (req.path === '/') {
    return res.redirect('/login');
  }

  req.flash?.('error', 'Please log in to view this page.');
  res.redirect('/login');
};

const isRoot = (req, res, next) => {
  if (hasUserSession(req) && req.session.user.username === 'root') {
    return next();
  }
  if (hasUserSession(req) && req.session.user.username !== 'root') {
    req.flash?.('error', 'You do not have permission to view this page.');
    return res.redirect('/');
  }
  req.flash?.('error', 'Please log in to view this page.');
  res.redirect('/login');
};

const authenticateDevice = async (req, res, next) => {
  const payload = Array.isArray(req.body) ? req.body[0] : req.body;
  const deviceId = payload?.device || payload?.device_id || payload?.deviceId || null;
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
    req.user = user;
    req.clientType = device.device_type || (clientTypeFromRequest ? String(clientTypeFromRequest).trim().toUpperCase() : null);
    log.info('Device authenticated', { userId: user.id, clientType: req.clientType });
    next();

  } catch (error) {
    log.error('Error in authenticateDevice middleware', error);
    res.status(500).json({ success: false, error: 'Internal server error during device authentication.' });
  }
};

module.exports = { isAuthenticated, isUser, isRoot, authenticateDevice, isApiAuthenticated, isNotRootApi };