const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailSender');
const { getRequestLogger } = require('../utils/requestLogger');

const passwordRequirements = [
            { regex: /.{6,}/, message: 'Password must be at least 6 characters long.' },
            { regex: /[A-Z]/, message: 'Password must contain at least one uppercase letter.' },
            { regex: /[0-9]/, message: 'Password must contain at least one number.' },
            { regex: /[^A-Za-z0-9]/, message: 'Password must contain at least one special character.' }
        ];

const getLoginPage = (req, res) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  
  let successMessage = req.flash('success'); // Retrieve existing flash messages
  
  if (req.query.message === 'account_deleted') {
      if (successMessage.length === 0) {
          successMessage = ['Your account has been successfully deleted.'];
      } else {
          successMessage.push('Your account has been successfully deleted.');
      }
  }

  res.render('login', { error: req.flash('error'), success: successMessage, currentPage: 'login' });
};

const loginUser = async (req, res) => {
  const { identifier, password } = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'loginUser', identifier });
  log.info('Login attempt received');

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
      log.warn('Login failed: user not found');
      return res.status(401).render('login', { error: 'Invalid login credentials.', currentPage: 'login' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
      if (!user.is_verified) {
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.action_token = code;
        user.action_token_expires = expires;
        user.action_type = 'VERIFY_EMAIL';
        await user.save();

        try {
          await sendVerificationEmail(user.email, code);
        } catch (mailErr) {
          log.error('Error sending verification email', mailErr);
          req.flash('error', 'Failed to send verification email. Please try again.');
          return res.redirect('/login');
        }

        req.session.pendingUserId = user.id;
        req.flash('error', 'Your account is not verified. A new verification code has been sent to your email.');
        return res.redirect('/verify-email');
      }

      req.session.isAuthenticated = true;
      req.session.user = { id: user.id, username: user.username, email: user.email };
      log.info('User logged in successfully', { userId: user.id });

      if (user.username === 'root') {
        return res.redirect('/administration');
      }
      res.redirect('/');
    } else {
      log.warn('Login failed: password mismatch');
      return res.status(401).render('login', { error: 'Invalid login credentials.', currentPage: 'login' });
    }
  } catch (err) {
    log.error('Error during login', err);
    res.status(500).render('login', { error: 'Server error occurred. Please try again later.', currentPage: 'login' });
  }
};

const logoutUser = (req, res) => {
  const log = getRequestLogger(req, { controller: 'auth', action: 'logoutUser' });
  req.session.destroy(err => {
    if (err) {
      log.error('Logout error', err);
      return res.redirect('/');
    }
    log.info('User logged out');
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
  const log = getRequestLogger(req, { controller: 'auth', action: 'registerUser', username, email });
  log.info('Registration attempt received');

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
    // password requirements
    for (const req of passwordRequirements) {
      if (!req.regex.test(password)) {
        return res.status(400).render('register', { error: req.message, currentPage: 'register', input });
      }
    }
  } else {
    // weak password allowed
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
      action_token: code,
      action_token_expires: expires,
      action_type: 'VERIFY_EMAIL'
    });

    try {
      await sendVerificationEmail(email, code);
    } catch (mailErr) {
      log.error('Error sending verification email during registration', mailErr);
      req.flash('error', 'Failed to send verification email.');
      return res.redirect('/register');
    }

    req.session.pendingUserId = newUser.id;
    return res.redirect('/verify-email');

  } catch (err) {
    log.error('Registration error', err);
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
  const log = getRequestLogger(req, { controller: 'auth', action: 'verifyEmailCode', userId });
  log.info('Verifying email code');

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

    // Check for code expiration and validity
    if (!user.action_token || !user.action_token_expires || new Date() > user.action_token_expires || user.action_type !== 'VERIFY_EMAIL') {
      req.flash('error', 'Verification code has expired or is invalid. Please request a new one.');
      return res.redirect(req.session.pendingEmailChange ? '/settings' : '/login');
    }

    // Check if code matches
    if (user.action_token !== code) {
      req.flash('error', 'The provided code is incorrect.');
      return res.redirect('/verify-email');
    }

    // --- Success Scenarios ---

    // Case 1: Email Change Verification
    if (req.session.pendingEmailChange && user.pending_email) {
      await user.update({
        email: user.pending_email,
        pending_email: null,
        action_token: null,
        action_token_expires: null,
        action_type: null
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
        action_token: null, 
        action_token_expires: null,
        action_type: null
      });

      req.session.isAuthenticated = true;
      req.session.user = { id: user.id, username: user.username, email: user.email };
      delete req.session.pendingUserId;

      return res.redirect('/');
    }
    
    // Fallback redirect if state is unclear
    return res.redirect('/login');

  } catch (err) {
    log.error('Error verifying email', err);
    return res.render('verify-email', { error: 'Server error occurred.', currentPage: 'verify-email' });
  }
};




const loginApk = async (req, res) => {

    const { identifier, password, installationId } = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'loginApk', identifier, installationId });
  log.info('APK login attempt');

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

        if (!user.is_verified) {
          return res.status(403).json({ success: false, error: 'Account not verified. Please verify your email before using the APK client.' });
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

        log.info('APK login successful', { userId: user.id, deviceIsRegistered: device_is_registered });

        // Step 5: Send response with new flag
        res.status(200).json({ success: true, device_is_registered: device_is_registered });

    } catch (error) {
        log.error('Error during APK login', error);
        res.status(500).json({ success: false, error: 'Internal server error.' });
    }
};

const logoutApk = (req, res) => {
      const log = getRequestLogger(req, { controller: 'auth', action: 'logoutApk' });
      req.session.destroy(err => {
        if (err) {
          log.error('API logout error', err);
          return res.status(500).json({ success: false, error: 'Error during logout.' });
        }
        log.info('APK logout successful');
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
    const log = getRequestLogger(req, { controller: 'auth', action: 'resendVerificationCodeFromPage', userId });
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

    user.action_token = code;
    user.action_token_expires = expires;
    user.action_type = 'VERIFY_EMAIL';
    await user.save();

    await sendVerificationEmail(targetEmail, code);

    log.info('Verification code resent');
    req.flash('success', 'New verification code sent to your email.');
    res.redirect('/verify-email');
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'auth', action: 'resendVerificationCodeFromPage', userId });
    log.error('Error during resend from page', err);
    req.flash('error', 'Error during server.');
    res.redirect('/verify-email');
  }
};

const setInitialPassword = async (req, res) => {
    const { newPassword, confirmPassword, use_weak_password } = req.body;
    const userId = req.session.user.id;
  const log = getRequestLogger(req, { controller: 'auth', action: 'setInitialPassword', userId });

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

        log.info('Initial password set');
        req.flash('success', 'Your password has been set successfully! You can now use it for external devices.');
        res.redirect('/');

    } catch (err) {
        log.error('Error setting initial password', err);
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
    const log = getRequestLogger(req, { controller: 'auth', action: 'cancelEmailChange', userId });
    const user = await db.User.findByPk(userId);

    if (user) {
      await user.update({
        pending_email: null,
        action_token: null,
        action_token_expires: null,
        action_type: null
      });
    }

    delete req.session.pendingUserId;
    delete req.session.pendingEmailChange;

    log.info('Pending email change canceled');
    req.flash('success', 'Email change has been successfully canceled.');
    res.redirect('/settings');
  } catch (err) {
    const log = getRequestLogger(req, { controller: 'auth', action: 'cancelEmailChange', userId });
    log.error('Error canceling email change', err);
    req.flash('error', 'An error occurred while canceling the email change.');
    res.redirect('/settings');
  }
};

const getForgotPasswordPage = (req, res) => {
  res.render('forgot-password', { error: req.flash('error'), success: req.flash('success') });
};

const sendPasswordResetLink = async (req, res) => {
  const { email } = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'sendPasswordResetLink', email });

  if (!email) {
    req.flash('error', 'Please enter your email address.');
    return res.redirect('/forgot-password');
  }

  try {
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      log.info('Password reset requested for non-existent email');
      req.flash('success', 'If an account with that email exists, a reset link has been sent.');
      return res.redirect('/forgot-password');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1 hour

    user.action_token = token;
    user.action_token_expires = expires;
    user.action_type = 'RESET_PASSWORD';
    await user.save();

    const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    await sendPasswordResetEmail(user.email, resetLink);

    log.info('Password reset link sent');
    req.flash('success', 'If an account with that email exists, a reset link has been sent.');
    res.redirect('/forgot-password');

  } catch (err) {
    log.error('Error sending reset link', err);
    req.flash('error', 'An error occurred. Please try again later.');
    res.redirect('/forgot-password');
  }
};

const getResetPasswordPage = async (req, res) => {
  const { token } = req.params;
  const log = getRequestLogger(req, { controller: 'auth', action: 'getResetPasswordPage' });

  try {
    const user = await db.User.findOne({
      where: {
        action_token: token,
        action_type: 'RESET_PASSWORD',
        action_token_expires: { [db.Sequelize.Op.gt]: new Date() }
      }
    });

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot-password');
    }

    res.render('reset-password', { token, error: req.flash('error') });

  } catch (err) {
    log.error('Error rendering reset page', err);
    req.flash('error', 'An error occurred.');
    res.redirect('/forgot-password');
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword, use_weak_password } = req.body;
  const log = getRequestLogger(req, { controller: 'auth', action: 'resetPassword' });

  if (!password || !confirmPassword) {
    req.flash('error', 'Both password fields are required.');
    return res.redirect(`/reset-password/${token}`);
  }

  if (password !== confirmPassword) {
    req.flash('error', 'Passwords do not match.');
    return res.redirect(`/reset-password/${token}`);
  }

  try {
    const user = await db.User.findOne({
      where: {
        action_token: token,
        action_type: 'RESET_PASSWORD',
        action_token_expires: { [db.Sequelize.Op.gt]: new Date() }
      }
    });

    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot-password');
    }

    // Password complexity check
    if (!use_weak_password) {
        for (const requirement of passwordRequirements) {
            if (!requirement.regex.test(password)) {
                req.flash('error', requirement.message);
                return res.redirect(`/reset-password/${token}`);
            }
        }
    } else {
        if (password.length < 3) {
            req.flash('error', 'Weak password must be at least 3 characters long.');
            return res.redirect(`/reset-password/${token}`);
        }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.action_token = null;
    user.action_token_expires = null;
    user.action_type = null;
    await user.save();

    log.info('Password reset successful', { userId: user.id });
    req.flash('success', 'Your password has been changed. You can now login.');
    res.redirect('/login');

  } catch (err) {
    log.error('Error resetting password', err);
    req.flash('error', 'An error occurred while resetting your password.');
    res.redirect(`/reset-password/${token}`);
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
  cancelEmailChange,
  getForgotPasswordPage,
  sendPasswordResetLink,
  getResetPasswordPage,
  resetPassword
};