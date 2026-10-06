-- Existing orders were created through the public order flow.
CREATE TYPE "OrderSource" AS ENUM ('PUBLIC', 'RESTAURANT');

ALTER TABLE "Order" ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'PUBLIC';

CREATE INDEX "Order_businessId_source_createdAt_idx"
ON "Order"("businessId", "source", "createdAt");
