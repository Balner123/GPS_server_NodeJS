const bcrypt = require('bcryptjs');
const db = require('../database'); // JEDINÝ SPRÁVNÝ ZPŮSOB IMPORTU DB

// Všechny ostatní funkce používají db.User, db.Sequelize atd.

const getLoginPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('login', { error: null, currentPage: 'login' });
};

const loginUser = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).render('login', { error: 'Prosím, zadejte uživatelské jméno nebo email a heslo.', currentPage: 'login' });
  }

  try {
    const user = await db.User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { username: identifier },
          { email: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(401).render('login', { error: 'Neplatné přihlašovací údaje.', currentPage: 'login' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.isAuthenticated = true;
      req.session.user = {
        id: user.id,
        username: user.username
      };

      if (user.username === 'root') {
        return res.redirect('/administration');
      }
      res.redirect('/');
    } else {
      return res.status(401).render('login', { error: 'Neplatné přihlašovací údaje.', currentPage: 'login' });
    }
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).render('login', { error: 'Došlo k chybě serveru. Zkuste to prosím později.', currentPage: 'login' });
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

const getRegisterPage = (req, res) => { /* ... */ };
const registerUser = async (req, res) => { /* ... */ };
const getVerifyEmailPage = (req, res) => { /* ... */ };
const verifyEmailCode = async (req, res) => { /* ... */ };
const getVerifyEmailChangePage = (req, res) => { /* ... */ };
const verifyEmailChangeCode = async (req, res) => { /* ... */ };


const loginApk = async (req, res) => {
    const { identifier, password, installationId } = req.body;

    if (!identifier || !password || !installationId) {
        return res.status(400).json({ success: false, error: 'Chybí povinné údaje.' });
    }

    try {
        const user = await db.User.findOne({
            where: {
                [db.Sequelize.Op.or]: [{ username: identifier }, { email: identifier }]
            }
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'Uživatel nenalezen.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Nesprávné heslo.' });
        }

        req.session.isAuthenticated = true;
        req.session.user = { id: user.id, username: user.username, role: user.role };

        const device = await db.Device.findOne({
            where: {
                user_id: user.id,
                device_id: installationId
            }
        });

        const device_is_registered = !!device;

        res.status(200).json({ success: true, device_is_registered: device_is_registered });

    } catch (error) {
        console.error('Chyba při přihlašování přes APK:', error);
        res.status(500).json({ success: false, error: 'Interní chyba serveru.' });
    }
};

const logoutApk = (req, res) => {
      req.session.destroy(err => {
        if (err) {
          console.error("API Logout error:", err);
          return res.status(500).json({ success: false, error: 'Chyba při odhlašování.' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Odhlášení úspěšné.' });
      });
    };

module.exports = {
  getLoginPage,
  loginUser,
  logoutUser,
  getRegisterPage,
  registerUser,
  getVerifyEmailPage,
  verifyEmailCode,
  getVerifyEmailChangePage,
  verifyEmailChangeCode,
  loginApk,
  logoutApk
};