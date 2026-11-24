-- Tarjeta de lealtad por sellos (programa, tarjetas, sellos y premios).
-- Reversión: down.sql en esta misma carpeta (ver instrucciones ahí).
-- Nota: se omiten a propósito los cambios ajenos que `prisma migrate diff` propone contra la
-- base local (tablas de inventario de otra rama, columnas de OrderItemOption y el índice
-- discounts_businessId_status_idx); no forman parte de este cambio.

-- CreateEnum
CREATE TYPE "LoyaltyStampMode" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "LoyaltyRewardType" AS ENUM ('PERCENT', 'FIXED', 'FREE_PRODUCT');

-- CreateEnum
CREATE TYPE "LoyaltyStampSource" AS ENUM ('ORDER_MANUAL', 'ORDER_AUTO', 'WALK_IN');

-- CreateEnum
CREATE TYPE "LoyaltyRewardStatus" AS ENUM ('AVAILABLE', 'REDEEMED', 'EXPIRED', 'VOID');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "loyaltyDiscountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyRewardId" TEXT;

-- CreateTable
CREATE TABLE "loyalty_programs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stampsRequired" INTEGER NOT NULL DEFAULT 8,
    "stampMode" "LoyaltyStampMode" NOT NULL DEFAULT 'MANUAL',
    "minOrderAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rewardType" "LoyaltyRewardType" NOT NULL DEFAULT 'PERCENT',
    "rewardValue" DECIMAL(10,2) NOT NULL DEFAULT 20,
    "rewardProductId" TEXT,
    "rewardLabel" VARCHAR(40) NOT NULL,
    "rewardExpiresDays" INTEGER,
    "walkInDailyLimit" INTEGER NOT NULL DEFAULT 5,
    "design" JSONB NOT NULL,
    "designVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_cards" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "publicToken" VARCHAR(64) NOT NULL,
    "stampsCount" INTEGER NOT NULL DEFAULT 0,
    "cyclesCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_stamps" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "orderId" TEXT,
    "source" "LoyaltyStampSource" NOT NULL,
    "note" VARCHAR(140),
    "createdByUserId" TEXT,
    "cycle" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedReason" VARCHAR(140),
    "voidedByUserId" TEXT,

    CONSTRAINT "loyalty_stamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_rewards" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" "LoyaltyRewardStatus" NOT NULL DEFAULT 'AVAILABLE',
    "rewardType" "LoyaltyRewardType" NOT NULL,
    "rewardValue" DECIMAL(10,2) NOT NULL,
    "rewardProductId" TEXT,
    "rewardProductName" VARCHAR(120),
    "rewardLabel" VARCHAR(40) NOT NULL,
    "cycle" INTEGER NOT NULL,
    "sourceStampId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "redeemedOrderId" TEXT,
    "redeemedByUserId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_programs_businessId_key" ON "loyalty_programs"("businessId");

-- CreateIndex
CREATE INDEX "loyalty_programs_rewardProductId_idx" ON "loyalty_programs"("rewardProductId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_cards_publicToken_key" ON "loyalty_cards"("publicToken");

-- CreateIndex
CREATE INDEX "loyalty_cards_customerId_idx" ON "loyalty_cards"("customerId");

-- CreateIndex
CREATE INDEX "loyalty_cards_businessId_stampsCount_idx" ON "loyalty_cards"("businessId", "stampsCount");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_cards_businessId_customerId_key" ON "loyalty_cards"("businessId", "customerId");

-- CreateIndex
CREATE INDEX "loyalty_stamps_cardId_createdAt_idx" ON "loyalty_stamps"("cardId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_stamps_businessId_createdAt_idx" ON "loyalty_stamps"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "loyalty_stamps_orderId_idx" ON "loyalty_stamps"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_rewards_sourceStampId_key" ON "loyalty_rewards"("sourceStampId");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_rewards_redeemedOrderId_key" ON "loyalty_rewards"("redeemedOrderId");

-- CreateIndex
CREATE INDEX "loyalty_rewards_cardId_status_idx" ON "loyalty_rewards"("cardId", "status");

-- CreateIndex
CREATE INDEX "loyalty_rewards_businessId_status_idx" ON "loyalty_rewards"("businessId", "status");

-- CreateIndex
CREATE INDEX "loyalty_rewards_rewardProductId_idx" ON "loyalty_rewards"("rewardProductId");

-- CreateIndex
CREATE INDEX "Order_loyaltyRewardId_idx" ON "Order"("loyaltyRewardId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_loyaltyRewardId_fkey" FOREIGN KEY ("loyaltyRewardId") REFERENCES "loyalty_rewards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_programs" ADD CONSTRAINT "loyalty_programs_rewardProductId_fkey" FOREIGN KEY ("rewardProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_cards" ADD CONSTRAINT "loyalty_cards_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_stamps" ADD CONSTRAINT "loyalty_stamps_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "loyalty_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_stamps" ADD CONSTRAINT "loyalty_stamps_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_stamps" ADD CONSTRAINT "loyalty_stamps_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_stamps" ADD CONSTRAINT "loyalty_stamps_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_stamps" ADD CONSTRAINT "loyalty_stamps_voidedByUserId_fkey" FOREIGN KEY ("voidedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "loyalty_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_rewardProductId_fkey" FOREIGN KEY ("rewardProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_sourceStampId_fkey" FOREIGN KEY ("sourceStampId") REFERENCES "loyalty_stamps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_redeemedOrderId_fkey" FOREIGN KEY ("redeemedOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_rewards" ADD CONSTRAINT "loyalty_rewards_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Un pedido sella una sola vez: único parcial sobre sellos vigentes (Prisma no lo expresa).
CREATE UNIQUE INDEX "loyalty_stamps_active_order_key" ON "loyalty_stamps"("orderId")
  WHERE "orderId" IS NOT NULL AND "voidedAt" IS NULL;

-- Restricciones de integridad (mismos límites que valida el dominio).
ALTER TABLE "loyalty_programs"
  ADD CONSTRAINT "loyalty_programs_stamps_required_check" CHECK ("stampsRequired" BETWEEN 3 AND 20),
  ADD CONSTRAINT "loyalty_programs_min_order_amount_check" CHECK ("minOrderAmount" >= 0),
  ADD CONSTRAINT "loyalty_programs_reward_value_check" CHECK ("rewardValue" >= 0),
  ADD CONSTRAINT "loyalty_programs_reward_percent_check"
    CHECK ("rewardType" <> 'PERCENT' OR ("rewardValue" > 0 AND "rewardValue" <= 100)),
  ADD CONSTRAINT "loyalty_programs_reward_expires_days_check"
    CHECK ("rewardExpiresDays" IS NULL OR "rewardExpiresDays" BETWEEN 1 AND 365),
  ADD CONSTRAINT "loyalty_programs_walk_in_daily_limit_check" CHECK ("walkInDailyLimit" BETWEEN 1 AND 20),
  ADD CONSTRAINT "loyalty_programs_design_version_check" CHECK ("designVersion" >= 1),
  ADD CONSTRAINT "loyalty_programs_design_object_check" CHECK (jsonb_typeof("design") = 'object');

ALTER TABLE "loyalty_cards"
  ADD CONSTRAINT "loyalty_cards_stamps_count_check" CHECK ("stampsCount" >= 0),
  ADD CONSTRAINT "loyalty_cards_cycles_completed_check" CHECK ("cyclesCompleted" >= 0),
  ADD CONSTRAINT "loyalty_cards_public_token_check" CHECK (char_length("publicToken") >= 32);

ALTER TABLE "loyalty_stamps"
  ADD CONSTRAINT "loyalty_stamps_cycle_check" CHECK ("cycle" >= 0),
  ADD CONSTRAINT "loyalty_stamps_position_check" CHECK ("position" >= 1),
  ADD CONSTRAINT "loyalty_stamps_walk_in_order_check" CHECK ("source" <> 'WALK_IN' OR "orderId" IS NULL),
  ADD CONSTRAINT "loyalty_stamps_void_reason_check" CHECK ("voidedAt" IS NULL OR "voidedReason" IS NOT NULL);

ALTER TABLE "loyalty_rewards"
  ADD CONSTRAINT "loyalty_rewards_reward_value_check" CHECK ("rewardValue" >= 0),
  ADD CONSTRAINT "loyalty_rewards_cycle_check" CHECK ("cycle" >= 0),
  ADD CONSTRAINT "loyalty_rewards_redeemed_check" CHECK ("status" <> 'REDEEMED' OR "redeemedAt" IS NOT NULL),
  ADD CONSTRAINT "loyalty_rewards_void_check" CHECK ("status" <> 'VOID' OR "voidedAt" IS NOT NULL);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_loyalty_discount_amount_check" CHECK ("loyaltyDiscountAmount" >= 0);
