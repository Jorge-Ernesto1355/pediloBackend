# Ticket promedio

## Endpoint

`GET /api/v1/analytics/average-ticket?period=today`

Requiere la sesión autenticada habitual (`Cookie` de Better Auth). `period` es opcional y acepta `today`, `7d`, `30d` o `this_month`; por defecto es `today`.

La respuesta tiene la envoltura `{ "data": ... }`. Los importes son strings con dos decimales y las fechas incluyen el offset de la zona horaria del negocio. `end_at` es exclusivo.

Se consideran ventas únicamente pedidos `PREPARING` y `READY`. El importe es `Order.total`, que actualmente representa el subtotal calculado por el backend (no existen campos separados de impuestos, propinas, envío o reembolsos). Cada pedido cuenta una vez, independientemente de sus artículos u opciones.

Los periodos son ventanas de días calendario locales: hoy/los últimos 7/30 días incluyen el día actual hasta el momento de generación; el periodo anterior usa días calendario completos. `this_month` va del primer día del mes actual hasta ahora y compara con los mismos días disponibles del mes anterior, ajustado al último día disponible. Los límites se convierten a UTC para consultar PostgreSQL.

Ejemplo de respuesta:

```json
{
  "data": {
    "metric": "average_ticket",
    "period": "today",
    "currency": "MXN",
    "current": {
      "total_sales": "12500.00",
      "orders_count": 125,
      "average_ticket": "100.00",
      "start_at": "2026-10-11T00:00:00.000-07:00",
      "end_at": "2026-10-11T16:30:00.000-07:00"
    },
    "previous": {
      "total_sales": "11000.00",
      "orders_count": 125,
      "average_ticket": "88.00",
      "start_at": "2026-10-10T00:00:00.000-07:00",
      "end_at": "2026-10-10T16:30:00.000-07:00"
    },
    "global": {
      "total_sales": "50000.00",
      "orders_count": 500,
      "average_ticket": "100.00"
    },
    "comparison": {
      "difference": "12.00",
      "percentage_change": 13.64,
      "direction": "up",
      "has_previous_data": true
    },
    "meta": { "timezone": "America/Mazatlan", "generated_at": "2026-10-11T16:30:00.000-07:00" }
  }
}
```

Sin ventas, `orders_count` es `0`, `total_sales` es `"0.00"` y `average_ticket` es `"0.00"`. Cuando el periodo anterior no tiene pedidos, `has_previous_data` es `false`, pero la comparación se calcula usando un promedio anterior de `0.00`: `difference`, `percentage_change` y `direction` siguen teniendo valores (`flat` cuando ambos promedios son cero). Los errores usan `{ error: { code, message, details? } }`; un periodo inválido responde `400 INVALID_PERIOD`.

`global` contiene el acumulado histórico del negocio para pedidos `PREPARING` y `READY`, sin limitarse al periodo solicitado. `current.average_ticket` es el ticket promedio del periodo solicitado y `previous.average_ticket` es el ticket promedio del periodo anterior comparable.
