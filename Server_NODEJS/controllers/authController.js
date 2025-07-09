const bcrypt = require('bcryptjs');
const db = require('../database');

const getLoginPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('login', { error: null, currentPage: 'login' });
};

const loginUser = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).render('login', { error: 'Prosím, zadejte uživatelské jméno i heslo.', currentPage: 'login' });
  }

  try {
    const user = await db.User.findOne({ where: { username } });

    if (!user) {
      // General error message for security
      return res.status(401).render('login', { error: 'Neplatné přihlašovací údaje.', currentPage: 'login' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      req.session.isAuthenticated = true;
      req.session.user = {
        id: user.id,
        username: user.username
      };

      // Přesměrování na základě role
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

const getRegisterPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('register', { error: null, currentPage: 'register' });
};

const registerUser = async (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password || !confirmPassword) {
    return res.status(400).render('register', { error: 'Všechna pole jsou povinná.', currentPage: 'register' });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Hesla se neshodují.', currentPage: 'register' });
  }

  try {
    const existingUser = await db.User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(409).render('register', { error: 'Uživatel s tímto jménem již existuje.', currentPage: 'register' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await db.User.create({
      username,
      password: hashedPassword,
    });

    req.session.isAuthenticated = true;
    req.session.user = { id: newUser.id, username: newUser.username };
    res.redirect('/');

  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).render('register', { error: 'Došlo k chybě serveru při registraci.', currentPage: 'register' });
  }
};


module.exports = {
  getLoginPage,
  loginUser,
  logoutUser,
  getRegisterPage,
  registerUser,
}; 