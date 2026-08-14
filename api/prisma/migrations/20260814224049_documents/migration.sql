-- CreateTable
CREATE TABLE `documents` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `customer_phone` VARCHAR(15) NOT NULL,
    `loan_id` BIGINT NULL,
    `type` ENUM('INE_FRONT', 'INE_BACK', 'ADDRESS_PROOF') NOT NULL,
    `storage_key` VARCHAR(255) NOT NULL,
    `mime` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `uploaded_by` VARCHAR(15) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documents_customer_phone_type_idx`(`customer_phone`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_customer_phone_fkey` FOREIGN KEY (`customer_phone`) REFERENCES `customers`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
