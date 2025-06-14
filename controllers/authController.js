const bcrypt = require('bcryptjs');
const { getPasswordHash } = require('../config/auth-config');

const getLoginPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('login', { error: null, currentPage: 'login' });
};

const loginUser = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.render('login', { error: 'Please enter the password.', currentPage: 'login' });
  }

  try {
    const passwordHash = await getPasswordHash();
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (isMatch) {
      req.session.isAuthenticated = true;
      return res.redirect('/');
    } else {
      return res.render('login', { error: 'Invalid password.', currentPage: 'login' });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).render('login', { error: 'A server error occurred. Please try again later.', currentPage: 'login' });
  }
};

const logoutUser = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error("Logout error:", err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};

module.exports = {
  getLoginPage,
  loginUser,
  logoutUser,
}; 