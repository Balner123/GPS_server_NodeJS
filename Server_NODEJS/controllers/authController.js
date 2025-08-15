const bcrypt = require('bcryptjs');
const db = require('../database');

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
  const { username, email, password, confirmPassword } = req.body;


  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).render('register', { error: 'Všechna pole jsou povinná.', currentPage: 'register' });
  }
  // Validace emailu
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).render('register', { error: 'Zadejte platný email.', currentPage: 'register' });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Hesla se neshodují.', currentPage: 'register' });
  }

  // Validace hesla: min. 6 znaků, velké písmeno, číslo, speciální znak
  const passwordRequirements = [
    { regex: /.{6,}/, message: 'Heslo musí mít alespoň 6 znaků.' },
    { regex: /[A-Z]/, message: 'Heslo musí obsahovat alespoň jedno velké písmeno.' },
    { regex: /[0-9]/, message: 'Heslo musí obsahovat alespoň jedno číslo.' },
    { regex: /[^A-Za-z0-9]/, message: 'Heslo musí obsahovat alespoň jeden speciální znak.' }
  ];
  for (const req of passwordRequirements) {
    if (!req.regex.test(password)) {
      return res.status(400).render('register', { error: req.message, currentPage: 'register' });
    }
  }

  try {
    // Kontrola duplicity username/email
    const existingUser = await db.User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { username },
          { email }
        ]
      }
    });
    if (existingUser) {
      return res.status(409).render('register', { error: 'Uživatel s tímto jménem nebo emailem již existuje.', currentPage: 'register' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await db.User.create({
      username,
      email,
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