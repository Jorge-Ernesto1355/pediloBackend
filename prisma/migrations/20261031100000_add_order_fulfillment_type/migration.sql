CREATE TYPE "OrderFulfillmentType" AS ENUM ('DINE_IN', 'PICKUP');

ALTER TABLE "Order"
ADD COLUMN "fulfillmentType" "OrderFulfillmentType" NOT NULL DEFAULT 'DINE_IN';
