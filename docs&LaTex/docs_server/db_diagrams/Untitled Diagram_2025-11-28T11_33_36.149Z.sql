CREATE TABLE IF NOT EXISTS `users` (
	`id` INTEGER NOT NULL AUTO_INCREMENT,
	`username` VARCHAR(255) NOT NULL UNIQUE,
	`email` VARCHAR(255) NOT NULL UNIQUE,
	`password` VARCHAR(255) NOT NULL,
	`is_verified` BOOLEAN NOT NULL DEFAULT 0,
	`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	`pending_email` VARCHAR(255) DEFAULT NULL,
	`provider` VARCHAR(50) DEFAULT 'local',
	`provider_id` VARCHAR(255),
	`provider_data` TEXT,
	`action_token` VARCHAR(255) DEFAULT NULL,
	`action_token_expires` TIMESTAMP NOT NULL,
	`action_type` VARCHAR(50) DEFAULT NULL,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_users_provider_id`
ON `users` (`provider`, `provider_id`);
CREATE TABLE IF NOT EXISTS `devices` (
	`id` INTEGER AUTO_INCREMENT,
	`user_id` INTEGER NOT NULL,
	`device_id` VARCHAR(255) NOT NULL UNIQUE,
	`name` VARCHAR(255) NOT NULL,
	`device_type` VARCHAR(10) DEFAULT NULL,
	`power_status` ENUM('ON', 'OFF') DEFAULT 'ON',
	`power_instruction` ENUM('NONE', 'TURN_OFF') DEFAULT 'NONE',
	`interval_gps` INTEGER DEFAULT 60,
	`interval_send` INTEGER DEFAULT 1,
	`satellites` INTEGER DEFAULT 7,
	`mode` ENUM('simple', 'batch') DEFAULT 'simple',
	`geofence` JSON NOT NULL,
	`geofence_alert_active` BOOLEAN DEFAULT false,
	`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE TABLE IF NOT EXISTS `locations` (
	`id` INTEGER AUTO_INCREMENT,
	`device_id` INTEGER NOT NULL,
	`user_id` INTEGER NOT NULL,
	`longitude` DECIMAL(10,6) NOT NULL,
	`latitude` DECIMAL(10,6) NOT NULL,
	`timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	`speed` DECIMAL(5,2),
	`altitude` DECIMAL(7,2),
	`accuracy` DECIMAL(5,2),
	`satellites` INTEGER,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_device_id_locations`
ON `locations` (`device_id`);
CREATE INDEX `idx_user_id_locations`
ON `locations` (`user_id`);
CREATE INDEX `idx_timestamp_locations`
ON `locations` (`timestamp`);
CREATE TABLE IF NOT EXISTS `alerts` (
	`id` INTEGER AUTO_INCREMENT,
	`device_id` INTEGER NOT NULL,
	`user_id` INTEGER,
	`type` VARCHAR(255) NOT NULL,
	`message` TEXT NOT NULL,
	`is_read` BOOLEAN DEFAULT false,
	`created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY(`id`)
);


CREATE INDEX `idx_device_id_alerts`
ON `alerts` (`device_id`);
CREATE INDEX `idx_user_id_alerts`
ON `alerts` (`user_id`);
ALTER TABLE `devices`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE `locations`
ADD FOREIGN KEY(`device_id`) REFERENCES `devices`(`id`)
ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE `locations`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE `alerts`
ADD FOREIGN KEY(`device_id`) REFERENCES `devices`(`id`)
ON UPDATE NO ACTION ON DELETE CASCADE;
ALTER TABLE `alerts`
ADD FOREIGN KEY(`user_id`) REFERENCES `users`(`id`)
ON UPDATE NO ACTION ON DELETE CASCADE;