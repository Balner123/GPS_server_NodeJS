const bcrypt = require('bcryptjs');
const db = require('../database');
const { sendVerificationEmail } = require('../utils/emailSender');

const getLoginPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  res.render('login', { error: null, currentPage: 'login' });
};

const loginUser = async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).render('login', { error: 'Please enter your username or email and password.', currentPage: 'login' });
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
      return res.status(401).render('login', { error: 'Invalid login credentials.', currentPage: 'login' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      if (!user.is_verified) {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.verification_code = code;
        user.verification_expires = expires;
        await user.save();

        try {
          await sendVerificationEmail(user.email, code);
        } catch (mailErr) {
          console.error('Error sending email:', mailErr);
          req.flash('error', 'Failed to send verification email. Please try again.');
          return res.redirect('/login');
        }

        req.session.pendingUserId = user.id;
        req.flash('error', 'Your account is not verified. A new verification code has been sent to your email.');
        return res.redirect('/verify-email');
      }

      req.session.isAuthenticated = true;
      req.session.user = { id: user.id, username: user.username, email: user.email };

      if (user.username === 'root') {
        return res.redirect('/administration');
      }
      res.redirect('/');
    } else {
      return res.status(401).render('login', { error: 'Invalid login credentials.', currentPage: 'login' });
    }
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).render('login', { error: 'Server error occurred. Please try again later.', currentPage: 'login' });
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
    return res.status(400).render('register', { error: 'All fields are required.', currentPage: 'register', input });
  }

  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).render('register', { error: 'Please enter a valid email.', currentPage: 'register', input });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('register', { error: 'Passwords do not match.', currentPage: 'register', input });
  }

  // --- Password Validation ---
  if (!use_weak_password) {
    // Strict password requirements
    const passwordRequirements = [
      { regex: /.{6,}/, message: 'Password must be at least 6 characters long.' },
      { regex: /[A-Z]/, message: 'Password must contain at least one uppercase letter.' },
      { regex: /[0-9]/, message: 'Password must contain at least one number.' },
      { regex: /[^A-Za-z0-9]/, message: 'Password must contain at least one special character.' }
    ];
    for (const req of passwordRequirements) {
      if (!req.regex.test(password)) {
        return res.status(400).render('register', { error: req.message, currentPage: 'register', input });
      }
    }
  } else {
    // Weak password requirement
    if (password.length < 3) {
      return res.status(400).render('register', { error: 'Weak password must be at least 3 characters long.', currentPage: 'register', input });
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
      return res.status(409).render('register', { error: 'User with this username or email already exists.', currentPage: 'register', input });
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

    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      console.error('Error sending verification email:', mailErr);
      req.flash('error', 'Failed to send verification email.');
      return res.redirect('/register');
    }

    req.session.pendingUserId = newUser.id;
    return res.redirect('/verify-email');

  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).render('register', { error: 'Server error occurred during registration.', currentPage: 'register', input });
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
    req.flash('error', 'Session expired. Please try again.');
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
      req.flash('error', 'Verification code has expired. Please request a new one.');
      return res.redirect(req.session.pendingEmailChange ? '/settings' : '/login');
    }

    // Check if code matches
    if (user.verification_code !== code) {
      req.flash('error', 'The provided code is incorrect.');
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

      req.flash('success', 'Email has been successfully changed.');
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
    console.error('Error verifying email:', err);
    return res.render('verify-email', { error: 'Server error occurred.', currentPage: 'verify-email' });
  }
};




const loginApk = async (req, res) => {

    const { identifier, password, installationId } = req.body;

    if (!identifier || !password) {
        return res.status(400).json({ success: false, error: 'Missing username or password.' });
    }
    // Check if the client sent the installation ID
    if (!installationId) {
        return res.status(400).json({ success: false, error: 'Missing installation ID (installationId).' });
    }

    try {
        // Step 2: Verify user using Sequelize
        const user = await db.User.findOne({
            where: {
                [db.Sequelize.Op.or]: [{ username: identifier }, { email: identifier }]
            }
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, error: 'Invalid password.' });
        }

        // Step 3: Create session
        req.session.isAuthenticated = true; // Important for authorizing further requests
        req.session.user = { id: user.id, username: user.username, email: user.email };

        // Step 4: Check if the device is already registered (using Sequelize)
        const device = await db.Device.findOne({ // Assuming the model is named 'Device'
            where: {
                user_id: user.id,
                device_id: installationId // Using the column name from init-db.sql
            }
        });

        const device_is_registered = !!device; // Convert to boolean (true if device is not null)

        // Step 5: Send response with new flag
        res.status(200).json({ success: true, device_is_registered: device_is_registered });

    } catch (error) {
        console.error('Error during APK login:', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

const logoutApk = (req, res) => {
      req.session.destroy(err => {
        if (err) {
          console.error("API Logout error:", err);
          return res.status(500).json({ success: false, error: 'Error during logout.' });
        }
        res.clearCookie('connect.sid');
        res.status(200).json({ success: true, message: 'Logout successful.' });
      });
    };

const resendVerificationCodeFromPage = async (req, res) => {
  const userId = req.session.pendingUserId;
  if (!userId) {
    req.flash('error', 'Relation expired. Please log in again.');
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
        req.flash('error', 'This account is already verified.');
        return res.redirect('/login');
    }

    const targetEmail = isEmailChange ? user.pending_email : user.email;
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    user.verification_code = code;
    user.verification_expires = expires;
    await user.save();

    await sendVerificationEmail(targetEmail, code);

    req.flash('success', 'New verification code sent to your email.');
    res.redirect('/verify-email');
  } catch (err) {
    console.error("Error during resend from page:", err);
    req.flash('error', 'Error during server.');
    res.redirect('/verify-email');
  }
};

const setInitialPassword = async (req, res) => {
    const { newPassword, confirmPassword, use_weak_password } = req.body;
    const userId = req.session.user.id;

    try {
        const user = await db.User.findByPk(userId);

        if (!user || user.provider === 'local' || (user.password && user.password.trim() !== '')) {
            req.flash('error', 'This action is not applicable for your account.');
            return res.redirect('/');
        }

        if (!newPassword || !confirmPassword) {
            req.flash('error', 'Both password fields are required.');
            return res.redirect('/set-password');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/set-password');
        }

        // --- Password Validation ---
        if (!use_weak_password) {
            const passwordRequirements = [
                { regex: /.{6,}/, message: 'Password must be at least 6 characters long.' },
                { regex: /[A-Z]/, message: 'Password must contain at least one uppercase letter.' },
                { regex: /[0-9]/, message: 'Password must contain at least one number.' },
                { regex: /[^A-Za-z0-9]/, message: 'Password must contain at least one special character.' }
            ];
            for (const requirement of passwordRequirements) {
                if (!requirement.regex.test(newPassword)) {
                    req.flash('error', requirement.message);
                    return res.redirect('/set-password');
                }
            }
        } else {
            if (newPassword.length < 3) {
                req.flash('error', 'Weak password must be at least 3 characters long.');
                return res.redirect('/set-password');
            }
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: newHash });

        req.flash('success', 'Your password has been set successfully! You can now use it for external devices.');
        res.redirect('/');

    } catch (err) {
        console.error("Error setting initial password:", err);
        req.flash('error', 'An error occurred while setting your password.');
        res.redirect('/set-password');
    }
};

const cancelEmailChange = async (req, res) => {
  const userId = req.session.pendingUserId;

  if (!userId) {
    req.flash('error', 'Session expired or no pending email change to cancel.');
    return res.redirect('/settings');
  }

  try {
    const user = await db.User.findByPk(userId);

    if (user) {
      await user.update({
        pending_email: null,
        verification_code: null,
        verification_expires: null
      });
    }

    delete req.session.pendingUserId;
    delete req.session.pendingEmailChange;

    req.flash('success', 'Email change has been successfully canceled.');
    res.redirect('/settings');
  } catch (err) {
    console.error('Error canceling email change:', err);
    req.flash('error', 'An error occurred while canceling the email change.');
    res.redirect('/settings');
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
  resendVerificationCodeFromPage,
  setInitialPassword,
  cancelEmailChange
};