-- CreateTable
CREATE TABLE `AgentStorefront` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agentId` INTEGER NOT NULL,
    `storeName` VARCHAR(255) NOT NULL,
    `momoNumber` VARCHAR(20) NULL,
    `momoName` VARCHAR(255) NULL,
    `storeSlug` VARCHAR(100) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AgentStorefront_agentId_key`(`agentId`),
    UNIQUE INDEX `AgentStorefront_storeSlug_key`(`storeSlug`),
    INDEX `AgentStorefront_agentId_idx`(`agentId`),
    INDEX `AgentStorefront_storeSlug_idx`(`storeSlug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentProfit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `agentId` INTEGER NOT NULL,
    `orderId` INTEGER NOT NULL,
    `orderReference` VARCHAR(255) NOT NULL,
    `customerPrice` DOUBLE NOT NULL,
    `adminPrice` DOUBLE NOT NULL,
    `profit` DOUBLE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentProfit_agentId_idx`(`agentId`),
    INDEX `AgentProfit_status_idx`(`status`),
    INDEX `AgentProfit_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentStorefrontProduct` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storefrontId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `customPrice` DOUBLE NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentStorefrontProduct_storefrontId_idx`(`storefrontId`),
    INDEX `AgentStorefrontProduct_productId_idx`(`productId`),
    UNIQUE INDEX `AgentStorefrontProduct_storefrontId_productId_key`(`storefrontId`, `productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgentStoreOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `storefrontId` INTEGER NOT NULL,
    `customerName` VARCHAR(255) NOT NULL,
    `customerPhone` VARCHAR(20) NOT NULL,
    `productId` INTEGER NOT NULL,
    `productName` VARCHAR(255) NOT NULL,
    `productDescription` VARCHAR(255) NULL,
    `customerPrice` DOUBLE NOT NULL,
    `agentPrice` DOUBLE NOT NULL,
    `transactionId` VARCHAR(255) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Pending',
    `isAddedToCart` BOOLEAN NOT NULL DEFAULT false,
    `isPushedToAdmin` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AgentStoreOrder_storefrontId_idx`(`storefrontId`),
    INDEX `AgentStoreOrder_status_idx`(`status`),
    INDEX `AgentStoreOrder_transactionId_idx`(`transactionId`),
    INDEX `AgentStoreOrder_isPushedToAdmin_idx`(`isPushedToAdmin`),
    INDEX `AgentStoreOrder_isAddedToCart_idx`(`isAddedToCart`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AgentStorefrontProduct` ADD CONSTRAINT `AgentStorefrontProduct_storefrontId_fkey` FOREIGN KEY (`storefrontId`) REFERENCES `AgentStorefront`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgentStoreOrder` ADD CONSTRAINT `AgentStoreOrder_storefrontId_fkey` FOREIGN KEY (`storefrontId`) REFERENCES `AgentStorefront`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
