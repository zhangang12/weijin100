-- AlterTable: Order 添加仲裁开始时间（用于4h超时自动判定）
ALTER TABLE "Order" ADD COLUMN "arbitratingStartAt" TIMESTAMP(3);

-- AlterTable: Address 添加坐标（用于导航）
ALTER TABLE "Address" ADD COLUMN "latitude" DECIMAL(10,7);
ALTER TABLE "Address" ADD COLUMN "longitude" DECIMAL(10,7);
