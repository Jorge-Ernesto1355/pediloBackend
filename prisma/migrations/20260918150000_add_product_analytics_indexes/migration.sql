CREATE INDEX "Product_businessId_isAvailable_createdAt_idx"
ON "Product"("businessId", "isAvailable", "createdAt");

CREATE INDEX "Product_businessId_categoryId_idx"
ON "Product"("businessId", "categoryId");

CREATE INDEX "OrderItem_productId_idx"
ON "OrderItem"("productId");

CREATE INDEX "Order_businessId_status_createdAt_idx"
ON "Order"("businessId", "status", "createdAt");
