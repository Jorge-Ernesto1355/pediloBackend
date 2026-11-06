-- This relation was already included in the original menu-discounts migration.
-- Keep this follow-up migration safe for databases that already have it and for
-- databases where the previous migration was only partially applied.
CREATE TABLE IF NOT EXISTS "discount_menus" (
  "discountId" TEXT NOT NULL,
  "menuId" TEXT NOT NULL,
  CONSTRAINT "discount_menus_pkey" PRIMARY KEY ("discountId", "menuId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discount_menus_discountId_fkey'
      AND conrelid = 'discount_menus'::regclass
  ) THEN
    ALTER TABLE "discount_menus"
      ADD CONSTRAINT "discount_menus_discountId_fkey"
      FOREIGN KEY ("discountId") REFERENCES "discounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'discount_menus_menuId_fkey'
      AND conrelid = 'discount_menus'::regclass
  ) THEN
    ALTER TABLE "discount_menus"
      ADD CONSTRAINT "discount_menus_menuId_fkey"
      FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
