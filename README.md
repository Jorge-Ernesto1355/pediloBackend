# Pedilo Backend

Backend base de Pedilo construido con Node.js, Express, TypeScript, PostgreSQL y Prisma.

El proyecto está preparado para crecer por módulos usando Hexagonal Architecture / Ports & Adapters. Actualmente solo contiene el wiring de la aplicación y la configuración del entorno; no incluye autenticación, modelos de negocio, CRUD ni endpoints funcionales.

## Requisitos

- Node.js 20+
- npm
- PostgreSQL

## Inicio rápido

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Configura `DATABASE_URL` en `.env` con la conexión de PostgreSQL. El esquema Prisma está intencionalmente vacío.

## Scripts

- `npm run dev`: servidor en modo watch.
- `npm run build`: compila TypeScript en `dist`.
- `npm run lint`: ejecuta ESLint.
- `npm run typecheck`: valida tipos sin emitir archivos.
- `npm test`: ejecuta Vitest.
- `npm run format:check`: comprueba formato con Prettier.
- `npm run prisma:generate`: genera Prisma Client.

## Registro de requests

La aplicación registra cada request HTTP al terminar, incluyendo método, ruta, query,
parámetros, body, status, resultado y duración. Los campos sensibles (`password`,
`token`, `authorization`, `cookie` y similares) se muestran como `[REDACTED]`.

Para desactivarlo temporalmente:

```bash
REQUEST_LOGGING=false npm run dev
```

Ejemplo:

```json
{
  "type": "http",
  "method": "GET",
  "path": "/health",
  "route": "/health",
  "request": { "query": {}, "params": {}, "body": {} },
  "response": { "statusCode": 200, "result": { "status": "ok" } },
  "durationMs": 3
}
```

Consulta [AGENTS.md](./AGENTS.md) antes de agregar código para conservar las reglas de arquitectura.

## Recuperación de contraseña

La API expone estos endpoints bajo `/api/v1/auth`:

- `POST /forgot-password` con `{ "email": "user@example.com" }`. Siempre devuelve `200` con un mensaje genérico para evitar enumeración de usuarios.
- `POST /reset-password` con `{ "token": "...", "newPassword": "NewPassword123!" }`. Devuelve `200` al cambiar la contraseña o `400` con `Invalid or expired reset token.` para tokens inválidos, usados o expirados.

El token se genera con `crypto.randomBytes(32)`, solo se guarda su SHA-256 en `password_reset_token`, expira en 30 minutos por defecto y es de un solo uso. Al completar el reset se actualiza la contraseña mediante el mismo scrypt de Better Auth, se invalidan los tokens restantes y se eliminan todas las sesiones del usuario.

El proveedor de correo es Resend mediante `fetch` de Node.js; el correo incluye HTML compatible con clientes comunes y una versión `text/plain`. En desarrollo/test, si no se configuran las credenciales de Resend, el envío se omite; en producción la configuración es obligatoria.

Variables adicionales:

```env
FRONTEND_URL=http://localhost:3000
APP_NAME=Pedilo
PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES=30
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM="Pedilo <onboarding@resend.dev>"
```

Aplica la migración y prueba el flujo localmente con:

```bash
npx prisma migrate deploy
npm run prisma:generate
npm run dev
curl -X POST http://localhost:3000/api/v1/auth/forgot-password \
  -H 'content-type: application/json' \
  -d '{"email":"user@example.com"}'
```

El rate limit actual es un límite en memoria por proceso: 5 solicitudes de forgot password y 10 de reset por IP cada 15 minutos. En un despliegue con múltiples réplicas debe sustituirse por un almacén compartido (por ejemplo Redis) para aplicar el límite globalmente.

## Account

Todas las rutas `/api/v1/account/*` requieren la sesión de Better Auth en cookies. No reciben `userId`; siempre operan sobre el usuario autenticado.

- `GET /api/v1/account` devuelve `name`, `email`, `emailVerified`, `createdAt` y `stats` (`customersCount`, `totalGenerated`, `ordersCount`). Las ventas contabilizadas usan órdenes `PREPARING` y `READY` desde la creación de la cuenta.
- `PATCH /api/v1/account` recibe únicamente `{ "name": "Nuevo Nombre" }`. Rechaza campos adicionales, valida longitud y devuelve `409` si otro usuario tiene exactamente el mismo nombre.
- `POST /api/v1/account/email-verification` y `POST /api/v1/account/email-verification/resend` no reciben body. No envían nada si el email ya está verificado. Generan un token aleatorio, guardan solo SHA-256, invalidan tokens pendientes y aplican 3 solicitudes por usuario cada 15 minutos.
- `POST /api/v1/auth/verify-email` recibe `{ "token": "..." }`. Un token válido, no expirado y no utilizado marca `emailVerified=true`. Una repetición del mismo token después de completar la verificación devuelve `200` de forma idempotente sin volver a modificar nada; los tokens inválidos o expirados devuelven `400`.
- `POST /api/v1/account/change-password` recibe `{ "currentPassword": "...", "newPassword": "..." }`. No modifica ni normaliza las contraseñas, usa el hashing y las reglas de Better Auth, y revoca las demás sesiones. Las cookies de la nueva sesión se devuelven en la respuesta.

Las nuevas rutas de email verification usan `EMAIL_VERIFICATION_TOKEN_EXPIRATION_MINUTES` (60 por defecto). La migración correspondiente es `20260920130000_add_email_verification_tokens`.
