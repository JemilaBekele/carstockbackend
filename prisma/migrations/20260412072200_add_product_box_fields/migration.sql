/*
  Warnings:

  - You are about to drop the column `unitOfMeasureId` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `purchase_items` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `sell_items` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `sell_stock_correction_items` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `shop_stocks` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `stock_correction_items` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `stock_ledgers` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `store_stocks` table. All the data in the column will be lost.
  - You are about to drop the column `unitOfMeasureId` on the `transfer_items` table. All the data in the column will be lost.
  - You are about to drop the `unitofmeasure` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `products` DROP FOREIGN KEY `products_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `purchase_items` DROP FOREIGN KEY `purchase_items_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `sell_items` DROP FOREIGN KEY `sell_items_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `sell_stock_correction_items` DROP FOREIGN KEY `sell_stock_correction_items_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `shop_stocks` DROP FOREIGN KEY `shop_stocks_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_correction_items` DROP FOREIGN KEY `stock_correction_items_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `stock_ledgers` DROP FOREIGN KEY `stock_ledgers_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `store_stocks` DROP FOREIGN KEY `store_stocks_unitOfMeasureId_fkey`;

-- DropForeignKey
ALTER TABLE `transfer_items` DROP FOREIGN KEY `transfer_items_unitOfMeasureId_fkey`;

-- DropIndex
DROP INDEX `products_unitOfMeasureId_fkey` ON `products`;

-- DropIndex
DROP INDEX `purchase_items_unitOfMeasureId_fkey` ON `purchase_items`;

-- DropIndex
DROP INDEX `sell_items_unitOfMeasureId_fkey` ON `sell_items`;

-- DropIndex
DROP INDEX `sell_stock_correction_items_unitOfMeasureId_fkey` ON `sell_stock_correction_items`;

-- DropIndex
DROP INDEX `shop_stocks_unitOfMeasureId_fkey` ON `shop_stocks`;

-- DropIndex
DROP INDEX `stock_correction_items_unitOfMeasureId_fkey` ON `stock_correction_items`;

-- DropIndex
DROP INDEX `stock_ledgers_unitOfMeasureId_fkey` ON `stock_ledgers`;

-- DropIndex
DROP INDEX `store_stocks_unitOfMeasureId_fkey` ON `store_stocks`;

-- DropIndex
DROP INDEX `transfer_items_unitOfMeasureId_fkey` ON `transfer_items`;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `unitOfMeasureId`,
    ADD COLUMN `UnitOfMeasure` VARCHAR(191) NULL,
    ADD COLUMN `boxSize` INTEGER NULL,
    ADD COLUMN `brandId` VARCHAR(191) NULL,
    ADD COLUMN `hasBox` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `purchase_items` DROP COLUMN `unitOfMeasureId`;

-- AlterTable
ALTER TABLE `sell_items` DROP COLUMN `unitOfMeasureId`;

-- AlterTable
ALTER TABLE `sell_stock_correction_items` DROP COLUMN `unitOfMeasureId`;

-- AlterTable
ALTER TABLE `shop_stocks` DROP COLUMN `unitOfMeasureId`;

-- AlterTable
ALTER TABLE `stock_correction_items` DROP COLUMN `unitOfMeasureId`;

-- AlterTable
ALTER TABLE `stock_ledgers` DROP COLUMN `unitOfMeasureId`;

-- AlterTable
ALTER TABLE `store_stocks` DROP COLUMN `unitOfMeasureId`;

-- AlterTable
ALTER TABLE `transfer_items` DROP COLUMN `unitOfMeasureId`;

-- DropTable
DROP TABLE `unitofmeasure`;

-- CreateTable
CREATE TABLE `brands` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `brands`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;
