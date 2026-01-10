-- AlterTable
ALTER TABLE `sell_stock_correction_items` ADD COLUMN `itemSaleStatus` ENUM('PENDING', 'DELIVERED') NOT NULL DEFAULT 'PENDING';
