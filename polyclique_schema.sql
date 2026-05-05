-- Polyclique ERP - Full Project Dump (HeidiSQL)
-- Hôte: 127.0.0.1
-- Version du serveur: 8.4.3 - MySQL Community Server - GPL

SET FOREIGN_KEY_CHECKS = 0;

-- Structure de la table cache
CREATE TABLE IF NOT EXISTS `cache` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure de la table cache_locks
CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiration` bigint NOT NULL,
  PRIMARY KEY (`key`),
  KEY `cache_locks_expiration_index` (`expiration`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure de la table users
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reception',
  `profile_picture` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expo_push_token` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `remember_token` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `created_at`, `updated_at`) VALUES
	(2, 'MPOLO', 'jeanpaulmpolo242@gmail.com', '$2y$12$park3hCbEiu3OravfqfBS.xqNSI9n1qVvP1zSdAN3VwArfygn5ktO', 'reception', '2026-04-20 17:23:24', '2026-04-20 17:23:24'),
	(3, 'Admin System', 'admin@test.com', '$2y$12$T1cb6IURWGZvHkfL1PNbWeajYrPm1OLa18KR0BXfIniy8xGUBuWzq', 'admin', '2026-04-24 20:19:25', '2026-04-24 20:19:25'),
	(4, 'Compatibilité', 'comptable@mdcd.org', '$2y$12$7H.QwX5Nz1NEAtppOV09q.vKOBpCp1VQfC8tU0CX/9l18VS98HwB6', 'caisse', '2026-04-25 06:49:08', '2026-04-25 06:49:08'),
	(5, 'Laboratoire', 'laboratoire@mdcd.org', '$2y$12$C0yf61hz4.jdslslzvZOQ.Uqny95szhoMspbSpRyMLC4BDPS3twYe', 'labo', '2026-04-25 13:16:00', '2026-04-25 13:16:00'),
	(6, 'Services soins', 'soins@mdcd.org', '$2y$12$Q8E/q4vtOIQNAhTWj7tR5u7grW0..x9o/ineCfl7Vl9xYmsiAPv4.', 'soins', '2026-04-25 13:20:21', '2026-04-25 13:20:35'),
	(7, 'Médecin', 'medecine@mdcd.org', '$2y$12$zDDOyuzoETT.4a/oGKi.x.RRV/bDwe2nBTz/fiuIoyEl8AVzVCnii', 'medecin', '2026-04-25 17:16:36', '2026-04-25 17:16:36'),
	(8, 'Pharmacie', 'pharmacie@mdcd.org', '$2y$12$mL1Sa9/FmUFymbdhFTaAQuo0k5UNEX2SJ2osQkwkw27GvrYX83fHu', 'pharmacie', '2026-04-25 22:14:35', '2026-04-25 22:14:35');

-- Structure de la table insurances
CREATE TABLE IF NOT EXISTS `insurances` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contract_date` date DEFAULT NULL,
  `monthly_flat_fee` decimal(15,2) NOT NULL DEFAULT '0.00',
  `contact_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `insurances` (`id`, `name`, `email`, `contract_date`, `monthly_flat_fee`, `contact_info`, `created_at`, `updated_at`, `status`) VALUES
	(3, 'ACTIVA', NULL, '2026-04-04', 1000000.00, 'contact@activa.fr', '2026-04-26 09:53:14', '2026-04-26 09:53:14', 'active');

-- Structure de la table insured_members
CREATE TABLE IF NOT EXISTS `insured_members` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `insurance_id` bigint unsigned NOT NULL,
  `member_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `membership_code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `insured_members_insurance_id_membership_code_unique` (`insurance_id`,`membership_code`),
  KEY `insured_members_membership_code_index` (`membership_code`),
  CONSTRAINT `insured_members_insurance_id_foreign` FOREIGN KEY (`insurance_id`) REFERENCES `insurances` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `insured_members` (`id`, `insurance_id`, `member_name`, `membership_code`, `is_active`, `created_at`, `updated_at`) VALUES
	(3, 3, 'MPOLO LONO', 'AC-MG01', 1, '2026-04-27 15:05:59', '2026-04-27 15:05:59');

-- Structure de la table patients
CREATE TABLE IF NOT EXISTS `patients` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `first_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `gender` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `post_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_insured` tinyint(1) NOT NULL DEFAULT '0',
  `insurance_id` bigint unsigned DEFAULT NULL,
  `insurance_company` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `insurance_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contact_info` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `complaints` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `birth_year` int DEFAULT NULL,
  `pathology` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `patients_insurance_id_foreign` (`insurance_id`),
  CONSTRAINT `patients_insurance_id_foreign` FOREIGN KEY (`insurance_id`) REFERENCES `insurances` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `patients` (`id`, `first_name`, `last_name`, `is_insured`, `insurance_id`, `insurance_code`, `birth_year`, `created_at`, `updated_at`) VALUES
	(1, 'ELONGA', 'KAZADI', 0, NULL, NULL, 1998, '2026-04-25 06:51:54', '2026-04-27 19:33:14'),
	(2, 'KALONDA', 'NGOY', 0, NULL, NULL, 2000, '2026-04-25 09:41:45', '2026-04-27 14:29:10'),
	(6, 'Jean Paul', 'MPOLO', 1, 3, 'AC-MG01', 1999, '2026-04-28 05:00:13', '2026-04-28 05:00:13');

-- Structure de la table visits
CREATE TABLE IF NOT EXISTS `visits` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `patient_id` bigint unsigned NOT NULL,
  `current_service` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reception',
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `complaints_notes` text COLLATE utf8mb4_unicode_ci,
  `diagnosis` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vitals` json DEFAULT NULL,
  `nursing_notes` text COLLATE utf8mb4_unicode_ci,
  `consultation_notes` text COLLATE utf8mb4_unicode_ci,
  `prescription_notes` text COLLATE utf8mb4_unicode_ci,
  `prescription_items` json DEFAULT NULL,
  `lab_tests` json DEFAULT NULL,
  `lab_results` text COLLATE utf8mb4_unicode_ci,
  `lab_order_status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `pharmacy_order_status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'none',
  `doctor_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `visits_patient_id_foreign` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure de la table invoices
CREATE TABLE IF NOT EXISTS `invoices` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `visit_id` bigint unsigned NOT NULL,
  `patient_id` bigint unsigned NOT NULL,
  `insurance_id` bigint unsigned DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'unpaid',
  `details` text COLLATE utf8mb4_unicode_ci,
  `payment_method` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'cash',
  `service` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `invoices_patient_id_foreign` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `invoices_visit_id_foreign` FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure de la table cashier_sessions
CREATE TABLE IF NOT EXISTS `cashier_sessions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `opening_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'closed',
  `reference` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cashier_sessions_reference_unique` (`reference`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Structure de la table personal_access_tokens
CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tokenable_type` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tokenable_id` bigint unsigned NOT NULL,
  `name` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `token` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `abilities` text COLLATE utf8mb4_unicode_ci,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `personal_access_tokens_token_unique` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
