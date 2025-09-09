DROP DATABASE IF EXISTS gps_tracking;
CREATE DATABASE gps_tracking;
USE gps_tracking;


CREATE TABLE IF NOT EXISTS users (
  id int(11) NOT NULL AUTO_INCREMENT,
  username varchar(255) NOT NULL UNIQUE,
  email varchar(255) NOT NULL UNIQUE,
  password varchar(255) NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT 0,
  verification_code VARCHAR(10),
  verification_expires TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pending_email VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    device_id VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    last_seen TIMESTAMP NULL,
    interval_gps INT DEFAULT 60, -- Default: 60 seconds between GPS fixes
    interval_send INT DEFAULT 1, -- Default: Send after every 1 cycle (simple mode)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5, 2),
    altitude DECIMAL(7, 2),
    accuracy DECIMAL(5, 2),
    satellites INT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_id ON locations(device_id);
CREATE INDEX idx_timestamp ON locations(timestamp);
CREATE INDEX idx_device_status ON devices(status);

-- Vložení administrátorského účtu
INSERT INTO users (username, email, is_verified, password) VALUES ('root', 'root', 1, '$2b$10$5JGpNVbNnSSbqs/hn9OW1OqdvhT5gCXh1n984mlPF46k5GHfZ/HwW');
