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

module.exports = { isAuthenticated, isUser, isRoot }; 