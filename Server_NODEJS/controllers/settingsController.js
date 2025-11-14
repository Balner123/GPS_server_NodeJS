const { sendVerificationEmail } = require('../utils/emailSender');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { body, validationResult } = require('express-validator');
const { getRequestLogger } = require('../utils/requestLogger');

const getSettingsPage = async (req, res) => {
    try {
        const log = getRequestLogger(req, { controller: 'settings', action: 'getSettingsPage' });
        const user = await db.User.findByPk(req.session.user.id);
        if (!user) {
            req.flash('error', 'User not found.');
            return res.redirect('/login');
        }
        log.info('Settings page rendered');
        res.render('settings', {
            currentPage: 'settings',
            user: user, // Pass the full user object
            success: req.flash('success'),
            error: req.flash('error')
        });
    } catch (err) {
        const log = getRequestLogger(req, { controller: 'settings', action: 'getSettingsPage' });
        log.error('Error fetching user for settings', err);
        req.flash('error', 'An error occurred while loading settings.');
        res.redirect('/');
    }
};

const updateUsername = async (req, res) => {
    const { username } = req.body;
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'updateUsername', userId });

    if (!username || username.trim().length === 0) {
        req.flash('error', 'Username cannot be empty.');
        return res.redirect('/settings');
    }

    if (username === req.session.user.username) {
        // No change, just redirect
        return res.redirect('/settings');
    }

    try {
        const existingUser = await db.User.findOne({ where: { username: username } });
        if (existingUser) {
            req.flash('error', 'This username is already taken.');
            return res.redirect('/settings');
        }
        await db.User.update({ username: username }, { where: { id: userId } });
        req.session.user.username = username; // Update username in session
        req.flash('success', 'Username has been successfully changed.');
        log.info('Username updated');
    } catch (err) {
        log.error('Error updating username', err);
        req.flash('error', 'An error occurred while changing the username.');
    }
    res.redirect('/settings');
};

const updatePassword = async (req, res) => {
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'updatePassword', userId });

    try {
        const user = await db.User.findByPk(userId);

        const { oldPassword, newPassword, confirmPassword, use_weak_password } = req.body;

        if (!oldPassword || !newPassword || !confirmPassword) {
            req.flash('error', 'To change your password, you must fill in all three fields.');
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'New password and confirmation do not match.');
            return res.redirect('/settings');
        }

        // --- Password Validation (copied from registerUser) ---
        if (!use_weak_password) {
            // Strict password requirements
            const passwordRequirements = [
                { regex: /.{6,}/, message: 'New password must be at least 6 characters long.' },
                { regex: /[A-Z]/, message: 'New password must contain at least one uppercase letter.' },
                { regex: /[0-9]/, message: 'New password must contain at least one number.' },
                { regex: /[^A-Za-z0-9]/, message: 'New password must contain at least one special character.' }
            ];
            for (const requirement of passwordRequirements) {
                if (!requirement.regex.test(newPassword)) {
                    req.flash('error', requirement.message);
                    return res.redirect('/settings');
                }
            }
        } else {
            // Weak password requirement
            if (newPassword.length < 3) {
                req.flash('error', 'Weak password must be at least 3 characters long.');
                return res.redirect('/settings');
            }
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            req.flash('error', 'Old password is incorrect.');
            return res.redirect('/settings');
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: newHash });
        req.flash('success', 'Password has been successfully changed.');
        log.info('Password updated');

    } catch (err) {
        log.error('Error changing password', err);
        req.flash('error', 'An error occurred while changing the password.');
    }
    res.redirect('/settings');
};

const updateEmail = async (req, res) => {
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'updateEmail', userId });

    try {
        const user = await db.User.findByPk(userId);
        if (user.provider !== 'local') {
            req.flash('error', 'Email cannot be changed for accounts linked with a third-party provider.');
            return res.redirect('/settings');
        }

        const { email } = req.body;

        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        if (!email || !emailRegex.test(email)) {
            req.flash('error', 'Enter a valid email address.');
            return res.redirect('/settings');
        }

        if (email === user.email) { // Compare with the email from the database
            req.flash('info', 'The entered email is the same as your current one.');
            return res.redirect('/settings');
        }

        const existingUser = await db.User.findOne({ where: { email: email } });
        if (existingUser) {
            req.flash('error', 'This email is already taken by another account.');
            return res.redirect('/settings');
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        await user.update({
            pending_email: email,
            verification_code: code,
            verification_expires: expires
        });

        await sendVerificationEmail(email, code);

        req.session.pendingUserId = userId;
        req.session.pendingEmailChange = true;

        req.flash('success', 'A verification code has been sent to your new email address.');
        log.info('Email change initiated');
        return res.redirect('/verify-email');

    } catch (err) {
        log.error('Error updating email', err);
        req.flash('error', 'An error occurred while changing the email.');
        return res.redirect('/settings');
    }
};

const deleteAccount = async (req, res) => {
    const userId = req.session.user.id;
    try {
        const log = getRequestLogger(req, { controller: 'settings', action: 'deleteAccount', userId });
        const user = await db.User.findByPk(userId);
        if (!user) {
            req.flash('error', 'User not found.');
            return res.redirect('/settings');
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await user.update({
            deletion_code: code,
            deletion_code_expires: expires
        });

        // Send email with deletion code
        await sendVerificationEmail(user.email, code, 'account_deletion'); // 'account_deletion' is a new template type

        req.session.pendingDeletionUserId = userId; // Store user ID in session for deletion confirmation
        req.flash('success', 'A verification code has been sent to your email to confirm account deletion.');
        log.info('Account deletion initiated');
        return res.redirect('/settings/confirm-delete');

    } catch (err) {
        const log = getRequestLogger(req, { controller: 'settings', action: 'deleteAccount', userId });
        log.error('Error initiating account deletion', err);
        req.flash('error', 'An error occurred while initiating account deletion.');
        res.redirect('/settings');
    }
};

const setPassword = async (req, res) => {
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'setPassword', userId });

    try {
        const user = await db.User.findByPk(userId);

        // This action should only be for provider-based users without a password
        if (user.provider === 'local' || (user.password && user.password.trim() !== '')) {
            req.flash('error', 'This action is not applicable for your account.');
            return res.redirect('/settings');
        }

        const { newPassword, confirmPassword, use_weak_password } = req.body;

        if (!newPassword || !confirmPassword) {
            req.flash('error', 'Both password fields are required.');
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/settings');
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
                    return res.redirect('/settings');
                }
            }
        } else {
            if (newPassword.length < 3) {
                req.flash('error', 'Weak password must be at least 3 characters long.');
                return res.redirect('/settings');
            }
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: newHash });

        req.flash('success', 'Your password has been set successfully. You can now use it for external devices.');
        log.info('Password set for federated user');

    } catch (err) {
        log.error('Error setting password', err);
        req.flash('error', 'An error occurred while setting your password.');
    }
    res.redirect('/settings');
};

const disconnect = async (req, res) => {
    const userId = req.session.user.id;
    const log = getRequestLogger(req, { controller: 'settings', action: 'disconnect', userId });

    try {
        const user = await db.User.findByPk(userId);

        if (user.provider === 'local') {
            req.flash('error', 'This action is only available for accounts linked with a third-party provider.');
            return res.redirect('/settings');
        }

        const { newPassword, confirmPassword, use_weak_password } = req.body;

        if (!newPassword || !confirmPassword) {
            req.flash('error', 'To disconnect your account, you must set a new password.');
            return res.redirect('/settings');
        }

        if (newPassword !== confirmPassword) {
            req.flash('error', 'Passwords do not match.');
            return res.redirect('/settings');
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
                    return res.redirect('/settings');
                }
            }
        } else {
            if (newPassword.length < 3) {
                req.flash('error', 'Weak password must be at least 3 characters long.');
                return res.redirect('/settings');
            }
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await user.update({
            password: newHash,
            provider: 'local',
            provider_id: null,
            provider_data: null
        });

        req.session.destroy((err) => {
            if (err) {
                log.error('Error destroying session after disconnect', err);
                return res.redirect('/login');
            }
            res.clearCookie('connect.sid');
            log.info('Account disconnected from provider');
            res.redirect('/login');
        });

    } catch (err) {
        log.error('Error disconnecting account', err);
        req.flash('error', 'An error occurred while disconnecting your account.');
        res.redirect('/settings');
    }
};

const getConfirmDeletePage = (req, res) => {
    if (!req.session.pendingDeletionUserId) {
        req.flash('error', 'No pending account deletion to confirm.');
        return res.redirect('/settings');
    }
    res.render('confirm-delete', {
        currentPage: 'confirm-delete',
        error: req.flash('error'),
        success: req.flash('success')
    });
};

const confirmDeleteAccount = async (req, res) => {
    const userId = req.session.pendingDeletionUserId;
    const { code } = req.body;
    const log = getRequestLogger(req, { controller: 'settings', action: 'confirmDeleteAccount', userId });

    if (!userId) {
        req.flash('error', 'Session expired or no pending deletion.');
        return res.redirect('/settings');
    }

    try {
        const user = await db.User.findByPk(userId);

        if (!user) {
            req.flash('error', 'User not found.');
            delete req.session.pendingDeletionUserId;
            return res.redirect('/settings');
        }

        // Check for code expiration
        if (!user.deletion_code || !user.deletion_code_expires || new Date() > user.deletion_code_expires) {
            req.flash('error', 'Verification code has expired. Please try deleting your account again.');
            delete req.session.pendingDeletionUserId;
            return res.redirect('/settings');
        }

        // Check if code matches
        if (user.deletion_code !== code) {
            req.flash('error', 'The provided code is incorrect.');
            return res.redirect('/settings/confirm-delete');
        }

        // First, delete all devices associated with the user.
        // This will trigger the cascading delete for locations and alerts.
        await db.Device.destroy({ where: { user_id: userId } });

        // Now, it's safe to delete the user.
        await db.User.destroy({ where: { id: userId } });

        delete req.session.pendingDeletionUserId; // Clear pending deletion status

        req.session.destroy((err) => {
            if (err) {
                log.error('Error destroying session after account deletion', err);
                return res.redirect('/login');
            }
            res.clearCookie('connect.sid');
            req.flash('success', 'Your account has been successfully deleted.');
            log.info('Account deleted');
            res.redirect('/login');
        });

    } catch (err) {
        log.error('Error confirming account deletion', err);
        req.flash('error', 'An error occurred while confirming account deletion.');
        res.redirect('/settings/confirm-delete');
    }
};

const resendDeletionCode = async (req, res) => {
    const userId = req.session.pendingDeletionUserId;
    if (!userId) {
        req.flash('error', 'Session expired. Please try deleting your account again.');
        return res.redirect('/settings');
    }

    try {
        const log = getRequestLogger(req, { controller: 'settings', action: 'resendDeletionCode', userId });
        const user = await db.User.findByPk(userId);
        if (!user) {
            req.flash('error', 'User not found.');
            delete req.session.pendingDeletionUserId;
            return res.redirect('/settings');
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await user.update({
            deletion_code: code,
            deletion_code_expires: expires
        });

        await sendVerificationEmail(user.email, code, 'account_deletion');

        log.info('Deletion code resent');
        req.flash('success', 'New verification code sent to your email.');
        res.redirect('/settings/confirm-delete');

    } catch (err) {
        const log = getRequestLogger(req, { controller: 'settings', action: 'resendDeletionCode', userId });
        log.error('Error during resend deletion code', err);
        req.flash('error', 'Error during server.');
        res.redirect('/settings/confirm-delete');
    }
};

const cancelDeleteAccount = async (req, res) => {
    const userId = req.session.pendingDeletionUserId;
    if (!userId) {
        return res.redirect('/settings');
    }

    const log = getRequestLogger(req, { controller: 'settings', action: 'cancelDeleteAccount', userId });

    try {
        const user = await db.User.findByPk(userId);
        if (user) {
            await user.update({
                deletion_code: null,
                deletion_code_expires: null
            });
        }

        delete req.session.pendingDeletionUserId;

        log.info('Account deletion cancelled');
        req.flash('success', 'Account deletion has been successfully cancelled.');
        res.redirect('/settings');

    } catch (err) {
        log.error('Error cancelling account deletion', err);
        req.flash('error', 'An error occurred while cancelling the account deletion.');
        res.redirect('/settings');
    }
};
module.exports = {
    getSettingsPage,
    updateUsername,
    updatePassword,
    updateEmail,
    deleteAccount,
    setPassword,
    disconnect,
    getConfirmDeletePage,
    confirmDeleteAccount,
    resendDeletionCode,
    cancelDeleteAccount
};