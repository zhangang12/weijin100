-- CreateEnum
CREATE TYPE "Metal" AS ENUM ('gold', 'silver', 'platinum');

-- CreateEnum
CREATE TYPE "ShipMode" AS ENUM ('whole_all', 'whole_fixed', 'bulk');

-- CreateEnum
CREATE TYPE "PayMethod" AS ENUM ('cash', 'transfer');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('none', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "FunctionStatus" AS ENUM ('normal', 'limited', 'frozen');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('selling', 'sold', 'offline');

-- CreateEnum
CREATE TYPE "LockStatus" AS ENUM ('processing', 'success', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('locked_pending', 'relay_inspecting', 'arbitrating', 'completed', 'cancelled', 'defaulted');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('face_to_face', 'relay');

-- CreateEnum
CREATE TYPE "DefaultStatus" AS ENUM ('active', 'repaired', 'appealing', 'revoked');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "MarginTxnType" AS ENUM ('recharge', 'refund', 'freeze', 'unfreeze', 'deduct');

-- CreateEnum
CREATE TYPE "PaymentBizType" AS ENUM ('margin_recharge', 'relay_fee');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'refunded', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "weijinNo" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "unionid" TEXT,
    "nickname" TEXT NOT NULL,
    "avatar" TEXT,
    "phone" TEXT,
    "wechat" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "completedTrades" INTEGER NOT NULL DEFAULT 0,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'none',
    "functionStatus" "FunctionStatus" NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycInfo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "realName" TEXT NOT NULL,
    "idCardNo" TEXT NOT NULL,
    "frontImg" TEXT,
    "backImg" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarginAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalBalance" BIGINT NOT NULL DEFAULT 0,
    "available" BIGINT NOT NULL DEFAULT 0,
    "frozen" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarginAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarginTxn" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "MarginTxnType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "refOrderNo" TEXT,
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarginTxn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "metal" "Metal" NOT NULL,
    "category" TEXT NOT NULL,
    "goodsName" TEXT NOT NULL,
    "tags" TEXT[],
    "images" TEXT[],
    "batchNumber" TEXT,
    "sourcePlace" TEXT,
    "totalWeight" DECIMAL(12,3) NOT NULL,
    "remainingWeight" DECIMAL(12,3) NOT NULL,
    "shipMode" "ShipMode" NOT NULL,
    "minBatch" DECIMAL(12,3),
    "lotSize" DECIMAL(12,3),
    "refPriceCash" DECIMAL(12,2) NOT NULL,
    "refPriceTransfer" DECIMAL(12,2),
    "supportTransfer" BOOLEAN NOT NULL DEFAULT false,
    "status" "ListingStatus" NOT NULL DEFAULT 'selling',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockOrder" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "metal" "Metal" NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "payMethod" "PayMethod" NOT NULL,
    "snapshotPrice" DECIMAL(12,2) NOT NULL,
    "snapshotVersion" TEXT NOT NULL,
    "quoteTime" TIMESTAMP(3) NOT NULL,
    "status" "LockStatus" NOT NULL DEFAULT 'processing',
    "orderId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LockOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'locked_pending',
    "metal" "Metal" NOT NULL,
    "productName" TEXT NOT NULL,
    "weight" DECIMAL(12,3) NOT NULL,
    "priceCash" DECIMAL(12,2) NOT NULL,
    "priceTransfer" DECIMAL(12,2),
    "payMethod" "PayMethod" NOT NULL,
    "supportsTransfer" BOOLEAN NOT NULL DEFAULT false,
    "totalCash" BIGINT NOT NULL,
    "totalTransfer" BIGINT,
    "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'face_to_face',
    "buyerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sellerConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "countdownExpireAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelayProgress" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "relayStatus" TEXT NOT NULL,
    "feePaid" BOOLEAN NOT NULL DEFAULT false,
    "steps" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RelayProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DefaultRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "weight" DECIMAL(12,3),
    "deductAmount" BIGINT NOT NULL DEFAULT 0,
    "penalty" TEXT NOT NULL,
    "recordStatus" "DefaultStatus" NOT NULL DEFAULT 'active',
    "appealDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DefaultRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "defaultId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[],
    "status" "AppealStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metal" "Metal" NOT NULL,
    "condition" TEXT NOT NULL,
    "targetPrice" DECIMAL(12,2) NOT NULL,
    "channels" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bizType" "PaymentBizType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "outTradeNo" TEXT NOT NULL,
    "transactionId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "refOrderNo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "detail" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_weijinNo_key" ON "User"("weijinNo");

-- CreateIndex
CREATE UNIQUE INDEX "User_openid_key" ON "User"("openid");

-- CreateIndex
CREATE UNIQUE INDEX "KycInfo_userId_key" ON "KycInfo"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MarginAccount_userId_key" ON "MarginAccount"("userId");

-- CreateIndex
CREATE INDEX "MarginTxn_accountId_idx" ON "MarginTxn"("accountId");

-- CreateIndex
CREATE INDEX "Listing_metal_status_idx" ON "Listing"("metal", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LockOrder_orderId_key" ON "LockOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "LockOrder_idempotencyKey_key" ON "LockOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LockOrder_buyerId_idx" ON "LockOrder"("buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNo_key" ON "Order"("orderNo");

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");

-- CreateIndex
CREATE INDEX "Order_sellerId_idx" ON "Order"("sellerId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RelayProgress_orderId_key" ON "RelayProgress"("orderId");

-- CreateIndex
CREATE INDEX "DefaultRecord_userId_idx" ON "DefaultRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_defaultId_key" ON "Appeal"("defaultId");

-- CreateIndex
CREATE INDEX "Address_userId_idx" ON "Address"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRecord_outTradeNo_key" ON "PaymentRecord"("outTradeNo");

-- CreateIndex
CREATE INDEX "PaymentRecord_userId_idx" ON "PaymentRecord"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "KycInfo" ADD CONSTRAINT "KycInfo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginAccount" ADD CONSTRAINT "MarginAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginTxn" ADD CONSTRAINT "MarginTxn_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MarginAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockOrder" ADD CONSTRAINT "LockOrder_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockOrder" ADD CONSTRAINT "LockOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockOrder" ADD CONSTRAINT "LockOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelayProgress" ADD CONSTRAINT "RelayProgress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefaultRecord" ADD CONSTRAINT "DefaultRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DefaultRecord" ADD CONSTRAINT "DefaultRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_defaultId_fkey" FOREIGN KEY ("defaultId") REFERENCES "DefaultRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
