-- DropForeignKey
ALTER TABLE `purchases` DROP FOREIGN KEY `purchases_storeId_fkey`;

-- DropIndex
DROP INDEX `purchases_storeId_fkey` ON `purchases`;

-- AlterTable
ALTER TABLE `purchases` ADD COLUMN `shopId` CHAR(36) NULL,
    MODIFY `storeId` CHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;
