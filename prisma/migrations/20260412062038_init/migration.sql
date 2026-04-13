-- CreateTable
CREATE TABLE `users` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `userCode` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `admin` BOOLEAN NOT NULL DEFAULT false,
    `password` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `roleId` CHAR(36) NOT NULL,
    `status` ENUM('Active', 'Inactive', 'Suspended') NOT NULL DEFAULT 'Active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `lastLoginAt` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Permission_name_key`(`name`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `_id` CHAR(36) NOT NULL,
    `roleId` CHAR(36) NOT NULL,
    `permissionId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RolePermission_roleId_permissionId_key`(`roleId`, `permissionId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `tinAddress` VARCHAR(191) NULL,
    `TIN` VARCHAR(191) NULL,
    `From` VARCHAR(191) NULL,
    `logo` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_email_key`(`email`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `branches` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shops` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stores` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `store_stocks` (
    `_id` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `status` ENUM('Available', 'Reserved', 'Sold', 'Damaged', 'Returned', 'Disposed') NOT NULL DEFAULT 'Available',
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `store_stocks_storeId_productId_key`(`storeId`, `productId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shop_stocks` (
    `_id` CHAR(36) NOT NULL,
    `shopId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `status` ENUM('Available', 'Reserved', 'Sold', 'Damaged', 'Returned', 'Disposed') NOT NULL DEFAULT 'Available',
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shop_stocks_shopId_productId_key`(`shopId`, `productId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_ledgers` (
    `_id` CHAR(36) NOT NULL,
    `invoiceNo` VARCHAR(191) NULL,
    `productId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NULL,
    `shopId` CHAR(36) NULL,
    `movementType` ENUM('IN', 'OUT', 'TRANSFER', 'ADJUSTMENT', 'RETERN') NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `reference` VARCHAR(191) NULL,
    `userId` CHAR(36) NULL,
    `notes` VARCHAR(191) NULL,
    `movementDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_ledgers_invoiceNo_key`(`invoiceNo`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_logs` (
    `_id` CHAR(36) NOT NULL,
    `action` VARCHAR(1000) NOT NULL,
    `userId` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `_id` CHAR(36) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(255) NULL,
    `phone1` VARCHAR(191) NOT NULL,
    `phone2` VARCHAR(191) NULL,
    `tinNumber` VARCHAR(100) NULL,
    `address` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `contactName` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(100) NULL,
    `country` VARCHAR(100) NULL,
    `tinNumber` VARCHAR(100) NULL,
    `notes` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `_id` CHAR(36) NOT NULL,
    `productCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `generic` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `sellPrice` DECIMAL(10, 2) NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_productCode_key`(`productCode`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `additional_prices` (
    `_id` CHAR(36) NOT NULL,
    `label` VARCHAR(191) NULL,
    `price` DOUBLE NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `shopId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `additional_prices_productId_label_key`(`productId`, `label`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unitofmeasure` (
    `_id` CHAR(36) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NULL,
    `base` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `unitofmeasure_name_key`(`name`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchases` (
    `_id` CHAR(36) NOT NULL,
    `invoiceNo` VARCHAR(191) NOT NULL,
    `supplierId` CHAR(36) NOT NULL,
    `storeId` CHAR(36) NOT NULL,
    `paymentStatus` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `totalProducts` INTEGER NOT NULL DEFAULT 0,
    `subTotal` DOUBLE NOT NULL DEFAULT 0,
    `grandTotal` DOUBLE NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `purchaseDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` CHAR(36) NULL,
    `updatedById` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchases_invoiceNo_key`(`invoiceNo`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_items` (
    `_id` CHAR(36) NOT NULL,
    `purchaseId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DOUBLE NOT NULL DEFAULT 0,
    `totalPrice` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfers` (
    `_id` CHAR(36) NOT NULL,
    `shortCode` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('STORE', 'SHOP') NOT NULL,
    `sourceStoreId` CHAR(36) NULL,
    `sourceShopId` CHAR(36) NULL,
    `destinationType` ENUM('STORE', 'SHOP') NOT NULL,
    `destStoreId` CHAR(36) NULL,
    `destShopId` CHAR(36) NULL,
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `movementDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` CHAR(36) NULL,
    `updatedById` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transfers_shortCode_key`(`shortCode`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transfer_items` (
    `_id` CHAR(36) NOT NULL,
    `transferId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_corrections` (
    `_id` CHAR(36) NOT NULL,
    `shortCode` VARCHAR(191) NOT NULL,
    `storeId` CHAR(36) NULL,
    `shopId` CHAR(36) NULL,
    `reason` ENUM('PURCHASE_ERROR', 'TRANSFER_ERROR', 'EXPIRED', 'DAMAGED', 'MANUAL_ADJUSTMENT') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `purchaseId` CHAR(36) NULL,
    `transferId` CHAR(36) NULL,
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` CHAR(36) NULL,
    `updatedById` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_corrections_shortCode_key`(`shortCode`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_correction_items` (
    `_id` CHAR(36) NOT NULL,
    `correctionId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sells` (
    `_id` CHAR(36) NOT NULL,
    `invoiceNo` VARCHAR(191) NOT NULL,
    `saleStatus` ENUM('NOT_APPROVED', 'PARTIALLY_DELIVERED', 'APPROVED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'NOT_APPROVED',
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `lockedAt` DATETIME(3) NULL,
    `branchId` VARCHAR(191) NULL,
    `customerId` CHAR(36) NULL,
    `totalProducts` INTEGER NOT NULL DEFAULT 0,
    `subTotal` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `vat` DOUBLE NOT NULL DEFAULT 0,
    `grandTotal` DOUBLE NOT NULL DEFAULT 0,
    `NetTotal` DOUBLE NOT NULL DEFAULT 0,
    `notes` VARCHAR(191) NULL,
    `saleDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` CHAR(36) NULL,
    `updatedById` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sells_invoiceNo_key`(`invoiceNo`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sell_items` (
    `_id` CHAR(36) NOT NULL,
    `sellId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `shopId` CHAR(36) NOT NULL,
    `unitOfMeasureId` VARCHAR(191) NOT NULL,
    `itemSaleStatus` ENUM('PENDING', 'DELIVERED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `quantity` INTEGER NOT NULL,
    `unitPrice` DOUBLE NOT NULL DEFAULT 0,
    `totalPrice` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sell_stock_corrections` (
    `_id` CHAR(36) NOT NULL,
    `sellId` CHAR(36) NULL,
    `isChecked` BOOLEAN NULL DEFAULT false,
    `isCh` BOOLEAN NULL DEFAULT false,
    `status` ENUM('PENDING', 'APPROVED', 'PARTIAL', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reference` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdById` CHAR(36) NULL,
    `updatedById` CHAR(36) NULL,
    `total` DOUBLE NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sell_stock_correction_items` (
    `_id` CHAR(36) NOT NULL,
    `correctionId` CHAR(36) NOT NULL,
    `productId` CHAR(36) NOT NULL,
    `shopId` CHAR(36) NULL,
    `unitOfMeasureId` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` DOUBLE NOT NULL DEFAULT 0,
    `totalPrice` DOUBLE NOT NULL DEFAULT 0,
    `itemSaleStatus` ENUM('PENDING', 'DELIVERED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `_id` CHAR(36) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `type` ENUM('SELL_READY_FOR_DELIVERY', 'SELL_CANCELLED', 'Done', 'Payment', 'Inventory', 'System', 'Approval') NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `relatedEntityType` ENUM('SELL', 'MaintenanceRequest', 'Invoice', 'PurchaseOrder', 'InventoryRequest') NULL,
    `relatedEntityId` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read_at` DATETIME(3) NULL,
    `storeId` CHAR(36) NULL,
    `shopId` CHAR(36) NULL,

    INDEX `notifications_read_idx`(`read`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_UserShops` (
    `A` CHAR(36) NOT NULL,
    `B` CHAR(36) NOT NULL,

    UNIQUE INDEX `_UserShops_AB_unique`(`A`, `B`),
    INDEX `_UserShops_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_UserStores` (
    `A` CHAR(36) NOT NULL,
    `B` CHAR(36) NOT NULL,

    UNIQUE INDEX `_UserStores_AB_unique`(`A`, `B`),
    INDEX `_UserStores_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shops` ADD CONSTRAINT `shops_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stores` ADD CONSTRAINT `stores_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_stocks` ADD CONSTRAINT `store_stocks_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_stocks` ADD CONSTRAINT `store_stocks_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `store_stocks` ADD CONSTRAINT `store_stocks_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shop_stocks` ADD CONSTRAINT `shop_stocks_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shop_stocks` ADD CONSTRAINT `shop_stocks_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `shop_stocks` ADD CONSTRAINT `shop_stocks_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_ledgers` ADD CONSTRAINT `stock_ledgers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_logs` ADD CONSTRAINT `stock_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `additional_prices` ADD CONSTRAINT `additional_prices_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `additional_prices` ADD CONSTRAINT `additional_prices_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplierId_fkey` FOREIGN KEY (`supplierId`) REFERENCES `suppliers`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_sourceStoreId_fkey` FOREIGN KEY (`sourceStoreId`) REFERENCES `stores`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_sourceShopId_fkey` FOREIGN KEY (`sourceShopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_destStoreId_fkey` FOREIGN KEY (`destStoreId`) REFERENCES `stores`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_destShopId_fkey` FOREIGN KEY (`destShopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfers` ADD CONSTRAINT `transfers_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_items` ADD CONSTRAINT `transfer_items_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `transfers`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_items` ADD CONSTRAINT `transfer_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transfer_items` ADD CONSTRAINT `transfer_items_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_corrections` ADD CONSTRAINT `stock_corrections_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_corrections` ADD CONSTRAINT `stock_corrections_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_corrections` ADD CONSTRAINT `stock_corrections_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `purchases`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_corrections` ADD CONSTRAINT `stock_corrections_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `transfers`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_corrections` ADD CONSTRAINT `stock_corrections_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_corrections` ADD CONSTRAINT `stock_corrections_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_correction_items` ADD CONSTRAINT `stock_correction_items_correctionId_fkey` FOREIGN KEY (`correctionId`) REFERENCES `stock_corrections`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_correction_items` ADD CONSTRAINT `stock_correction_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_correction_items` ADD CONSTRAINT `stock_correction_items_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sells` ADD CONSTRAINT `sells_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `branches`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sells` ADD CONSTRAINT `sells_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `customers`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sells` ADD CONSTRAINT `sells_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sells` ADD CONSTRAINT `sells_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_items` ADD CONSTRAINT `sell_items_sellId_fkey` FOREIGN KEY (`sellId`) REFERENCES `sells`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_items` ADD CONSTRAINT `sell_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_items` ADD CONSTRAINT `sell_items_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_items` ADD CONSTRAINT `sell_items_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_stock_corrections` ADD CONSTRAINT `sell_stock_corrections_sellId_fkey` FOREIGN KEY (`sellId`) REFERENCES `sells`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_stock_corrections` ADD CONSTRAINT `sell_stock_corrections_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_stock_corrections` ADD CONSTRAINT `sell_stock_corrections_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `users`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_stock_correction_items` ADD CONSTRAINT `sell_stock_correction_items_correctionId_fkey` FOREIGN KEY (`correctionId`) REFERENCES `sell_stock_corrections`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_stock_correction_items` ADD CONSTRAINT `sell_stock_correction_items_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_stock_correction_items` ADD CONSTRAINT `sell_stock_correction_items_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sell_stock_correction_items` ADD CONSTRAINT `sell_stock_correction_items_unitOfMeasureId_fkey` FOREIGN KEY (`unitOfMeasureId`) REFERENCES `unitofmeasure`(`_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_storeId_fkey` FOREIGN KEY (`storeId`) REFERENCES `stores`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_shopId_fkey` FOREIGN KEY (`shopId`) REFERENCES `shops`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserShops` ADD CONSTRAINT `_UserShops_A_fkey` FOREIGN KEY (`A`) REFERENCES `shops`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserShops` ADD CONSTRAINT `_UserShops_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserStores` ADD CONSTRAINT `_UserStores_A_fkey` FOREIGN KEY (`A`) REFERENCES `stores`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_UserStores` ADD CONSTRAINT `_UserStores_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;
