const bcrypt = require('bcryptjs');
const password = 'root'; // Změňte na vaše skutečné heslo
const saltRounds = 10; // Doporučený počet saltovacích kol

bcrypt.hash(password, saltRounds, function(err, hash) {
  if (err) {
    console.error('Chyba při hashování hesla:', err);
    return;
  }
  console.log('Vygenerovaný hash hesla:', hash);
});
