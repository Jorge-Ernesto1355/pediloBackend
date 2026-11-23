-- Reversión de 20261122200000_add_loyalty_program.
-- Prisma no ejecuta este archivo automáticamente. Para revertir (un solo paso):
--   npx prisma db execute --schema prisma/schema.prisma \
--     --file prisma/migrations/20261122200000_add_loyalty_program/down.sql
-- Al final también borra el registro en _prisma_migrations, así `prisma migrate deploy`
-- puede volver a aplicarla.
--
-- ADVERTENCIA (pérdida de datos): borra programas, tarjetas, sellos y premios de lealtad,
-- y el registro de premios canjeados en pedidos. Los totales de los pedidos NO cambian
-- (ya incluyen el descuento del premio).

BEGIN;

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_loyaltyRewardId_fkey";
DROP INDEX IF EXISTS "Order_loyaltyRewardId_idx";
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_loyalty_discount_amount_check";
ALTER TABLE "Order"
  DROP COLUMN "loyaltyRewardId",
  DROP COLUMN "loyaltyDiscountAmount";

-- Orden inverso de dependencias (premios → sellos → tarjetas → programas).
DROP TABLE "loyalty_rewards";
DROP TABLE "loyalty_stamps";
DROP TABLE "loyalty_cards";
DROP TABLE "loyalty_programs";

DROP TYPE "LoyaltyRewardStatus";
DROP TYPE "LoyaltyStampSource";
DROP TYPE "LoyaltyRewardType";
DROP TYPE "LoyaltyStampMode";

DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20261122200000_add_loyalty_program';

COMMIT;
