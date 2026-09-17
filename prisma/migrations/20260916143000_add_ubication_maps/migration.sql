-- CreateTable
CREATE TABLE "UbicationMaps" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,

    CONSTRAINT "UbicationMaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UbicationMaps_businessId_key" ON "UbicationMaps"("businessId");

-- AddForeignKey
ALTER TABLE "UbicationMaps"
ADD CONSTRAINT "UbicationMaps_businessId_fkey"
FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
