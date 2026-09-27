/*
  Warnings:

  - You are about to drop the column `coverUrl` on the `Business` table. All the data in the column will be lost.
  - You are about to drop the column `logoUrl` on the `Business` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Business" DROP COLUMN "coverUrl",
DROP COLUMN "logoUrl";
