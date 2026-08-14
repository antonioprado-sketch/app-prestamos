-- CreateTable
CREATE TABLE `loans` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `folio` VARCHAR(9) NOT NULL,
    `customer_phone` VARCHAR(15) NOT NULL,
    `collector_id` BIGINT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `total_to_pay` DECIMAL(10, 2) NOT NULL,
    `model` ENUM('WEEKLY', 'BIWEEKLY') NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REQUIRES_CORRECTION', 'APPROVED', 'REJECTED', 'ACTIVE', 'LIQUIDATED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `opening_date` DATE NOT NULL,
    `approved_by` VARCHAR(15) NULL,
    `approved_at` DATETIME(3) NULL,
    `liquidated_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `loans_folio_key`(`folio`),
    INDEX `loans_customer_phone_status_idx`(`customer_phone`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loan_schedules` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `loan_id` BIGINT NOT NULL,
    `seq` INTEGER NOT NULL,
    `due_date` DATE NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'PAID', 'PARTIAL', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `paid_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,

    INDEX `loan_schedules_loan_id_due_date_idx`(`loan_id`, `due_date`),
    UNIQUE INDEX `loan_schedules_loan_id_seq_key`(`loan_id`, `seq`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_customer_phone_fkey` FOREIGN KEY (`customer_phone`) REFERENCES `customers`(`phone`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_collector_id_fkey` FOREIGN KEY (`collector_id`) REFERENCES `collectors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`phone`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loan_schedules` ADD CONSTRAINT `loan_schedules_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
