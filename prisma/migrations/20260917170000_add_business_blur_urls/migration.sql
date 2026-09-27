-- Add optimized and blur-placeholder URLs to businesses.
ALTER TABLE "Business"
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "logoBlurUrl" TEXT,
ADD COLUMN "coverUrl" TEXT,
ADD COLUMN "coverBlurUrl" TEXT;

-- Store the generated placeholder alongside the Cloudinary asset metadata.
ALTER TABLE "BusinessImage"
ADD COLUMN "blurUrl" TEXT NOT NULL DEFAULT '';

ALTER TABLE "BusinessImage"
ALTER COLUMN "blurUrl" DROP DEFAULT;
