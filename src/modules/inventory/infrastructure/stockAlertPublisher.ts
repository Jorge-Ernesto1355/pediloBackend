import { orderEventHub } from '@/modules/orders/infrastructure/sse/OrderEventHub.js';
import type { StockAlertNotice } from '../domain/stock.js';

/** Best-effort live delivery, always called after the database transaction committed. */
export function publishStockAlerts(notices: StockAlertNotice[]) {
  for (const notice of notices) {
    try {
      orderEventHub.publishStockAlert({
        alertId: notice.alertId,
        businessId: notice.businessId,
        ingredientId: notice.ingredientId,
        ingredientName: notice.ingredientName,
        unit: notice.unit,
        kind: notice.kind,
        level: notice.level,
        stock: notice.stock,
        threshold: notice.threshold,
        createdAt: notice.createdAt,
      });
    } catch {
      // The alert is already persisted; a disconnected client must not affect the caller.
    }
  }
}
