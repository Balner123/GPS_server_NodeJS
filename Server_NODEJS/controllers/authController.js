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

    // Generování ověřovacího kódu
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minut

    const newUser = await db.User.create({
      username,
      email,
      password: hashedPassword,
      is_verified: false,
      verification_code: code,
      verification_expires: expires
    });

    // Odeslání emailu
    const { sendVerificationEmail } = require('../utils/emailSender');
    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      console.error('Chyba při odesílání emailu:', mailErr);
      req.flash('error', 'Nepodařilo se odeslat ověřovací email.');
      return res.redirect('/register');
    }

    // Přesměrování na stránku pro zadání kódu
    req.session.pendingUserId = newUser.id;
    return res.redirect('/verify-email');

  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).render('register', { error: 'Došlo k chybě serveru při registraci.', currentPage: 'register' });
  }
};




const getVerifyEmailPage = (req, res) => {
  res.render('verify-email', { error: null, currentPage: 'verify-email' });
};

const verifyEmailCode = async (req, res) => {
  const { code } = req.body;
  const userId = req.session.pendingUserId;
  if (!userId) {
    return res.redirect('/register');
  }
  try {
    const user = await db.User.findByPk(userId);
    if (!user || user.is_verified) {
      return res.redirect('/login');
    }
    if (!user.verification_code || !user.verification_expires || new Date() > user.verification_expires) {
      return res.render('verify-email', { error: 'Ověřovací kód expiroval. Zkuste registraci znovu.', currentPage: 'verify-email' });
    }
    if (user.verification_code !== code) {
      return res.render('verify-email', { error: 'Zadaný kód není správný.', currentPage: 'verify-email' });
    }
    // Ověření úspěšné
    await user.update({ is_verified: true, verification_code: null, verification_expires: null });
    req.session.isAuthenticated = true;
    req.session.user = { id: user.id, username: user.username, email: user.email };
    delete req.session.pendingUserId;
    return res.redirect('/');
  } catch (err) {
    console.error('Chyba při ověřování emailu:', err);
    return res.render('verify-email', { error: 'Došlo k chybě serveru.', currentPage: 'verify-email' });
  }
};


const getVerifyEmailChangePage = (req, res) => {
  // Pokud není změna emailu zahájena, přesměruj zpět
  if (!req.session.pendingEmailChange) {
    return res.redirect('/settings');
  }
  res.render('verify-email', { error: null, currentPage: 'verify-email-change' });
};

const verifyEmailChangeCode = async (req, res) => {
  const { code } = req.body;
  const userId = req.session.user.id;
  if (!req.session.pendingEmailChange) {
    return res.redirect('/settings');
  }
  try {
    const user = await db.User.findByPk(userId);
    if (!user || !user.pending_email) {
      req.session.pendingEmailChange = null;
      return res.redirect('/settings');
    }
    if (!user.verification_code || !user.verification_expires || new Date() > user.verification_expires) {
      req.session.pendingEmailChange = null;
      return res.render('verify-email', { error: 'Ověřovací kód expiroval. Zkuste změnu emailu znovu.', currentPage: 'verify-email-change' });
    }
    if (user.verification_code !== code) {
      return res.render('verify-email', { error: 'Zadaný kód není správný.', currentPage: 'verify-email-change' });
    }
    // Ověření úspěšné, změna emailu
    await user.update({ email: user.pending_email, pending_email: null, verification_code: null, verification_expires: null });
    req.session.user.email = user.email;
    req.session.pendingEmailChange = null;
    req.flash('success', 'Email byl úspěšně změněn.');
    return res.redirect('/settings');
  } catch (err) {
    console.error('Chyba při ověřování změny emailu:', err);
    return res.render('verify-email', { error: 'Došlo k chybě serveru.', currentPage: 'verify-email-change' });
  }
};

const loginApk = async (req, res) => {
    // Krok 1: Získání všech potřebných dat z těla požadavku
    const { identifier, password, installationId } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: 'Chybí uživatelské jméno nebo heslo.' });
    }
    // Kontrola, zda klient poslal ID instalace
    if (!installationId) {
        return res.status(400).json({ success: false, error: 'Chybí identifikační kód instalace (installationId).' });
    }

    try {
        // Krok 2: Ověření uživatele pomocí Sequelize
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

        // Krok 3: Vytvoření session
        req.session.isAuthenticated = true; // Důležité pro autorizaci dalších požadavků
        req.session.user = {
            id: user.id,
            username: user.username,
            role: user.role // Přidáno pro konzistenci
        };

        // Krok 4: Kontrola, zda je zařízení již registrováno (pomocí Sequelize)
        const device = await db.Device.findOne({ // Předpokládám, že model se jmenuje 'Device'
            where: {
                user_id: user.id,
                device_id: installationId // Používám název sloupce z init-db.sql
            }
        });

        const device_is_registered = !!device; // Převod na boolean (true pokud device není null)

        // Krok 5: Odeslání odpovědi s novým flagem
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