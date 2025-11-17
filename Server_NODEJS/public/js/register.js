
        document.addEventListener('DOMContentLoaded', function() {
            setupHoldToShow('password', 'togglePassword');
            setupHoldToShow('confirmPassword', 'toggleConfirmPassword');

            // --- Client-Side Validation Script ---
            const form = document.querySelector('form');
            const email = document.getElementById('email');
            const password = document.getElementById('password');
            const confirmPassword = document.getElementById('confirmPassword');
            const useWeakPassword = document.getElementById('use_weak_password');
            const submitButton = form.querySelector('button[type="submit"]');

            const passwordRequirements = [
                { regex: /.{6,}/, message: 'At least 6 characters.' },
                { regex: /[A-Z]/, message: 'At least one uppercase letter.' },
                { regex: /[0-9]/, message: 'At least one number.' },
                { regex: /[^A-Za-z0-9]/, message: 'At least one special character.' }
            ];

            function createFeedbackElement(field) {
                let feedback = field.parentElement.querySelector('.invalid-feedback');
                if (!feedback) {
                    feedback = document.createElement('div');
                    feedback.className = 'invalid-feedback';
                    const parent = field.parentElement.classList.contains('input-group') ? field.parentElement : field;
                    parent.insertAdjacentElement('afterend', feedback);
                }
                return feedback;
            }

            const emailFeedback = createFeedbackElement(email);
            const passwordFeedback = createFeedbackElement(password);
            const confirmPasswordFeedback = createFeedbackElement(confirmPassword);

            function validateForm() {
                let errors = [];

                const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
                if (!emailRegex.test(email.value)) {
                    errors.push({ field: email, feedback: emailFeedback, message: 'Enter a valid email.' });
                } else {
                    email.classList.remove('is-invalid');
                }

                if (useWeakPassword.checked) {
                    if (password.value.length < 3) {
                        errors.push({ field: password, feedback: passwordFeedback, message: 'Weak password must be at least 3 characters long.' });
                    }
                } else {
                    const unmetReqs = passwordRequirements.filter(req => !req.regex.test(password.value));
                    if (unmetReqs.length > 0) {
                        const message = unmetReqs.map(r => r.message).join(' ');
                        errors.push({ field: password, feedback: passwordFeedback, message: `Password does not meet requirements: ${message}` });
                    }
                }

                if (password.value !== confirmPassword.value) {
                    errors.push({ field: confirmPassword, feedback: confirmPasswordFeedback, message: 'Passwords do not match.' });
                } 

                [email, password, confirmPassword].forEach(f => f.classList.remove('is-invalid'));

                errors.forEach(err => {
                    err.field.classList.add('is-invalid');
                    err.feedback.textContent = err.message;
                });

                submitButton.disabled = errors.length > 0;
            }

            [email, password, confirmPassword, useWeakPassword].forEach(field => {
                field.addEventListener('input', validateForm);
                if (field.type === 'checkbox') field.addEventListener('change', validateForm);
            });

            validateForm();
        });