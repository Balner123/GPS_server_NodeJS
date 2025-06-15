-- Create database
DROP DATABASE IF EXISTS gps_tracking;
CREATE DATABASE gps_tracking;
USE gps_tracking;


-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'inactive') DEFAULT 'active',
    sleep_interval INT DEFAULT 60,
    sleep_interval_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Vytvoření tabulky lokací
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

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vytvoření indexů pro optimalizaci
CREATE INDEX idx_device_id ON locations(device_id);
CREATE INDEX idx_timestamp ON locations(timestamp);
CREATE INDEX idx_device_status ON devices(status); 

INSERT INTO users (username, password) VALUES ('root', '$2b$10$RWZ9TyKNfXi9pGMb6k.3s.QaGE1lrVDyD9.X4VXzvZ/i4pYMfyuNq');