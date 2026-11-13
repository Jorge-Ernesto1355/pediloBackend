ALTER TABLE "Business" ADD COLUMN "qrCodeToken" TEXT;

UPDATE "Business"
SET "qrCodeToken" = md5(random()::text || clock_timestamp()::text || "id")
WHERE "qrCodeToken" IS NULL;

ALTER TABLE "Business" ALTER COLUMN "qrCodeToken" SET NOT NULL;

CREATE UNIQUE INDEX "Business_qrCodeToken_key" ON "Business"("qrCodeToken");
