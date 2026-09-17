/*
  Warnings:

  - You are about to drop the `BusinessHours` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `scheduleId` to the `Business` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BusinessHours" DROP CONSTRAINT "BusinessHours_businessId_fkey";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "scheduleId" TEXT NOT NULL,
ADD COLUMN     "ubication" TEXT;

-- DropTable
DROP TABLE "BusinessHours";

-- CreateTable
CREATE TABLE "dayWeek" (
    "id" TEXT NOT NULL,
    "businessScheduleId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dayWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSchedule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BusinessSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dayWeek_key_label_key" ON "dayWeek"("key", "label");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSchedule_businessId_key" ON "BusinessSchedule"("businessId");

-- AddForeignKey
ALTER TABLE "dayWeek" ADD CONSTRAINT "dayWeek_businessScheduleId_fkey" FOREIGN KEY ("businessScheduleId") REFERENCES "BusinessSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessSchedule" ADD CONSTRAINT "BusinessSchedule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
