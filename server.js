const express = require("express");
const db = require("./database");
const app = express();
const port = 5000;

app.use(express.json());
app.use(express.static('public'));

app.post("/device_input", (req, res) => {
  const { device, longitude, latitude } = req.body;
  console.log("Received data:", req.body);  // Debugging line

  // Název tabulky pro dané zařízení
  const tableName = `device_${device}`;

  // Vytvoření tabulky, pokud neexistuje
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ID INTEGER PRIMARY KEY AUTOINCREMENT,
      longitude CHAR(50),
      latitude CHAR(50),
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  db.run(createTableSql, [], (err) => {
    if (err) {
      console.error("Error creating table:", err.message);
      return res.status(500).json({ error: err.message });
    }

    // Vložení dat do tabulky
    const insertSql = `INSERT INTO ${tableName} (longitude, latitude) VALUES (?, ?)`;
    db.run(insertSql, [longitude, latitude], function(err) {
      if (err) {
        console.error("Error inserting data:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.status(200).json({ id: this.lastID });
    });
  });
});

app.get("/current_coordinates", (req, res) => {
  const getTablesSql = `
    SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'device_%'
  `;

  db.all(getTablesSql, [], (err, tables) => {
    if (err) {
      console.error("Error fetching table names:", err.message);
      return res.status(500).json({ error: err.message });
    }

    const promises = tables.map(table => {
      const device = table.name.split('_')[1]; // Extract device number from table name
      const sql = `
        SELECT '${device}' as device, longitude, latitude, timestamp
        FROM ${table.name}
        ORDER BY ID DESC
        LIMIT 1
      `;
      return new Promise((resolve, reject) => {
        db.get(sql, [], (err, row) => {
          if (err) {
            return reject(err);
          }
          resolve(row);
        });
      });
    });

    Promise.all(promises)
      .then(results => {
        res.json(results);
      })
      .catch(error => {
        console.error("Error fetching data:", error.message);
        res.status(500).json({ error: error.message });
      });
  });
});

app.get("/device", (req, res) => {
  const deviceName = req.query.name;
  res.sendFile(__dirname + '/public/device.html');
});

app.get("/device_data", (req, res) => {
  const deviceName = req.query.name;
  const sql = `SELECT longitude, latitude, timestamp FROM ${deviceName} ORDER BY ID DESC`;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching data:", err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});