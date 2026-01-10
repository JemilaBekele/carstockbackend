/*
  Warnings:

  - The values [Partial] on the enum `sell_stock_corrections_status` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `sell_stock_corrections` MODIFY `status` ENUM('PENDING', 'APPROVED', 'PARTIAL', 'REJECTED') NOT NULL DEFAULT 'PENDING';
