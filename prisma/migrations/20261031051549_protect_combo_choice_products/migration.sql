-- DropForeignKey
ALTER TABLE "ComboIncludedProduct" DROP CONSTRAINT "ComboIncludedProduct_productId_fkey";

-- DropForeignKey
ALTER TABLE "ComboOptionProduct" DROP CONSTRAINT "ComboOptionProduct_productId_fkey";

-- AddForeignKey
ALTER TABLE "ComboOptionProduct" ADD CONSTRAINT "ComboOptionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComboIncludedProduct" ADD CONSTRAINT "ComboIncludedProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
