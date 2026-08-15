-- AlterTable
ALTER TABLE `customers` ADD COLUMN `score_override` ENUM('GREEN', 'YELLOW', 'ORANGE', 'RED') NULL;
