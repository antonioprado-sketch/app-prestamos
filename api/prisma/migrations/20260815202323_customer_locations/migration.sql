-- CreateTable
CREATE TABLE `locations` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_phone` VARCHAR(15) NOT NULL,
    `lat` DECIMAL(9, 6) NOT NULL,
    `lng` DECIMAL(9, 6) NOT NULL,
    `accuracy` DECIMAL(10, 2) NULL,
    `source` ENUM('ONBOARDING', 'LOGIN', 'PAYMENT', 'REQUEST') NOT NULL,
    `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `locations_customer_phone_captured_at_idx`(`customer_phone`, `captured_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_customer_phone_fkey` FOREIGN KEY (`customer_phone`) REFERENCES `customers`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;
