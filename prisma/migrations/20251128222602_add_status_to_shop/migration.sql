-- AlterTable
ALTER TABLE `shop` ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'Pending';

-- CreateIndex
CREATE INDEX `Shop_status_idx` ON `Shop`(`status`);
