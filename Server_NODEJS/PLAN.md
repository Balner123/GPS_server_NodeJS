# Refactoring Plan: Unified Action Token System

**Objective:** Replace multiple specific token columns (`verification_code`, `deletion_code`, `reset_password_token`, and their expiry dates) with a single generic set of columns to optimize database structure.

## 1. Database Model Update (`models/user.js`)
- [ ] **Add New Columns:**
    - `action_token` (String, nullable) - Stores the code or token.
    - `action_token_expires` (Date, nullable) - Stores the expiration time.
    - `action_type` (String, nullable) - Identifies the purpose of the token. 
        - Valid values: `'VERIFY_EMAIL'`, `'RESET_PASSWORD'`, `'DELETE_ACCOUNT'`.
- [ ] **Remove Old Columns:**
    - `verification_code`, `verification_expires`
    - `deletion_code`, `deletion_code_expires`
    - `reset_password_token`, `reset_password_expires`

## 2. Refactor `controllers/authController.js`
- [ ] **Registration (`registerUser`):** Use `action_token` with type `'VERIFY_EMAIL'`.
- [ ] **Login (`loginUser`):** Check `is_verified`. If sending a new code, use `action_token` / `'VERIFY_EMAIL'`.
- [ ] **Email Verification (`verifyEmailCode`):** 
    - Validate against `action_token` and `action_token_expires`.
    - Ensure `action_type` is `'VERIFY_EMAIL'`.
- [ ] **Resend Verification (`resendVerificationCodeFromPage`):** Update to use new columns.
- [ ] **Password Reset (`sendPasswordResetLink`):** 
    - Generate token.
    - Save to `action_token`, set type to `'RESET_PASSWORD'`.
- [ ] **Password Reset Page (`getResetPasswordPage`):** Query by `action_token` and type `'RESET_PASSWORD'`.
- [ ] **Password Reset Logic (`resetPassword`):** 
    - Validate token and type.
    - Clear columns upon success.
- [ ] **Cancel Email Change (`cancelEmailChange`):** Clear new columns.

## 3. Refactor `controllers/settingsController.js`
- [ ] **Update Email (`updateEmail`):** 
    - Set `pending_email`.
    - Generate code, save to `action_token`, type `'VERIFY_EMAIL'`.
- [ ] **Delete Account Request (`deleteAccount`):** 
    - Generate code, save to `action_token`, type `'DELETE_ACCOUNT'`.
- [ ] **Confirm Deletion (`confirmDeleteAccount`):** 
    - Validate against `action_token` and type `'DELETE_ACCOUNT'`.
- [ ] **Resend Deletion Code (`resendDeletionCode`):** Update to use new columns.
- [ ] **Cancel Deletion (`cancelDeleteAccount`):** Clear new columns.

## 4. Verification
- [ ] Verify Registration flow.
- [ ] Verify Email Change flow.
- [ ] Verify Password Reset flow.
- [ ] Verify Account Deletion flow.
