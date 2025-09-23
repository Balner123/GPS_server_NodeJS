const bcrypt = require('bcryptjs');
const password = 'root';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Generated password hash:', hash);
});
