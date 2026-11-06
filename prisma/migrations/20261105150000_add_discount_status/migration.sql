CREATE TYPE "DiscountStatus" AS ENUM ('ACTIVE', 'FINISHED', 'DELETED');

ALTER TABLE "discounts" ADD COLUMN "status" "DiscountStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "discounts_businessId_status_idx" ON "discounts"("businessId", "status");
