const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database('./gps_database.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Vytvoření tabulky
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS gps_devices (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    device INTEGER NOT NULL,
    longitude CHAR(50),
    latitude CHAR(50)
  )`);
});

module.exports = db;