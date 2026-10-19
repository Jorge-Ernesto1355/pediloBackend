CREATE TABLE "GoogleReviewLink" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleReviewLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleReviewLink_businessId_key" ON "GoogleReviewLink"("businessId");

ALTER TABLE "GoogleReviewLink" ADD CONSTRAINT "GoogleReviewLink_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
