const bcrypt = require('bcryptjs');
const db = require('../database');
const { body, validationResult } = require('express-validator');

const getSettingsPage = (req, res) => {
  res.render('settings', {
    currentPage: 'settings',
    success_message: null,
    error_message: null,
    errors: [],
  });
};

const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).render('settings', {
      currentPage: 'settings',
      errors: errors.array(),
      success_message: null,
    });
  }

  const { oldPassword, newPassword } = req.body;

  try {
    const user = await db.User.findOne();

    if (!user) {
      return res.status(404).render('settings', {
        currentPage: 'settings',
        errors: [],
        success_message: null,
        error_message: 'User not found.',
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);

    if (!isMatch) {
      return res.status(400).render('settings', {
        currentPage: 'settings',
        errors: [],
        success_message: null,
        error_message: 'Old password is not correct.',
      });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await user.update({ password: newHash });

    res.render('settings', {
      currentPage: 'settings',
      errors: [],
      success_message: 'Password successfully changed.',
      error_message: null,
    });

  } catch (err) {
    console.error("Error changing password:", err);
    res.status(500).render('settings', {
      currentPage: 'settings',
      errors: [],
      success_message: null,
      error_message: 'An internal server error occurred.',
    });
  }
};

const passwordValidationRules = [
  body('oldPassword').notEmpty().withMessage('Old password cannot be empty.'),
  body('newPassword')
    .isLength({ min: 6 }).withMessage('New password must be at least 6 characters long.')
    .custom((value, { req }) => {
      if (value === req.body.oldPassword) {
        throw new Error('New password cannot be the same as the old password.');
      }
      return true;
    }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match the new password.');
    }
    return true;
  }),
];

module.exports = {
  getSettingsPage,
  changePassword,
  passwordValidationRules,
}; 