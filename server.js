const express = require("express");
const db = require("./database");
const app = express();
const port = 5000;

app.use(express.json());
app.use(express.static('public'));

app.post("/device_input", (req, res) => {
  const { device, longitude, latitude } = req.body;
  console.log("Received data:", req.body);  // Debugging line

  // Zkontrolujeme, zda device již existuje
  const checkSql = `SELECT * FROM gps_devices WHERE device = ?`;
  db.get(checkSql, [device], (err, row) => {
    if (err) {
      console.error("Error checking device:", err.message);  // Debugging line
      return res.status(500).json({ error: err.message });
    }

    if (row) {
      // Pokud device existuje, aktualizujeme hodnoty longitude a latitude
      const updateSql = `UPDATE gps_devices SET longitude = ?, latitude = ? WHERE device = ?`;
      db.run(updateSql, [longitude, latitude, device], function(err) {
        if (err) {
          console.error("Error updating device:", err.message);  // Debugging line
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Coordinates updated!", device: device });
      });
    } else {
      // Pokud device neexistuje, vložíme nový záznam s daným device
      const insertSql = `INSERT INTO gps_devices (device, longitude, latitude) VALUES (?, ?, ?)`;
      db.run(insertSql, [device, longitude, latitude], function(err) {
        if (err) {
          console.error("Error inserting device:", err.message);  // Debugging line
          return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Coordinates received!", device: device });
      });
    }
  });
});

app.get("/api/devices", (req, res) => {
  const selectSql = `SELECT * FROM gps_devices`;
  db.all(selectSql, [], (err, rows) => {
    if (err) {
      console.error("Error fetching devices:", err.message);  // Debugging line
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});


app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});