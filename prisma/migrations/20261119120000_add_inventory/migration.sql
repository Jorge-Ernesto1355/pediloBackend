-- CreateEnum
CREATE TYPE "IngredientUnit" AS ENUM ('G', 'ML', 'UNIT');

-- CreateEnum
CREATE TYPE "LowStockMode" AS ENUM ('PERCENT', 'ABSOLUTE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'WASTE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockAlertKind" AS ENUM ('STOCK', 'CONSUMPTION');

-- CreateEnum
CREATE TYPE "StockAlertLevel" AS ENUM ('LOW', 'CRITICAL', 'OUT', 'HIGH');

-- CreateEnum
CREATE TYPE "StockBlockMode" AS ENUM ('NONE', 'OUT_OF_STOCK', 'LOW_STOCK');

-- AlterTable
ALTER TABLE "OrderItemOption" ADD COLUMN     "globalOptionId" TEXT,
ADD COLUMN     "productOptionId" TEXT;

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "IngredientUnit" NOT NULL,
    "stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "parLevel" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "lowStockMode" "LowStockMode" NOT NULL DEFAULT 'PERCENT',
    "lowStockValue" DECIMAL(14,3),
    "consumptionAlertPercent" DECIMAL(5,2),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "productId" TEXT,
    "productOptionId" TEXT,
    "globalOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "stockAfter" DECIMAL(14,3) NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAlert" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "kind" "StockAlertKind" NOT NULL,
    "level" "StockAlertLevel" NOT NULL,
    "stock" DECIMAL(14,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "StockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySettings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultLowStockPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "consumptionAlertPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "consumptionWindowHours" INTEGER NOT NULL DEFAULT 24,
    "blockMode" "StockBlockMode" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ingredient_businessId_archivedAt_idx" ON "Ingredient"("businessId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_businessId_name_key" ON "Ingredient"("businessId", "name");

-- CreateIndex
CREATE INDEX "RecipeItem_businessId_idx" ON "RecipeItem"("businessId");

-- CreateIndex
CREATE INDEX "RecipeItem_ingredientId_idx" ON "RecipeItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_productId_ingredientId_key" ON "RecipeItem"("productId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_productOptionId_ingredientId_key" ON "RecipeItem"("productOptionId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_globalOptionId_ingredientId_key" ON "RecipeItem"("globalOptionId", "ingredientId");

-- CreateIndex
CREATE INDEX "StockMovement_ingredientId_createdAt_idx" ON "StockMovement"("ingredientId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_businessId_createdAt_idx" ON "StockMovement"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_orderId_ingredientId_type_key" ON "StockMovement"("orderId", "ingredientId", "type");

-- CreateIndex
CREATE INDEX "StockAlert_businessId_resolvedAt_idx" ON "StockAlert"("businessId", "resolvedAt");

-- CreateIndex
CREATE INDEX "StockAlert_ingredientId_kind_resolvedAt_idx" ON "StockAlert"("ingredientId", "kind", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySettings_businessId_key" ON "InventorySettings"("businessId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_productOptionId_fkey" FOREIGN KEY ("productOptionId") REFERENCES "ProductOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_globalOptionId_fkey" FOREIGN KEY ("globalOptionId") REFERENCES "GlobalOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAlert" ADD CONSTRAINT "StockAlert_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySettings" ADD CONSTRAINT "InventorySettings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A recipe line belongs to exactly one of: product, product option, global option.
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_single_owner_check"
  CHECK (num_nonnulls("productId", "productOptionId", "globalOptionId") = 1);

-- A recipe line must consume a positive quantity.
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_quantity_positive_check" CHECK ("quantity" > 0);
