-- CreateTable
CREATE TABLE "ComboIncludedProduct" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "comboProductId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComboIncludedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComboIncludedProduct_businessId_comboProductId_sortOrder_idx" ON "ComboIncludedProduct"("businessId", "comboProductId", "sortOrder");

-- CreateIndex
CREATE INDEX "ComboIncludedProduct_productId_idx" ON "ComboIncludedProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ComboIncludedProduct_comboProductId_productId_key" ON "ComboIncludedProduct"("comboProductId", "productId");

-- AddForeignKey
ALTER TABLE "ComboIncludedProduct" ADD CONSTRAINT "ComboIncludedProduct_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboIncludedProduct" ADD CONSTRAINT "ComboIncludedProduct_comboProductId_fkey" FOREIGN KEY ("comboProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboIncludedProduct" ADD CONSTRAINT "ComboIncludedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
