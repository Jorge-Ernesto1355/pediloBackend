-- Reversión de 20261122180000_add_delivery_neighborhood.
-- Prisma no ejecuta este archivo automáticamente. Para revertir (un solo paso):
--   npx prisma db execute --schema prisma/schema.prisma \
--     --file prisma/migrations/20261122180000_add_delivery_neighborhood/down.sql
-- Si también se revierte 20261122120000_add_home_delivery, ejecutar ESTE primero.
--
-- ADVERTENCIA (pérdida de datos): borra la colonia guardada en los pedidos a domicilio.

BEGIN;

ALTER TABLE "Order" DROP COLUMN "deliveryNeighborhood";

DELETE FROM "_prisma_migrations"
WHERE "migration_name" = '20261122180000_add_delivery_neighborhood';

COMMIT;
