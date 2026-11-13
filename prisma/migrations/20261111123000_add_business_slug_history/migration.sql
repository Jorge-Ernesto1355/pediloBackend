CREATE TABLE "BusinessSlugHistory" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessSlugHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BusinessSlugHistory_slug_key" ON "BusinessSlugHistory"("slug");
CREATE INDEX "BusinessSlugHistory_businessId_idx" ON "BusinessSlugHistory"("businessId");

ALTER TABLE "BusinessSlugHistory"
ADD CONSTRAINT "BusinessSlugHistory_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
