-- AlterTable
ALTER TABLE `customers` ADD COLUMN `credit_limit` DECIMAL(10, 2) NULL;

-- CreateTable
CREATE TABLE `credit_increase_requests` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_phone` VARCHAR(15) NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `resolved_by` VARCHAR(15) NULL,
    `resolved_at` DATETIME(3) NULL,
    `note` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credit_increase_requests_customer_phone_status_idx`(`customer_phone`, `status`),
    INDEX `credit_increase_requests_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `credit_increase_requests` ADD CONSTRAINT `credit_increase_requests_customer_phone_fkey` FOREIGN KEY (`customer_phone`) REFERENCES `customers`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_increase_requests` ADD CONSTRAINT `credit_increase_requests_resolved_by_fkey` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`phone`) ON DELETE SET NULL ON UPDATE CASCADE;
