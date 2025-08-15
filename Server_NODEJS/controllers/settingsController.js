const { sendVerificationEmail } = require('../utils/emailSender');

const updateEmail = async (req, res) => {
    const { email } = req.body;
    const userId = req.session.user.id;

    // Validace emailu
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!email || !emailRegex.test(email)) {
        req.flash('error', 'Zadejte platný email.');
        return res.redirect('/settings');
    }

    if (email === req.session.user.email) {
        // No change
        return res.redirect('/settings');
    }

    try {
        const existingUser = await User.findOne({ where: { email: email } });
        if (existingUser) {
            req.flash('error', 'Email je již obsazený jiným účtem.');
            return res.redirect('/settings');
        }
        // Generování ověřovacího kódu
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minut

        // Uložení pending_email, kódu a expirace
        await User.update({ pending_email: email, verification_code: code, verification_expires: expires }, { where: { id: userId } });

        // Odeslání emailu
        try {
            await sendVerificationEmail(email, code);
        } catch (mailErr) {
            console.error('Chyba při odesílání emailu:', mailErr);
            req.flash('error', 'Nepodařilo se odeslat ověřovací email.');
            return res.redirect('/settings');
        }

        // Přesměrování na stránku pro zadání kódu
        req.session.pendingEmailChange = true;
        return res.redirect('/verify-email-change');
    } catch (err) {
        console.error("Error updating email:", err);
        req.flash('error', 'Došlo k chybě při změně emailu.');
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
        req.flash('error', 'Uživatelské jméno nesmí být prázdné.');
        return res.redirect('/settings');
    }

    if (username === req.session.user.username) {
        // No change, just redirect
        return res.redirect('/settings');
    }

    try {
        const existingUser = await User.findOne({ where: { username: username } });
        if (existingUser) {
            req.flash('error', 'Uživatelské jméno je již obsazené.');
            return res.redirect('/settings');
        }
        await User.update({ username: username }, { where: { id: userId } });
        req.session.user.username = username; // Update username in session
        req.flash('success', 'Uživatelské jméno bylo úspěšně změněno.');
    } catch (err) {
        console.error("Error updating username:", err);
        req.flash('error', 'Došlo k chybě při změně jména.');
    }
    res.redirect('/settings');
};

const updatePassword = async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.id;

    if (!oldPassword || !newPassword || !confirmPassword) {
        req.flash('error', 'Pro změnu hesla musíte vyplnit všechna tři pole.');
        return res.redirect('/settings');
    }
    if (newPassword.length < 6) {
        req.flash('error', 'Nové heslo musí mít alespoň 6 znaků.');
        return res.redirect('/settings');
    }
    if (newPassword !== confirmPassword) {
        req.flash('error', 'Nové heslo a jeho potvrzení se neshodují.');
        return res.redirect('/settings');
    }

    try {
        const user = await User.findByPk(userId);
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            req.flash('error', 'Staré heslo není správné.');
            return res.redirect('/settings');
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await user.update({ password: newHash });
        req.flash('success', 'Heslo bylo úspěšně změněno.');

    } catch (err) {
        console.error("Error changing password:", err);
        req.flash('error', 'Došlo k chybě při změně hesla.');
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
        req.flash('error', 'Došlo k chybě při mazání účtu.');
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