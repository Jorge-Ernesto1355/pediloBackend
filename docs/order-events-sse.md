# SSE de órdenes por negocio

`GET /api/orders/events` autentica la sesión con el middleware actual. El backend resuelve el negocio asociado al usuario desde PostgreSQL y exige una relación `BusinessMember` con rol `OWNER`; no acepta un identificador de negocio en parámetros o query. El CORS existente mantiene la allowlist de origen y credenciales, y la ruta rechaza explícitamente un encabezado `Origin` no confiable.

El stream emite únicamente `new_order`, con un UUID como `id` y los campos `eventId`, `type`, `orderId`, `restaurantId` y `createdAt` en UTC. La publicación ocurre una vez que la transacción Prisma retorna confirmada. Las fallas de escritura SSE se aíslan y nunca cambian el resultado de una orden persistida.

## Recursos y despliegue

- Heartbeat cada 25 segundos; headers `no-cache, no-transform` y `X-Accel-Buffering: no`. El backend no instala middleware de compresión.
- El stream cierra a los 15 minutos para que la reconexión automática del cliente vuelva a autenticar la sesión. Una sesión revocada durante un stream puede seguir recibiendo eventos hasta ese cierre máximo; la reconexión posterior vuelve a validar la sesión. Las conexiones se limitan a 5 por usuario y 500 por negocio. Clientes lentos se desconectan al aplicar backpressure.
- SIGTERM y SIGINT cierran los streams antes del servidor y de Prisma.
- El heartbeat mantiene actividad a través del proxy de Render. El health check existente sigue siendo `/health`.

## Garantías y límites actuales

Las conexiones, el broadcast y una ventana FIFO de deduplicación de los últimos 10,000 IDs de orden viven en memoria en una sola instancia. No hay transactional outbox ni historial persistente: si el proceso termina después del commit y antes de publicar, el evento puede perderse; si un dispositivo está desconectado, los eventos de ese lapso no se reproducen. El servidor entrega `retry: 3000` para la reconexión automática; `Last-Event-ID` no se usa para replay porque no existe almacenamiento histórico. Por tanto, SSE aquí ofrece notificación en vivo de mejor esfuerzo, no entrega durable ni exactamente una vez.

Al escalar a varias instancias de Render, una orden y un cliente pueden caer en procesos distintos. El administrador en memoria no distribuye eventos entre instancias; antes de escalar se necesita un broker compartido o una outbox persistente con mecanismo de distribución y replay.
