-- Envío a domicilio con repartidores independientes.
-- Reversión: down.sql en esta misma carpeta (ver instrucciones ahí).
-- Nota: se omite a propósito el "DROP INDEX discounts_businessId_status_idx" que
-- `prisma migrate diff` propone; es una divergencia previa ajena a este cambio.

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeliveryFailureReason" AS ENUM ('CUSTOMER_UNREACHABLE', 'WRONG_ADDRESS', 'CUSTOMER_REJECTED', 'OTHER');

-- AlterEnum
ALTER TYPE "OrderFulfillmentType" ADD VALUE 'DELIVERY';

-- AlterEnum (mismo orden que schema.prisma)
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY' BEFORE 'CANCELLED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED' BEFORE 'CANCELLED';

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryFeeConfig" JSONB,
ADD COLUMN     "maxDeliveryKm" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddress" VARCHAR(200),
ADD COLUMN     "deliveryDistanceKm" DECIMAL(6,2),
ADD COLUMN     "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryLatitude" DECIMAL(10,7),
ADD COLUMN     "deliveryLongitude" DECIMAL(10,7),
ADD COLUMN     "deliveryReference" VARCHAR(200),
ADD COLUMN     "transferConfirmedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "couriers" (
    "id" TEXT NOT NULL,
    "phone" VARCHAR(10) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "courierId" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "offerTokenHash" CHAR(64) NOT NULL,
    "offerExpiresAt" TIMESTAMP(3) NOT NULL,
    "courierTokenHash" CHAR(64),
    "foodTotal" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "OrderPaymentMethod" NOT NULL,
    "amountCourierAdvances" DECIMAL(10,2) NOT NULL,
    "amountCourierCollects" DECIMAL(10,2) NOT NULL,
    "failureReason" "DeliveryFailureReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "handedOffAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "couriers_phone_key" ON "couriers"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_orderId_key" ON "deliveries"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_offerTokenHash_key" ON "deliveries"("offerTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_courierTokenHash_key" ON "deliveries"("courierTokenHash");

-- CreateIndex
CREATE INDEX "deliveries_businessId_idx" ON "deliveries"("businessId");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_courierId_idx" ON "deliveries"("courierId");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

