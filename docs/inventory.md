# Inventario

Controla los ingredientes de cada negocio, descuenta lo que consume cada pedido y avisa cuando algo se está acabando.

## Cómo funciona

- **Ingrediente**: nombre, unidad base (`G`, `ML`, `UNIT`), stock, nivel de referencia (`parLevel`) y umbrales de alerta. Los pesos se capturan en gramos; la conversión de kg es de la interfaz.
- **Receta**: cuánto de cada ingrediente consume **una unidad** de un producto, de una opción propia de un producto o de una opción global. Los combos y sus productos incluidos no consumen todavía.
- **Descuento**: ocurre **al marcar el pedido como `READY`**, dentro de la misma transacción que el cambio de estado. `READY` y `CANCELLED` son estados finales, así que un pedido cancelado nunca descuenta y uno terminado nunca se descuenta dos veces (además hay un índice único `(orderId, ingredientId, type)` en el libro de movimientos). Un producto sin receta no descuenta nada y el pedido sigue normal.
- **Movimientos**: el stock nunca se edita directamente; cada cambio es una fila de `StockMovement` (`PURCHASE`, `CONSUMPTION`, `WASTE`, `ADJUSTMENT`) con el stock resultante.
- Las opciones elegidas en un pedido guardan `productOptionId` / `globalOptionId`. Pedidos anteriores a esta función no los tienen, por lo que sus opciones no descuentan.

## Alertas

Se evalúan después de cada movimiento y al cambiar umbrales o configuración. Se abre **una alerta** cuando empieza la condición, se **escala** si empeora y se **resuelve sola** al reponer. Solo las alertas nuevas o escaladas se envían por SSE.

| Tipo          | Nivel      | Condición                                                   |
| ------------- | ---------- | ----------------------------------------------------------- |
| `STOCK`       | `LOW`      | stock ≤ umbral                                              |
| `STOCK`       | `CRITICAL` | stock ≤ umbral / 2                                          |
| `STOCK`       | `OUT`      | stock ≤ 0                                                   |
| `CONSUMPTION` | `HIGH`     | consumido en la ventana ≥ X % de (stock actual + consumido) |

- Umbral `PERCENT`: porcentaje del `parLevel` (por ingrediente o, si no se define, el del negocio; 20 % por defecto). Umbral `ABSOLUTE`: cantidad en la unidad del ingrediente.
- Una compra que deja el stock por encima del `parLevel` lo sube a ese valor, para que los porcentajes funcionen sin configurar nada.
- Con `parLevel` 0 y modo `PERCENT` solo alerta `OUT`.
- Consumo alto: porcentaje y ventana (24 h por defecto) configurables por negocio; el porcentaje también por ingrediente.

## Bloqueo de ventas

`InventorySettings.blockMode`:

- `NONE` (por defecto): solo avisa.
- `OUT_OF_STOCK`: rechaza el pedido si algún ingrediente que necesita no alcanza.
- `LOW_STOCK`: además rechaza si algún ingrediente que necesita está en nivel `LOW` o peor.

Solo aplica a pedidos de clientes (menú público), con `409 INSUFFICIENT_STOCK` y el nombre de los ingredientes en el mensaje. Los pedidos creados por el personal nunca se bloquean. Los pedidos pendientes **no reservan** stock: el descuento ocurre en `READY`, así que varios pedidos pendientes pueden pedir lo mismo.

## SSE

Se reutiliza el stream de `GET /api/orders/events`. Evento nuevo `stock_alert`:

```json
{
  "eventId": "…",
  "type": "stock_alert",
  "alertId": "…",
  "restaurantId": "…",
  "ingredientId": "…",
  "ingredientName": "Queso",
  "unit": "G",
  "kind": "STOCK",
  "level": "LOW",
  "stock": 80,
  "threshold": 100,
  "createdAt": "2026-11-19T18:00:00.000Z"
}
```

Es de mejor esfuerzo, igual que el resto de eventos (ver `order-events-sse.md`). Las alertas abiertas se pueden recuperar siempre con `GET …/inventory/alerts`.

## API

Todas bajo `/api/v1/businesses/:businessId/inventory` y con sesión del dueño.

| Método    | Ruta                                                       | Descripción                                                                                                            |
| --------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| GET       | `/ingredients?search=&status=`                             | Lista con `level`, `threshold` y `counts`. `status`: `ALERTS`, `LOW`, `CRITICAL`, `OUT`, `OK`. Primero lo más urgente. |
| POST      | `/ingredients`                                             | Crea (con `initialStock` opcional).                                                                                    |
| PATCH     | `/ingredients/:id`                                         | Nombre, `parLevel`, `lowStockMode`, `lowStockValue`, `consumptionAlertPercent`.                                        |
| DELETE    | `/ingredients/:id`                                         | Archiva: sale de recetas y alertas.                                                                                    |
| POST      | `/ingredients/:id/movements`                               | `PURCHASE`/`WASTE` suman o restan `quantity`; `ADJUSTMENT` fija el stock contado.                                      |
| GET       | `/ingredients/:id/movements?page=&limit=`                  | Historial.                                                                                                             |
| GET/PUT   | `/recipes/{products\|product-options\|global-options}/:id` | Receta; `PUT` reemplaza `{ lines: [{ ingredientId, quantity }] }`.                                                     |
| GET/PATCH | `/settings`                                                | `alertsEnabled`, `defaultLowStockPercent`, `consumptionAlertPercent`, `consumptionWindowHours`, `blockMode`.           |
| GET       | `/alerts`                                                  | Alertas abiertas.                                                                                                      |

## Pruebas

`inventory.integration.test.ts` recorre el flujo completo contra PostgreSQL real (creación, recetas, descuento en `READY`, alertas, bloqueo). Se omite si falta la variable:

```
INVENTORY_INTEGRATION_DATABASE_URL=postgresql://… npx vitest run inventory.integration
```

Necesita una base con todas las migraciones aplicadas.
