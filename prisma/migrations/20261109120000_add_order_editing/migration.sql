ALTER TABLE "Order" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "OrderModification" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changes" JSONB NOT NULL,

    CONSTRAINT "OrderModification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderModification_orderId_version_key" ON "OrderModification"("orderId", "version");
CREATE INDEX "OrderModification_orderId_changedAt_idx" ON "OrderModification"("orderId", "changedAt");
CREATE INDEX "OrderModification_userId_changedAt_idx" ON "OrderModification"("userId", "changedAt");
ALTER TABLE "OrderModification" ADD CONSTRAINT "OrderModification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderModification" ADD CONSTRAINT "OrderModification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
