const bcrypt = require('bcryptjs');
const password = 'root'; // Change to your actual password
const saltRounds = 10; // Recommended number of salt rounds

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Generated password hash:', hash);
});
