-- E3：信用修复门槛（记录创建时 completedTrades + 30，达到即可修复）
ALTER TABLE "DefaultRecord" ADD COLUMN "repairAtTrades" INTEGER;
