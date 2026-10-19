ALTER TABLE "GoogleReviewLink"
ADD COLUMN "qrCode" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE "GoogleReviewLink" ALTER COLUMN "qrCode" DROP DEFAULT;

CREATE UNIQUE INDEX "GoogleReviewLink_qrCode_key" ON "GoogleReviewLink"("qrCode");

CREATE TABLE "GoogleReviewScan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "googleReviewLinkId" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorHash" TEXT NOT NULL,
    "dedupeBucket" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewScan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleReviewScan_dedupe_key"
ON "GoogleReviewScan"("googleReviewLinkId", "visitorHash", "dedupeBucket");
CREATE INDEX "GoogleReviewScan_businessId_visitedAt_idx"
ON "GoogleReviewScan"("businessId", "visitedAt");
CREATE INDEX "GoogleReviewScan_googleReviewLinkId_visitedAt_idx"
ON "GoogleReviewScan"("googleReviewLinkId", "visitedAt");

ALTER TABLE "GoogleReviewScan" ADD CONSTRAINT "GoogleReviewScan_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoogleReviewScan" ADD CONSTRAINT "GoogleReviewScan_googleReviewLinkId_fkey"
FOREIGN KEY ("googleReviewLinkId") REFERENCES "GoogleReviewLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
