-- AlterTable
ALTER TABLE `notifications` MODIFY `type` ENUM('SELL_READY_FOR_DELIVERY', 'SELL_CANCELLED', 'Done', 'Payment', 'Inventory', 'System', 'Approval') NOT NULL;

-- AlterTable
ALTER TABLE `sell_items` MODIFY `itemSaleStatus` ENUM('PENDING', 'DELIVERED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `sell_stock_correction_items` MODIFY `itemSaleStatus` ENUM('PENDING', 'DELIVERED', 'REJECTED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `sell_stock_corrections` ADD COLUMN `isChecked` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `stock_corrections` ADD COLUMN `isChecked` BOOLEAN NOT NULL DEFAULT false;
