-- B2：一方确认后 24h 自动完成的计时起点
ALTER TABLE "Order" ADD COLUMN "firstConfirmedAt" TIMESTAMP(3);

-- B4：仲裁材料落库（情况说明 ≤500 字 + 聊天截图 ≤5 张）
ALTER TABLE "Order" ADD COLUMN "arbReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "arbEvidence" JSONB;

-- B6：平台代交接需对方同意（发起方 + 同意标志）
ALTER TABLE "RelayProgress" ADD COLUMN "initiatorId" TEXT;
ALTER TABLE "RelayProgress" ADD COLUMN "peerAgreed" BOOLEAN NOT NULL DEFAULT false;

-- F6/F7：挂单定价模式 + 溢价 + 最低防守价落库
ALTER TABLE "Listing" ADD COLUMN "priceMode" TEXT NOT NULL DEFAULT 'spot';
ALTER TABLE "Listing" ADD COLUMN "premiumCash" DECIMAL(12,2);
ALTER TABLE "Listing" ADD COLUMN "premiumTransfer" DECIMAL(12,2);
ALTER TABLE "Listing" ADD COLUMN "floorPrice" DECIMAL(12,2);

-- D1：等级 L1–L9（新用户默认 L1，历史 L0 回填 L1）
ALTER TABLE "User" ALTER COLUMN "level" SET DEFAULT 1;
UPDATE "User" SET "level" = 1 WHERE "level" = 0;
