-- AlterTable
ALTER TABLE `add_to_carts` ADD COLUMN `discount` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `notes` VARCHAR(191) NULL;
