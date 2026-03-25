CREATE TABLE IF NOT EXISTS `user` (
    `user_id` VARCHAR(64) NOT NULL,
    `email` VARCHAR(255) NULL,
    `nickname` VARCHAR(100) NOT NULL,
    `provider` VARCHAR(50) NOT NULL DEFAULT 'demo',
    `profile_completed_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`),
    KEY `idx_user_provider` (`provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_identity` (
    `identity_id` INT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(50) NOT NULL,
    `provider_user_id` VARCHAR(120) NOT NULL,
    `email` VARCHAR(255) NULL,
    `profile_image` VARCHAR(255) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`identity_id`),
    UNIQUE KEY `uq_user_identity_provider_user` (`provider`, `provider_user_id`),
    UNIQUE KEY `uq_user_identity_user_provider` (`user_id`, `provider`),
    CONSTRAINT `fk_user_identity_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `map` (
    `position_id` INT NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(100) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `district` VARCHAR(50) NOT NULL,
    `category` VARCHAR(20) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `summary` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `image_url` VARCHAR(255) NULL,
    `image_storage_path` VARCHAR(255) NULL,
    `vibe_tags` JSON NOT NULL,
    `visit_time` VARCHAR(50) NOT NULL,
    `route_hint` VARCHAR(255) NOT NULL,
    `stamp_reward` VARCHAR(120) NOT NULL,
    `hero_label` VARCHAR(60) NOT NULL,
    `jam_color` VARCHAR(20) NOT NULL,
    `accent_color` VARCHAR(20) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`position_id`),
    UNIQUE KEY `uq_map_slug` (`slug`),
    KEY `idx_map_category` (`category`),
    KEY `idx_map_active_name` (`is_active`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `public_data_source` (
    `source_id` INT NOT NULL AUTO_INCREMENT,
    `source_key` VARCHAR(80) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `source_url` VARCHAR(255) NULL,
    `last_imported_at` DATETIME NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`source_id`),
    UNIQUE KEY `uq_public_data_source_key` (`source_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `public_place` (
    `public_place_id` INT NOT NULL AUTO_INCREMENT,
    `source_id` INT NOT NULL,
    `external_id` VARCHAR(120) NOT NULL,
    `map_slug` VARCHAR(100) NOT NULL,
    `display_name` VARCHAR(140) NOT NULL,
    `district` VARCHAR(50) NOT NULL,
    `category` VARCHAR(20) NOT NULL,
    `address` VARCHAR(255) NULL,
    `road_address` VARCHAR(255) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `summary` VARCHAR(255) NOT NULL DEFAULT '',
    `description` TEXT NOT NULL,
    `image_url` VARCHAR(255) NULL,
    `contact` VARCHAR(100) NULL,
    `source_page_url` VARCHAR(255) NULL,
    `source_updated_at` DATETIME NULL,
    `sync_status` VARCHAR(20) NOT NULL DEFAULT 'imported',
    `raw_payload` JSON NOT NULL,
    `normalized_payload` JSON NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`public_place_id`),
    UNIQUE KEY `uq_public_place_source_external` (`source_id`, `external_id`),
    KEY `idx_public_place_map_slug` (`map_slug`),
    KEY `idx_public_place_sync_status` (`sync_status`),
    CONSTRAINT `fk_public_place_source_id` FOREIGN KEY (`source_id`) REFERENCES `public_data_source` (`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `public_place_map_link` (
    `public_place_map_link_id` INT NOT NULL AUTO_INCREMENT,
    `public_place_id` INT NOT NULL,
    `position_id` INT NOT NULL,
    `match_method` VARCHAR(30) NOT NULL DEFAULT 'slug',
    `confidence_score` DOUBLE NOT NULL DEFAULT 1,
    `is_primary` BOOLEAN NOT NULL DEFAULT TRUE,
    `linked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`public_place_map_link_id`),
    UNIQUE KEY `uq_public_place_map_link` (`public_place_id`, `position_id`),
    KEY `idx_public_place_map_link_position` (`position_id`),
    CONSTRAINT `fk_public_place_map_link_public_place_id` FOREIGN KEY (`public_place_id`) REFERENCES `public_place` (`public_place_id`),
    CONSTRAINT `fk_public_place_map_link_position_id` FOREIGN KEY (`position_id`) REFERENCES `map` (`position_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `public_event` (
    `public_event_id` INT NOT NULL AUTO_INCREMENT,
    `source_id` INT NOT NULL,
    `external_id` VARCHAR(120) NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `venue_name` VARCHAR(140) NULL,
    `district` VARCHAR(50) NOT NULL DEFAULT '',
    `address` VARCHAR(255) NULL,
    `road_address` VARCHAR(255) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `starts_at` DATETIME NOT NULL,
    `ends_at` DATETIME NOT NULL,
    `summary` VARCHAR(255) NOT NULL DEFAULT '',
    `description` TEXT NOT NULL,
    `image_url` VARCHAR(255) NULL,
    `contact` VARCHAR(100) NULL,
    `source_page_url` VARCHAR(255) NULL,
    `source_updated_at` DATETIME NULL,
    `sync_status` VARCHAR(20) NOT NULL DEFAULT 'imported',
    `raw_payload` JSON NOT NULL,
    `normalized_payload` JSON NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`public_event_id`),
    UNIQUE KEY `uq_public_event_source_external` (`source_id`, `external_id`),
    KEY `idx_public_event_dates` (`starts_at`, `ends_at`),
    KEY `idx_public_event_status` (`sync_status`),
    CONSTRAINT `fk_public_event_source_id` FOREIGN KEY (`source_id`) REFERENCES `public_data_source` (`source_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `public_event_map_link` (
    `public_event_map_link_id` INT NOT NULL AUTO_INCREMENT,
    `public_event_id` INT NOT NULL,
    `position_id` INT NOT NULL,
    `match_method` VARCHAR(30) NOT NULL DEFAULT 'name-exact',
    `confidence_score` DOUBLE NOT NULL DEFAULT 1,
    `is_primary` BOOLEAN NOT NULL DEFAULT TRUE,
    `linked_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`public_event_map_link_id`),
    UNIQUE KEY `uq_public_event_map_link` (`public_event_id`, `position_id`),
    KEY `idx_public_event_map_link_position` (`position_id`),
    CONSTRAINT `fk_public_event_map_link_public_event_id` FOREIGN KEY (`public_event_id`) REFERENCES `public_event` (`public_event_id`),
    CONSTRAINT `fk_public_event_map_link_position_id` FOREIGN KEY (`position_id`) REFERENCES `map` (`position_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `travel_session` (
    `travel_session_id` INT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `started_at` DATETIME NOT NULL,
    `ended_at` DATETIME NOT NULL,
    `last_stamp_at` DATETIME NOT NULL,
    `stamp_count` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`travel_session_id`),
    KEY `idx_travel_session_user_id` (`user_id`),
    KEY `idx_travel_session_last_stamp_at` (`last_stamp_at`),
    CONSTRAINT `fk_travel_session_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_stamp` (
    `stamp_id` INT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `position_id` INT NOT NULL,
    `travel_session_id` INT NULL,
    `stamp_date` DATE NOT NULL,
    `visit_ordinal` INT NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`stamp_id`),
    UNIQUE KEY `uq_user_stamp_per_day` (`user_id`, `position_id`, `stamp_date`),
    KEY `idx_user_stamp_position_id` (`position_id`),
    KEY `idx_user_stamp_travel_session_id` (`travel_session_id`),
    KEY `idx_user_stamp_user_created_at` (`user_id`, `created_at`),
    CONSTRAINT `fk_user_stamp_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_stamp_position_id` FOREIGN KEY (`position_id`) REFERENCES `map` (`position_id`),
    CONSTRAINT `fk_user_stamp_travel_session_id` FOREIGN KEY (`travel_session_id`) REFERENCES `travel_session` (`travel_session_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feed` (
    `feed_id` INT NOT NULL AUTO_INCREMENT,
    `position_id` INT NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `stamp_id` INT NOT NULL,
    `body` TEXT NOT NULL,
    `mood` VARCHAR(20) NOT NULL,
    `badge` VARCHAR(50) NOT NULL DEFAULT '濡쒖뺄 硫붾え',
    `image_url` VARCHAR(255) NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`feed_id`),
    KEY `idx_feed_position_id` (`position_id`),
    KEY `idx_feed_user_id` (`user_id`),
    KEY `idx_feed_stamp_id` (`stamp_id`),
    CONSTRAINT `fk_feed_position_id` FOREIGN KEY (`position_id`) REFERENCES `map` (`position_id`),
    CONSTRAINT `fk_feed_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_feed_stamp_id` FOREIGN KEY (`stamp_id`) REFERENCES `user_stamp` (`stamp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feed_like` (
    `feed_like_id` INT NOT NULL AUTO_INCREMENT,
    `feed_id` INT NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`feed_like_id`),
    UNIQUE KEY `uq_feed_like` (`feed_id`, `user_id`),
    KEY `idx_feed_like_user_id` (`user_id`),
    CONSTRAINT `fk_feed_like_feed_id` FOREIGN KEY (`feed_id`) REFERENCES `feed` (`feed_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_feed_like_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_comment` (
    `comment_id` INT NOT NULL AUTO_INCREMENT,
    `feed_id` INT NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `parent_id` INT NULL,
    `body` TEXT NOT NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`comment_id`),
    KEY `idx_user_comment_feed_id` (`feed_id`),
    KEY `idx_user_comment_user_id` (`user_id`),
    KEY `idx_user_comment_parent_id` (`parent_id`),
    CONSTRAINT `fk_user_comment_feed_id` FOREIGN KEY (`feed_id`) REFERENCES `feed` (`feed_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_comment_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_comment_parent_id` FOREIGN KEY (`parent_id`) REFERENCES `user_comment` (`comment_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_notification` (
    `notification_id` INT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `actor_user_id` VARCHAR(64) NULL,
    `type` VARCHAR(30) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` VARCHAR(255) NOT NULL DEFAULT '',
    `review_id` INT NULL,
    `comment_id` INT NULL,
    `route_id` INT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
    `read_at` DATETIME NULL,
    `metadata` JSON NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`notification_id`),
    KEY `idx_user_notification_user_created_at` (`user_id`, `created_at`),
    KEY `idx_user_notification_user_is_read` (`user_id`, `is_read`),
    CONSTRAINT `fk_user_notification_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_notification_actor_user_id` FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`user_id`) ON DELETE SET NULL,
    CONSTRAINT `fk_user_notification_review_id` FOREIGN KEY (`review_id`) REFERENCES `feed` (`feed_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_notification_comment_id` FOREIGN KEY (`comment_id`) REFERENCES `user_comment` (`comment_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course` (
    `course_id` INT NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(80) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `mood` VARCHAR(20) NOT NULL,
    `duration` VARCHAR(40) NOT NULL,
    `note` VARCHAR(255) NOT NULL,
    `color` VARCHAR(20) NOT NULL,
    `display_order` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`course_id`),
    UNIQUE KEY `uq_course_slug` (`slug`),
    KEY `idx_course_display_order` (`display_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_place` (
    `course_place_id` INT NOT NULL AUTO_INCREMENT,
    `course_id` INT NOT NULL,
    `position_id` INT NOT NULL,
    `stop_order` INT NOT NULL,
    PRIMARY KEY (`course_place_id`),
    UNIQUE KEY `uq_course_place` (`course_id`, `position_id`),
    KEY `idx_course_place_stop_order` (`course_id`, `stop_order`),
    CONSTRAINT `fk_course_place_course_id` FOREIGN KEY (`course_id`) REFERENCES `course` (`course_id`),
    CONSTRAINT `fk_course_place_position_id` FOREIGN KEY (`position_id`) REFERENCES `map` (`position_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_route` (
    `route_id` INT NOT NULL AUTO_INCREMENT,
    `user_id` VARCHAR(64) NOT NULL,
    `travel_session_id` INT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `mood` VARCHAR(20) NOT NULL,
    `is_public` TINYINT(1) NOT NULL DEFAULT 1,
    `is_user_generated` TINYINT(1) NOT NULL DEFAULT 0,
    `like_count` INT NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`route_id`),
    KEY `idx_user_route_user_id` (`user_id`),
    KEY `idx_user_route_travel_session_id` (`travel_session_id`),
    KEY `idx_user_route_public_sort` (`is_public`, `like_count`, `created_at`),
    CONSTRAINT `fk_user_route_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_route_travel_session_id` FOREIGN KEY (`travel_session_id`) REFERENCES `travel_session` (`travel_session_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_route_place` (
    `user_route_place_id` INT NOT NULL AUTO_INCREMENT,
    `route_id` INT NOT NULL,
    `position_id` INT NOT NULL,
    `stop_order` INT NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_route_place_id`),
    UNIQUE KEY `uq_user_route_place` (`route_id`, `position_id`),
    KEY `idx_user_route_place_stop_order` (`route_id`, `stop_order`),
    CONSTRAINT `fk_user_route_place_route_id` FOREIGN KEY (`route_id`) REFERENCES `user_route` (`route_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_route_place_position_id` FOREIGN KEY (`position_id`) REFERENCES `map` (`position_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `user_route_like` (
    `route_like_id` INT NOT NULL AUTO_INCREMENT,
    `route_id` INT NOT NULL,
    `user_id` VARCHAR(64) NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`route_like_id`),
    UNIQUE KEY `uq_user_route_like` (`route_id`, `user_id`),
    KEY `idx_user_route_like_user_id` (`user_id`),
    CONSTRAINT `fk_user_route_like_route_id` FOREIGN KEY (`route_id`) REFERENCES `user_route` (`route_id`) ON DELETE CASCADE,
    CONSTRAINT `fk_user_route_like_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
