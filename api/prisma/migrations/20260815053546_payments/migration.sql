-- AlterTable
ALTER TABLE `loans` ADD COLUMN `penalty_paid` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `payments` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `loan_id` BIGINT NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `penalty_applied` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `idempotency_key` VARCHAR(64) NOT NULL,
    `notes` VARCHAR(255) NULL,
    `created_by` VARCHAR(15) NOT NULL,

    UNIQUE INDEX `payments_idempotency_key_key`(`idempotency_key`),
    INDEX `payments_loan_id_received_at_idx`(`loan_id`, `received_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
