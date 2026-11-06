CREATE TYPE "OrderPaymentMethod" AS ENUM ('CASH', 'TRANSFER');

CREATE TABLE "restaurant_payment_cards" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "clabe" VARCHAR(18) NOT NULL,
    "beneficiaryName" VARCHAR(80) NOT NULL,
    "bankCode" VARCHAR(3) NOT NULL,
    "bankName" VARCHAR(80) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "restaurant_payment_cards_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order" ADD COLUMN "paymentMethod" "OrderPaymentMethod" NOT NULL DEFAULT 'CASH';

CREATE UNIQUE INDEX "restaurant_payment_cards_businessId_key" ON "restaurant_payment_cards"("businessId");
ALTER TABLE "restaurant_payment_cards" ADD CONSTRAINT "restaurant_payment_cards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
