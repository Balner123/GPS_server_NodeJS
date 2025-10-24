const isAuthenticated = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return next();
  }
  res.redirect('/login');
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

  if (!deviceId) {
    return res.status(400).json({ success: false, error: 'Device ID is missing in the request body.' });
  }

  try {
    const device = await require('../database').Device.findOne({ where: { device_id: deviceId } });

    if (!device) {
      return res.status(404).json({ success: false, error: `Device with ID ${deviceId} not found or not registered.` });
    }

    const user = await require('../database').User.findByPk(device.user_id);

    if (!user) {
      // This should ideally not happen if device.user_id is a valid foreign key
      return res.status(500).json({ success: false, error: 'Associated user not found for device.' });
    }

    req.device = device;
    req.user = user; // Attach the user object associated with the device
    next();

  } catch (error) {
    console.error('Error in authenticateDevice middleware:', error);
    res.status(500).json({ success: false, error: 'Internal server error during device authentication.' });
  }
};

module.exports = { isAuthenticated, isUser, isRoot, authenticateDevice };