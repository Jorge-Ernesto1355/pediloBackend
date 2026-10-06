CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Order_customerName_trgm_idx"
ON "Order" USING GIN ("customerName" gin_trgm_ops)
WHERE "customerName" IS NOT NULL;

CREATE INDEX "Order_customerPhone_trgm_idx"
ON "Order" USING GIN ("customerPhone" gin_trgm_ops)
WHERE "customerPhone" IS NOT NULL;
