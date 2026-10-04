-- Preserve existing orders while removing the obsolete status values.
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";

CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'CANCELLED');

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'CONFIRMED' THEN 'PREPARING'
      WHEN 'COMPLETED' THEN 'READY'
      ELSE "status"::text
    END
  )::"OrderStatus";

ALTER TABLE "OrderStatusHistory"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'CONFIRMED' THEN 'PREPARING'
      WHEN 'COMPLETED' THEN 'READY'
      ELSE "status"::text
    END
  )::"OrderStatus";

DROP TYPE "OrderStatus_old";
