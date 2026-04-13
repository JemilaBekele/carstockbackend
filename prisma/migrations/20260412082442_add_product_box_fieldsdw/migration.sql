/*
  Warnings:

  - You are about to drop the column `quantity` on the `stock_ledgers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `stock_ledgers` DROP COLUMN `quantity`,
    ADD COLUMN `boxQuantity` INTEGER NULL DEFAULT 0,
    ADD COLUMN `pieceQuantity` INTEGER NULL DEFAULT 0;
