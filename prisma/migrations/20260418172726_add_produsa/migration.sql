/*
  Warnings:

  - You are about to drop the column `paymentDate` on the `sell_payments` table. All the data in the column will be lost.
  - You are about to drop the column `paymentMethod` on the `sell_payments` table. All the data in the column will be lost.
  - You are about to drop the column `referenceNo` on the `sell_payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `sell_payments` DROP COLUMN `paymentDate`,
    DROP COLUMN `paymentMethod`,
    DROP COLUMN `referenceNo`;

-- AlterTable
ALTER TABLE `sells` ADD COLUMN `balance` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalPaid` INTEGER NOT NULL DEFAULT 0;
