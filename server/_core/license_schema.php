<?php
declare(strict_types=1);
return [
 'CREATE TABLE IF NOT EXISTS byp_license_secrets (license_id INT UNSIGNED PRIMARY KEY, key_cipher TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
 'CREATE TABLE IF NOT EXISTS byp_license_activations (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, license_id INT UNSIGNED NOT NULL UNIQUE, installation_id CHAR(32) NOT NULL UNIQUE, credential_hash CHAR(64) NOT NULL, generation CHAR(32) NOT NULL, site_url VARCHAR(255) NOT NULL, active TINYINT NOT NULL DEFAULT 1, last_seen_at DATETIME NOT NULL, created_at DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
 'CREATE TABLE IF NOT EXISTS byp_license_challenges (id CHAR(32) PRIMARY KEY, license_id INT UNSIGNED NOT NULL, installation_id CHAR(32) NOT NULL, site_url VARCHAR(255) NOT NULL, nonce CHAR(64) NOT NULL, expires_at DATETIME NOT NULL, consumed TINYINT NOT NULL DEFAULT 0, INDEX(license_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
 'CREATE TABLE IF NOT EXISTS byp_license_requests (bucket CHAR(64) NOT NULL, window_start BIGINT NOT NULL, request_count INT NOT NULL, PRIMARY KEY(bucket,window_start)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
 'CREATE TABLE IF NOT EXISTS byp_license_order_links (order_id INT UNSIGNED PRIMARY KEY, license_id INT UNSIGNED NOT NULL UNIQUE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
 'CREATE TABLE IF NOT EXISTS byp_license_operations (operation_id CHAR(32) PRIMARY KEY, license_id INT UNSIGNED NOT NULL, action VARCHAR(30) NOT NULL, user_id INT UNSIGNED NOT NULL, result_json TEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
];
