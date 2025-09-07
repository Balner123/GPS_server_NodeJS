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
      return res.status(401).render('login', { error: 'Neplatné přihlašovací údaje.', currentPage: 'login' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      if (!user.is_verified) {
        // User is not verified, generate and send a new code
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.verification_code = code;
        user.verification_expires = expires;
        await user.save();

        const { sendVerificationEmail } = require('../utils/emailSender');
        try {
          await sendVerificationEmail(user.email, code);
        } catch (mailErr) {
          console.error('Chyba při odesílání emailu:', mailErr);
          req.flash('error', 'Nepodařilo se odeslat ověřovací email. Zkuste to prosím znovu.');
          return res.redirect('/login');
        }

        req.session.pendingUserId = user.id;
        req.flash('error', 'Váš účet není ověřen. Na váš e-mail byl zaslán nový ověřovací kód.');
        return res.redirect('/verify-email');
      }

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

const getRegisterPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('register', { error: null, currentPage: 'register', input: {} });
};

const registerUser = async (req, res) => {
  const { username, email, password, confirmPassword, use_weak_password } = req.body;
  const input = req.body;

  if (!username || !email || !password || !confirmPassword) {
    return res.status(400).render('register', { error: 'Všechna pole jsou povinná.', currentPage: 'register', input });
  }

  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).render('register', { error: 'Zadejte platný email.', currentPage: 'register', input });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Hesla se neshodují.', currentPage: 'register', input });
  }

  // --- Password Validation ---
  if (!use_weak_password) {
    // Strict password requirements
    const passwordRequirements = [
      { regex: /.{6,}/, message: 'Heslo musí mít alespoň 6 znaků.' },
      { regex: /[A-Z]/, message: 'Heslo musí obsahovat alespoň jedno velké písmeno.' },
      { regex: /[0-9]/, message: 'Heslo musí obsahovat alespoň jedno číslo.' },
      { regex: /[^A-Za-z0-9]/, message: 'Heslo musí obsahovat alespoň jeden speciální znak.' }
    ];
    for (const req of passwordRequirements) {
      if (!req.regex.test(password)) {
        return res.status(400).render('register', { error: req.message, currentPage: 'register', input });
      }
    }
  } else {
    // Weak password requirement
    if (password.length < 3) {
      return res.status(400).render('register', { error: 'Slabé heslo musí mít alespoň 3 znaky.', currentPage: 'register', input });
    }
  }

  try {
    const existingUser = await db.User.findOne({
      where: {
        [db.Sequelize.Op.or]: [
          { username },
          { email }
        ]
      }
    });
    if (existingUser) {
      return res.status(409).render('register', { error: 'Uživatel s tímto jménem nebo emailem již existuje.', currentPage: 'register', input });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const newUser = await db.User.create({
      username,
      email,
      password: hashedPassword,
      is_verified: false,
      verification_code: code,
      verification_expires: expires
    });

    const { sendVerificationEmail } = require('../utils/emailSender');
    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      console.error('Chyba při odesílání emailu:', mailErr);
      req.flash('error', 'Nepodařilo se odeslat ověřovací email.');
      return res.redirect('/register');
    }

    req.session.pendingUserId = newUser.id;
    return res.redirect('/verify-email');

  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).render('register', { error: 'Došlo k chybě serveru při registraci.', currentPage: 'register', input });
  }
};




const getVerifyEmailPage = (req, res) => {
  res.render('verify-email', { 
    error: req.flash('error'),
    success: req.flash('success'),
    pendingEmailChange: req.session.pendingEmailChange || false
  });
};

const verifyEmailCode = async (req, res) => {
  const { code } = req.body;
  const userId = req.session.pendingUserId;

  if (!userId) {
    req.flash('error', 'Platnost relace vypršela. Prosím, zkuste to znovu.');
    return res.redirect(req.session.pendingEmailChange ? '/settings' : '/login');
  }

  try {
    const user = await db.User.findByPk(userId);

    if (!user) {
      return res.redirect('/login');
    }

    // Prevent verification if user is already verified AND it's not an email change process
    if (user.is_verified && !req.session.pendingEmailChange) {
        return res.redirect('/'); // Already verified, go to dashboard
    }

    // Check for code expiration
    if (!user.verification_code || !user.verification_expires || new Date() > user.verification_expires) {
      req.flash('error', 'Ověřovací kód vypršel. Zkuste to znovu a bude vám zaslán nový kód.');
      return res.redirect(req.session.pendingEmailChange ? '/settings' : '/login');
    }

    // Check if code matches
    if (user.verification_code !== code) {
      req.flash('error', 'Zadaný kód není správný.');
      return res.redirect('/verify-email');
    }

    // --- Success Scenarios ---

    // Case 1: Email Change Verification
    if (req.session.pendingEmailChange && user.pending_email) {
      await user.update({
        email: user.pending_email,
        pending_email: null,
        verification_code: null,
        verification_expires: null
      });

      // Authenticate the user and update session
      req.session.isAuthenticated = true;
      const updatedUser = await db.User.findByPk(userId);
      req.session.user = { id: updatedUser.id, username: updatedUser.username, email: updatedUser.email }; 
      
      delete req.session.pendingUserId;
      delete req.session.pendingEmailChange;

      req.flash('success', 'Email byl úspěšně změněn.');
      return res.redirect('/settings');
    }

    // Case 2: Initial Account Verification
    if (!user.is_verified) {
      await user.update({ 
        is_verified: true, 
        verification_code: null, 
        verification_expires: null 
      });

      req.session.isAuthenticated = true;
      req.session.user = { id: user.id, username: user.username, email: user.email };
      delete req.session.pendingUserId;

      return res.redirect('/');
    }
    
    // Fallback redirect if state is unclear
    return res.redirect('/login');

  } catch (err) {
    console.error('Chyba při ověřování emailu:', err);
    return res.render('verify-email', { error: 'Došlo k chybě serveru.', currentPage: 'verify-email' });
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

const resendVerificationCodeFromPage = async (req, res) => {
  const userId = req.session.pendingUserId;
  if (!userId) {
    req.flash('error', 'Relace vypršela, zkuste to prosím znovu.');
    return res.redirect('/login');
  }

  try {
    const user = await db.User.findByPk(userId);
    if (!user) {
      return res.redirect('/login');
    }

    const isEmailChange = req.session.pendingEmailChange && user.pending_email;

    // Don't resend if account is already verified AND it's not an email change
    if (user.is_verified && !isEmailChange) {
        req.flash('error', 'Tento účet je již ověřen.');
        return res.redirect('/login');
    }

    const targetEmail = isEmailChange ? user.pending_email : user.email;
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.verification_code = code;
    user.verification_expires = expires;
    await user.save();

    const { sendVerificationEmail } = require('../utils/emailSender');
    await sendVerificationEmail(targetEmail, code);

    req.flash('success', 'Nový ověřovací kód byl odeslán na váš email.');
    res.redirect('/verify-email');
  } catch (err) {
    console.error("Error during resend from page:", err);
    req.flash('error', 'Došlo k chybě serveru.');
    res.redirect('/verify-email');
  }
};

module.exports = {
  getLoginPage,
  loginUser,
  logoutUser,
  getRegisterPage,
  registerUser,
  getVerifyEmailPage,
  verifyEmailCode,
  loginApk,
  logoutApk,
  resendVerificationCodeFromPage
};