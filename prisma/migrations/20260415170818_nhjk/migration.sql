/*
  Warnings:

  - You are about to drop the column `action` on the `permission` table. All the data in the column will be lost.
  - You are about to drop the column `resource` on the `permission` table. All the data in the column will be lost.
  - You are about to drop the column `isSystemRole` on the `role` table. All the data in the column will be lost.
  - You are about to drop the column `portalAccess` on the `role` table. All the data in the column will be lost.
  - You are about to drop the column `roleType` on the `role` table. All the data in the column will be lost.
  - You are about to drop the `auth_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `auth_sessions` DROP FOREIGN KEY `auth_sessions_userId_fkey`;

-- DropIndex
DROP INDEX `users_lastLoginAt_idx` ON `users`;

-- DropIndex
DROP INDEX `users_status_idx` ON `users`;

-- AlterTable
ALTER TABLE `permission` DROP COLUMN `action`,
    DROP COLUMN `resource`;

-- AlterTable
ALTER TABLE `role` DROP COLUMN `isSystemRole`,
    DROP COLUMN `portalAccess`,
    DROP COLUMN `roleType`;

-- DropTable
DROP TABLE `auth_sessions`;
