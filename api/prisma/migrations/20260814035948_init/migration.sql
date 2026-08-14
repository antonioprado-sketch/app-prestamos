-- CreateTable
CREATE TABLE `users` (
    `phone` VARCHAR(15) NOT NULL,
    `email` VARCHAR(190) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('CLIENT', 'COLLECTOR', 'ADMIN') NOT NULL DEFAULT 'CLIENT',
    `status` ENUM('ACTIVE', 'INACTIVE', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `failed_attempts` INTEGER NOT NULL DEFAULT 0,
    `blocked_until` DATETIME(6) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`phone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_phone` VARCHAR(15) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_phone_idx`(`user_phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `phone` VARCHAR(15) NOT NULL,
    `nombres` VARCHAR(25) NULL,
    `apellidos` VARCHAR(35) NULL,
    `aval` VARCHAR(70) NULL,
    `aval_phone` VARCHAR(15) NULL,
    `email` VARCHAR(190) NULL,
    `calle` VARCHAR(191) NULL,
    `numero` VARCHAR(191) NULL,
    `colonia` VARCHAR(191) NULL,
    `cp` VARCHAR(5) NULL,
    `ciudad` VARCHAR(191) NULL,
    `estado` VARCHAR(191) NULL,
    `referencias` VARCHAR(255) NULL,
    `is_new_customer` BOOLEAN NOT NULL DEFAULT false,
    `onboarding_complete` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`phone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `collectors` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(15) NOT NULL,
    `name` VARCHAR(70) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `collectors_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admins` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `phone` VARCHAR(15) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admins_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_phone` VARCHAR(15) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity` VARCHAR(100) NOT NULL,
    `entity_id` VARCHAR(100) NULL,
    `prev_value` JSON NULL,
    `new_value` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_phone_idx`(`user_phone`),
    INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuration` (
    `key` VARCHAR(100) NOT NULL,
    `value` JSON NOT NULL,
    `updated_by` VARCHAR(15) NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_phone_fkey` FOREIGN KEY (`user_phone`) REFERENCES `users`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_phone_fkey` FOREIGN KEY (`phone`) REFERENCES `users`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `collectors` ADD CONSTRAINT `collectors_phone_fkey` FOREIGN KEY (`phone`) REFERENCES `users`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admins` ADD CONSTRAINT `admins_phone_fkey` FOREIGN KEY (`phone`) REFERENCES `users`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_phone_fkey` FOREIGN KEY (`user_phone`) REFERENCES `users`(`phone`) ON DELETE SET NULL ON UPDATE CASCADE;
