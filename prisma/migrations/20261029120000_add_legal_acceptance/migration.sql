ALTER TABLE "user"
ADD COLUMN "acceptLegalDocuments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "ageDeclaration" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "legalTermsVersion" TEXT,
ADD COLUMN "legalPrivacyVersion" TEXT,
ADD COLUMN "legalAcceptedAt" TIMESTAMP(3);
