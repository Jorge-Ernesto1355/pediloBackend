ALTER TABLE "Product"
DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";

ALTER TABLE "Product"
ADD CONSTRAINT "Product_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
