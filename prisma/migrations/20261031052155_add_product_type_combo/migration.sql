-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'COMBO');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'PRODUCT';
