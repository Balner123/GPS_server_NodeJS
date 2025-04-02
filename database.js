const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gps_tracking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test připojení
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database.');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to the database:', err);
  });

module.exports = pool;