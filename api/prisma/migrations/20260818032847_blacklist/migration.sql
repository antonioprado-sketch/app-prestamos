-- CreateTable
CREATE TABLE `blacklist` (
    `phone` VARCHAR(15) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `created_by` VARCHAR(15) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`phone`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
