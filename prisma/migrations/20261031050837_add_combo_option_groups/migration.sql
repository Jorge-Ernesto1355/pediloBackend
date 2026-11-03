-- CreateTable
CREATE TABLE "ComboOptionGroup" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "comboProductId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelections" INTEGER NOT NULL DEFAULT 1,
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComboOptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComboOptionProduct" (
    "id" TEXT NOT NULL,
    "optionGroupId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComboOptionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComboOptionGroup_businessId_comboProductId_sortOrder_idx" ON "ComboOptionGroup"("businessId", "comboProductId", "sortOrder");

-- CreateIndex
CREATE INDEX "ComboOptionProduct_productId_idx" ON "ComboOptionProduct"("productId");

-- CreateIndex
CREATE INDEX "ComboOptionProduct_optionGroupId_sortOrder_idx" ON "ComboOptionProduct"("optionGroupId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ComboOptionProduct_optionGroupId_productId_key" ON "ComboOptionProduct"("optionGroupId", "productId");

-- Keep selection configuration valid even when writes bypass the API.
ALTER TABLE "ComboOptionGroup"
ADD CONSTRAINT "ComboOptionGroup_selection_bounds_check"
CHECK ("minSelections" >= 0 AND "maxSelections" >= "minSelections" AND "maxSelections" <= 100);

-- AddForeignKey
ALTER TABLE "ComboOptionGroup" ADD CONSTRAINT "ComboOptionGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboOptionGroup" ADD CONSTRAINT "ComboOptionGroup_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboOptionProduct" ADD CONSTRAINT "ComboOptionProduct_optionGroupId_fkey" FOREIGN KEY ("optionGroupId") REFERENCES "ComboOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboOptionProduct" ADD CONSTRAINT "ComboOptionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
