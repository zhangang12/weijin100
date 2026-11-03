-- 实名人工审核：驳回原因
ALTER TABLE "KycInfo" ADD COLUMN "rejectReason" TEXT;

-- E5 限制到期自动解除：记录到期时间
ALTER TABLE "User" ADD COLUMN "limitedUntil" TIMESTAMP(3);
