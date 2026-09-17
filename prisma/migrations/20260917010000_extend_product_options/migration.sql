ALTER TABLE "ProductOptionGroup"
ADD COLUMN "isRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ProductOption"
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ProductOptionGroup_productId_sortOrder_idx"
ON "ProductOptionGroup"("productId", "sortOrder");

CREATE INDEX "ProductOption_groupId_sortOrder_idx"
ON "ProductOption"("groupId", "sortOrder");
