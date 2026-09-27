-- Normalize phones before enforcing the business-scoped identity constraint.
UPDATE "Customer"
SET "phone" = regexp_replace(COALESCE("phone", ''), '[^0-9]', '', 'g');

UPDATE "Order"
SET "customerPhone" = regexp_replace("customerPhone", '[^0-9]', '', 'g')
WHERE "customerPhone" IS NOT NULL;

-- Keep the oldest customer for each business/phone pair and move all orders to it.
CREATE TEMP TABLE "customer_phone_survivors" ON COMMIT DROP AS
SELECT "businessId", "phone", MIN("id") AS "survivorId"
FROM "Customer"
WHERE "phone" ~ '^[0-9]{10}$'
GROUP BY "businessId", "phone";

UPDATE "Order" AS o
SET "customerId" = s."survivorId"
FROM "Customer" AS duplicate
JOIN "customer_phone_survivors" AS s
  ON s."businessId" = duplicate."businessId"
 AND s."phone" = duplicate."phone"
WHERE o."customerId" = duplicate."id"
  AND duplicate."id" <> s."survivorId";

DELETE FROM "Customer" AS duplicate
USING "customer_phone_survivors" AS s
WHERE duplicate."businessId" = s."businessId"
  AND duplicate."phone" = s."phone"
  AND duplicate."id" <> s."survivorId";

-- Preserve legacy customers without a valid phone and their order relations.
-- A reserved-looking 10-digit placeholder is assigned only to those legacy rows;
-- all new and edited values are validated by the API.
DO $$
DECLARE
  customer_record RECORD;
  candidate BIGINT := 9000000000;
BEGIN
  FOR customer_record IN
    SELECT "id", "businessId"
    FROM "Customer"
    WHERE "phone" !~ '^[0-9]{10}$'
    ORDER BY "id"
  LOOP
    LOOP
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "Customer"
        WHERE "businessId" = customer_record."businessId"
          AND "phone" = candidate::text
      );
      candidate := candidate + 1;
    END LOOP;
    UPDATE "Customer"
    SET "phone" = candidate::text
    WHERE "id" = customer_record."id";
    candidate := candidate + 1;
  END LOOP;
END $$;

ALTER TABLE "Customer"
ALTER COLUMN "phone" SET NOT NULL;

ALTER TABLE "Customer"
ADD CONSTRAINT "Customer_businessId_phone_key" UNIQUE ("businessId", "phone");
