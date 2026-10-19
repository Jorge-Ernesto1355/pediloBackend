CREATE TABLE "StoreVisit" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorHash" TEXT NOT NULL,
    "dedupeBucket" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreVisit_dedupe_key"
ON "StoreVisit"("businessId", "visitorHash", "dedupeBucket");
CREATE INDEX "StoreVisit_businessId_visitedAt_idx"
ON "StoreVisit"("businessId", "visitedAt");

ALTER TABLE "StoreVisit" ADD CONSTRAINT "StoreVisit_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
