const { sendVerificationEmail } = require('../utils/emailSender');

const updateEmail = async (req, res) => {
    const { email } = req.body;
    const userId = req.session.user.id;

    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!email || !emailRegex.test(email)) {
        req.flash('error', 'Enter a valid email address.');
        return res.redirect('/settings');
    }

    if (email === req.session.user.email) {
        req.flash('info', 'The entered email is the same as your current one.');
        return res.redirect('/settings');
    }

    try {
        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            req.flash('error', 'This email is already taken by another account.');
            return res.redirect('/settings');
        }

        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        await User.update(
            { pending_email: email, verification_code: code, verification_expires: expires },
            { where: { id: userId } }
        );

        await sendVerificationEmail(email, code);

        req.session.pendingUserId = userId;
        req.session.pendingEmailChange = true; 

        req.flash('success', 'A verification code has been sent to your new email address.');
        return res.redirect('/verify-email');

    } catch (err) {
        console.error("Error updating email:", err);
        req.flash('error', 'An error occurred while changing the email.');
        return res.redirect('/settings');
    }
};
const bcrypt = require('bcryptjs');
const { User } = require('../database');
const { body, validationResult } = require('express-validator');

const getSettingsPage = (req, res) => {
    res.render('settings', {
        currentPage: 'settings',
        user: req.session.user,
        success: req.flash('success'),
        error: req.flash('error')
    });
};

const updateUsername = async (req, res) => {
    const { username } = req.body;
    const userId = req.session.user.id;

    if (!username || username.trim().length === 0) {
        req.flash('error', 'Username cannot be empty.');
        return res.redirect('/settings');
    }

    if (username === req.session.user.username) {
        // No change, just redirect
        return res.redirect('/settings');
    }

    try {
        const existingUser = await User.findOne({ where: { username: username } });
        if (existingUser) {
            req.flash('error', 'This username is already taken.');
            return res.redirect('/settings');
        }
        await User.update({ username: username }, { where: { id: userId } });
        req.session.user.username = username; // Update username in session
        req.flash('success', 'Username has been successfully changed.');
    } catch (err) {
        console.error("Error updating username:", err);
        req.flash('error', 'An error occurred while changing the username.');
    }
    res.redirect('/settings');
};

const updatePassword = async (req, res) => {
    const { oldPassword, newPassword, confirmPassword, use_weak_password } = req.body;
    const userId = req.session.user.id;

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

    try {
        const user = await User.findByPk(userId);
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            req.flash('error', 'Old password is incorrect.');
            return res.redirect('/settings');
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: newHash });
        req.flash('success', 'Password has been successfully changed.');

    } catch (err) {
        console.error("Error changing password:", err);
        req.flash('error', 'An error occurred while changing the password.');
    }
    res.redirect('/settings');
};

const deleteAccount = async (req, res) => {
    const userId = req.session.user.id;
    try {
        await User.destroy({ where: { id: userId } });
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
                // Even if session destruction fails, redirect to login
                return res.redirect('/login');
            }
            res.redirect('/login');
        });
    } catch (err) {
        console.error("Error deleting account:", err);
        req.flash('error', 'An error occurred while deleting the account.');
        res.redirect('/settings');
    }
};


module.exports = {
    getSettingsPage,
    updateUsername,
    updatePassword,
    updateEmail,
    deleteAccount
}; 

