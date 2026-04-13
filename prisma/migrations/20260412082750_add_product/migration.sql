-- AlterTable
ALTER TABLE `purchase_items` ADD COLUMN `isBox` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `sell_items` ADD COLUMN `isBox` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `sell_stock_correction_items` ADD COLUMN `isBox` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `stock_correction_items` ADD COLUMN `isBox` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `transfer_items` ADD COLUMN `isBox` BOOLEAN NOT NULL DEFAULT false;
