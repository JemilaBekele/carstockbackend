/*
  Warnings:

  - You are about to drop the column `UnitOfMeasure` on the `products` table. All the data in the column will be lost.
  - Added the required column `unitOfMeasureId` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `products` DROP COLUMN `UnitOfMeasure`,
    ADD COLUMN `numberunitOfMeasure` INTEGER NULL,
    ADD COLUMN `unitOfMeasureId` VARCHAR(191) NOT NULL;

-- CreateTable
CREATE TABLE `UnitOfMeasure` (
    `_id` CHAR(36) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `UnitOfMeasure_symbol_key`(`symbol`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `UnitOfMeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
