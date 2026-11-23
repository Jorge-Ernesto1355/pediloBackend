-- Colonia de la dirección de entrega. Se muestra al repartidor como zona aproximada
-- antes de tomar la entrega (sin calle ni número). Opcional en BD: pedidos previos no la tienen.
-- Reversión: down.sql en esta misma carpeta.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryNeighborhood" VARCHAR(100);
