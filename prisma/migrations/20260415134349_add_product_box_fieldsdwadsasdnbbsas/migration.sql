/*
  Warnings:

  - Added the required column `action` to the `Permission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `resource` to the `Permission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `permission` ADD COLUMN `action` VARCHAR(100) NOT NULL,
    ADD COLUMN `resource` VARCHAR(100) NOT NULL;

-- AlterTable
ALTER TABLE `role` ADD COLUMN `isSystemRole` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `portalAccess` ENUM('WEB', 'STORE', 'SALES') NOT NULL DEFAULT 'WEB',
    ADD COLUMN `roleType` ENUM('GENERAL', 'STORE', 'SALES', 'ADMIN') NOT NULL DEFAULT 'GENERAL';

-- CreateTable
CREATE TABLE `auth_sessions` (
    `_id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `userAgent` VARCHAR(255) NULL,
    `ip` VARCHAR(100) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `auth_sessions_tokenHash_key`(`tokenHash`),
    INDEX `auth_sessions_userId_revokedAt_expiresAt_idx`(`userId`, `revokedAt`, `expiresAt`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `RolePermission_roleId_idx` ON `RolePermission`(`roleId`);

-- CreateIndex
CREATE INDEX `users_status_idx` ON `users`(`status`);

-- CreateIndex
CREATE INDEX `users_lastLoginAt_idx` ON `users`(`lastLoginAt`);

-- AddForeignKey
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `rolepermission` RENAME INDEX `RolePermission_permissionId_fkey` TO `RolePermission_permissionId_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `users_branchId_fkey` TO `users_branchId_idx`;

-- RenameIndex
ALTER TABLE `users` RENAME INDEX `users_roleId_fkey` TO `users_roleId_idx`;
