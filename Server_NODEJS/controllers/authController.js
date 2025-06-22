const bcrypt = require('bcryptjs');
const db = require('../database');

const getLoginPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('login', { error: null, currentPage: 'login' });
};

const loginUser = async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).render('login', { error: 'Please enter the password.', currentPage: 'login' });
  }

  try {
    const user = await db.User.findOne();

    if (!user) {
      return res.status(401).render('login', { error: 'No password configured in database.', currentPage: 'login' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.isAuthenticated = true;
      req.session.user = { id: user.id };
      return res.redirect('/');
    } else {
      return res.status(401).render('login', { error: 'Invalid password.', currentPage: 'login' });
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