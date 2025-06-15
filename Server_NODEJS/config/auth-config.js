const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcryptjs');

const AUTH_FILE = path.join(__dirname, 'auth.json');

async function getPasswordHash() {
  try {
    const data = await fs.readFile(AUTH_FILE, 'utf8');
    const config = JSON.parse(data);
    return config.passwordHash;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, check .env
      const hashFromEnv = process.env.GLOBAL_PASSWORD_HASH;
      if (hashFromEnv) {
        await setPasswordHash(hashFromEnv);
        return hashFromEnv;
      }
      throw new Error('Password is not configured. Please set GLOBAL_PASSWORD_HASH in .env file.');
    }
    throw error;
  }
}

async function setPasswordHash(newHash) {
  try {
    const config = { passwordHash: newHash };
    await fs.writeFile(AUTH_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error("Error writing to auth config file:", error);
    throw new Error("Could not save new password hash.");
  }
}

module.exports = {
  getPasswordHash,
  setPasswordHash,
}; 