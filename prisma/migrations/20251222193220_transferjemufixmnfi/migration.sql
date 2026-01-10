-- AlterTable
ALTER TABLE `sell_stock_corrections` MODIFY `status` ENUM('PENDING', 'APPROVED', 'Partial', 'REJECTED') NOT NULL DEFAULT 'PENDING';
