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
  provider VARCHAR(50) DEFAULT 'local',
  provider_id VARCHAR(255),
  provider_data TEXT,
  deletion_code VARCHAR(10),
  deletion_code_expires TIMESTAMP NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(10) DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'active',
    last_seen TIMESTAMP NULL,
    interval_gps INT DEFAULT 60,
    interval_send INT DEFAULT 1,
    satellites INT DEFAULT 7,
    mode ENUM('simple', 'batch') DEFAULT 'simple',
    geofence JSON NULL,
    geofence_alert_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    user_id INT NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    speed DECIMAL(5, 2),
    altitude DECIMAL(7, 2),
    accuracy DECIMAL(5, 2),
    satellites INT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id INT NOT NULL,
    user_id INT,
    type VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_device_id_locations ON locations(device_id);
CREATE INDEX idx_user_id_locations ON locations(user_id);
CREATE INDEX idx_timestamp_locations ON locations(timestamp);
CREATE INDEX idx_device_status ON devices(status);
CREATE INDEX idx_users_provider_id ON users(provider, provider_id);
CREATE INDEX idx_device_id_alerts ON alerts(device_id);
CREATE INDEX idx_user_id_alerts ON alerts(user_id);

-- Root user for Admin purposes (testing)
INSERT INTO users (username, email, is_verified, password) VALUES ('root', 'root', 1, '$2b$10$5JGpNVbNnSSbqs/hn9OW1OqdvhT5gCXh1n984mlPF46k5GHfZ/HwW');