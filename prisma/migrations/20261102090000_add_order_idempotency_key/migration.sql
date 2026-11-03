ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Order_businessId_idempotencyKey_key"
ON "Order"("businessId", "idempotencyKey");
