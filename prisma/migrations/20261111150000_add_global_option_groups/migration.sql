CREATE TABLE "GlobalOptionGroup" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "minSelect" INTEGER NOT NULL DEFAULT 0,
  "maxSelect" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlobalOptionGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GlobalOption" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "minSelections" INTEGER NOT NULL DEFAULT 0,
  "maxSelections" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlobalOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductGlobalOptionGroup" (
  "productId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ProductGlobalOptionGroup_pkey" PRIMARY KEY ("productId", "groupId")
);

CREATE INDEX "GlobalOptionGroup_businessId_sortOrder_idx" ON "GlobalOptionGroup"("businessId", "sortOrder");
CREATE INDEX "GlobalOption_groupId_sortOrder_idx" ON "GlobalOption"("groupId", "sortOrder");
CREATE INDEX "ProductGlobalOptionGroup_groupId_sortOrder_idx" ON "ProductGlobalOptionGroup"("groupId", "sortOrder");
ALTER TABLE "GlobalOptionGroup" ADD CONSTRAINT "GlobalOptionGroup_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GlobalOption" ADD CONSTRAINT "GlobalOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GlobalOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGlobalOptionGroup" ADD CONSTRAINT "ProductGlobalOptionGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductGlobalOptionGroup" ADD CONSTRAINT "ProductGlobalOptionGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GlobalOptionGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
