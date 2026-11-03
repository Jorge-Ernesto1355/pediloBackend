CREATE TYPE "CustomerDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE "CustomerDiscountStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'USED', 'EXPIRED', 'CANCELLED');

ALTER TABLE "Order"
ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE TABLE "CustomerDiscount" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "grantedFromOrderId" TEXT,
  "usedOrderId" TEXT,
  "type" "CustomerDiscountType" NOT NULL,
  "value" DECIMAL(10,2) NOT NULL,
  "status" "CustomerDiscountStatus" NOT NULL DEFAULT 'AVAILABLE',
  "expiresAt" TIMESTAMP(3),
  "reservedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerDiscount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerDiscount_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerDiscount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerDiscount_grantedFromOrderId_fkey" FOREIGN KEY ("grantedFromOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CustomerDiscount_usedOrderId_fkey" FOREIGN KEY ("usedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerDiscount_usedOrderId_key" ON "CustomerDiscount"("usedOrderId");
CREATE UNIQUE INDEX "CustomerDiscount_one_active_per_customer_business_key"
  ON "CustomerDiscount"("businessId", "customerId")
  WHERE "status" IN ('AVAILABLE', 'RESERVED');
CREATE INDEX "CustomerDiscount_businessId_customerId_status_idx" ON "CustomerDiscount"("businessId", "customerId", "status");
CREATE INDEX "CustomerDiscount_expiresAt_idx" ON "CustomerDiscount"("expiresAt");
CREATE INDEX "CustomerDiscount_grantedFromOrderId_idx" ON "CustomerDiscount"("grantedFromOrderId");
