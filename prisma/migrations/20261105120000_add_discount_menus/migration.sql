CREATE TABLE "discount_menus" (
  "discountId" TEXT NOT NULL,
  "menuId" TEXT NOT NULL,
  CONSTRAINT "discount_menus_pkey" PRIMARY KEY ("discountId", "menuId")
);

ALTER TABLE "discount_menus"
  ADD CONSTRAINT "discount_menus_discountId_fkey"
  FOREIGN KEY ("discountId") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discount_menus"
  ADD CONSTRAINT "discount_menus_menuId_fkey"
  FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
