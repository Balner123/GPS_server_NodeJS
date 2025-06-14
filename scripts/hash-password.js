const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("--- Password Hash Generator ---");
rl.question('Please enter the password to hash: ', (password) => {
  if (!password) {
    console.error("Password cannot be empty.");
    rl.close();
    return;
  }

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  console.log("\nPassword hashing complete.");
  console.log("----------------------------------------------------------------");
  console.log("Copy the following line into your .env file:");
  console.log(`GLOBAL_PASSWORD_HASH=${hash}`);
  console.log("----------------------------------------------------------------");

  rl.close();
}); 