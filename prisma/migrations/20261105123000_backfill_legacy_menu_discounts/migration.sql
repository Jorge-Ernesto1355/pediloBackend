INSERT INTO "discount_menus" ("discountId", "menuId")
SELECT d."id", m."id"
FROM "discounts" d
JOIN "Menu" m ON m."businessId" = d."businessId"
WHERE d."scope" = 'MENU'
  AND NOT EXISTS (
    SELECT 1 FROM "discount_menus" dm WHERE dm."discountId" = d."id"
  );
