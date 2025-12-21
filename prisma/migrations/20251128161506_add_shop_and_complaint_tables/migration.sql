-- AlterTable
ALTER TABLE `product` ADD COLUMN `showOnShop` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `transaction` ADD COLUMN `previousBalance` DOUBLE NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `SmsMessage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `phoneNumber` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `reference` VARCHAR(255) NULL,
    `amount` DOUBLE NULL,
    `isProcessed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Shop` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `amount` DOUBLE NOT NULL,
    `reference` VARCHAR(255) NOT NULL,
    `phoneNumber` VARCHAR(20) NOT NULL,
    `message` TEXT NULL,
    `deduction` DOUBLE NULL,
    `fullName` VARCHAR(255) NULL,
    `productName` VARCHAR(255) NULL,
    `productPrice` DOUBLE NULL,
    `orderTime` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Shop_reference_idx`(`reference`),
    INDEX `Shop_phoneNumber_idx`(`phoneNumber`),
    INDEX `Shop_orderTime_idx`(`orderTime`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Complaint` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(255) NOT NULL,
    `mobileNumber` VARCHAR(20) NOT NULL,
    `productName` VARCHAR(255) NOT NULL,
    `productCost` DOUBLE NOT NULL,
    `transactionId` VARCHAR(255) NOT NULL,
    `complaint` TEXT NOT NULL,
    `orderTime` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',

    INDEX `Complaint_mobileNumber_idx`(`mobileNumber`),
    INDEX `Complaint_transactionId_idx`(`transactionId`),
    INDEX `Complaint_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_createdAt_idx` ON `Order`(`createdAt`);

-- CreateIndex
CREATE INDEX `Order_status_idx` ON `Order`(`status`);

-- CreateIndex
CREATE INDEX `Order_mobileNumber_idx` ON `Order`(`mobileNumber`);

-- CreateIndex
CREATE INDEX `Order_userId_createdAt_idx` ON `Order`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `OrderItem_status_idx` ON `OrderItem`(`status`);

-- CreateIndex
CREATE INDEX `OrderItem_mobileNumber_idx` ON `OrderItem`(`mobileNumber`);

-- CreateIndex
CREATE INDEX `OrderItem_orderId_status_idx` ON `OrderItem`(`orderId`, `status`);

-- CreateIndex
CREATE INDEX `Transaction_userId_createdAt_idx` ON `Transaction`(`userId`, `createdAt`);

-- CreateIndex
CREATE INDEX `Transaction_type_idx` ON `Transaction`(`type`);

-- CreateIndex
CREATE INDEX `Transaction_createdAt_idx` ON `Transaction`(`createdAt`);

-- CreateIndex
CREATE INDEX `Transaction_reference_idx` ON `Transaction`(`reference`);
