-- Reversión de 20261122120000_add_home_delivery.
-- Prisma no ejecuta este archivo automáticamente. Para revertir (un solo paso):
--   npx prisma db execute --schema prisma/schema.prisma \
--     --file prisma/migrations/20261122120000_add_home_delivery/down.sql
-- Al final también borra el registro en _prisma_migrations, así `prisma migrate deploy`
-- puede volver a aplicarla. (`migrate resolve --rolled-back` solo sirve para migraciones
-- fallidas, no para aplicadas.)
--
-- ADVERTENCIA (pérdida de datos): borra todas las entregas y repartidores y los datos
-- de envío de pedidos y ajustes. Los pedidos que usen valores nuevos se convierten así:
--   status OUT_FOR_DELIVERY / DELIVERED -> READY
--   fulfillmentType DELIVERY            -> PICKUP

BEGIN;

DROP TABLE "deliveries";
DROP TABLE "couriers";
DROP TYPE "DeliveryFailureReason";
DROP TYPE "DeliveryStatus";

ALTER TABLE "Order"
  DROP COLUMN "deliveryAddress",
  DROP COLUMN "deliveryReference",
  DROP COLUMN "deliveryLatitude",
  DROP COLUMN "deliveryLongitude",
  DROP COLUMN "deliveryDistanceKm",
  DROP COLUMN "deliveryFee",
  DROP COLUMN "transferConfirmedAt";

ALTER TABLE "BusinessSettings"
  DROP COLUMN "deliveryEnabled",
  DROP COLUMN "maxDeliveryKm",
  DROP COLUMN "deliveryFeeConfig";

-- PostgreSQL no permite quitar valores de un enum: se recrea el tipo.
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'CANCELLED');

ALTER TABLE "Order"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'OUT_FOR_DELIVERY' THEN 'READY'
      WHEN 'DELIVERED' THEN 'READY'
      ELSE "status"::text
    END
  )::"OrderStatus";

ALTER TABLE "OrderStatusHistory"
  ALTER COLUMN "status" TYPE "OrderStatus"
  USING (
    CASE "status"::text
      WHEN 'OUT_FOR_DELIVERY' THEN 'READY'
      WHEN 'DELIVERED' THEN 'READY'
      ELSE "status"::text
    END
  )::"OrderStatus";

DROP TYPE "OrderStatus_old";

ALTER TABLE "Order" ALTER COLUMN "fulfillmentType" DROP DEFAULT;
ALTER TYPE "OrderFulfillmentType" RENAME TO "OrderFulfillmentType_old";
CREATE TYPE "OrderFulfillmentType" AS ENUM ('DINE_IN', 'PICKUP');

ALTER TABLE "Order"
  ALTER COLUMN "fulfillmentType" TYPE "OrderFulfillmentType"
  USING (
    CASE "fulfillmentType"::text
      WHEN 'DELIVERY' THEN 'PICKUP'
      ELSE "fulfillmentType"::text
    END
  )::"OrderFulfillmentType";

ALTER TABLE "Order" ALTER COLUMN "fulfillmentType" SET DEFAULT 'DINE_IN';
DROP TYPE "OrderFulfillmentType_old";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261122120000_add_home_delivery';

COMMIT;
