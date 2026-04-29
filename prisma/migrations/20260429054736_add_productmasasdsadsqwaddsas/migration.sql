-- CreateTable
CREATE TABLE `proformas` (
    `_id` CHAR(36) NOT NULL,
    `proformaNo` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `documentUrl` VARCHAR(191) NULL,
    `customerId` CHAR(36) NOT NULL,
    `shopId` CHAR(36) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `totalProducts` INTEGER NOT NULL DEFAULT 0,
    `subTotal` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `tax` DOUBLE NOT NULL DEFAULT 0,
    `grandTotal` DOUBLE NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `validUntil` DATETIME(3) NULL,
    `proformaDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` CHAR(36) NULL,
    `updatedById` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `proformas_proformaNo_key`(`proformaNo`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proforma_items` (
    `_id` CHAR(36) NOT NULL,
    `proformaId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `isBox` BOOLEAN NOT NULL DEFAULT false,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DOUBLE NOT NULL DEFAULT 0,
    `totalPrice` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `proformas` ADD CONSTRAINT `proformas_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proformas` ADD CONSTRAINT `proformas_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proformas` ADD CONSTRAINT `proformas_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proformas` ADD CONSTRAINT `proformas_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proforma_items` ADD CONSTRAINT `proforma_items_proformaId_fkey` FOREIGN KEY (`proformaId`) REFERENCES `proformas`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proforma_items` ADD CONSTRAINT `proforma_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
