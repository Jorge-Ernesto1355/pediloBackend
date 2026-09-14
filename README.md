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

Consulta [AGENTS.md](./AGENTS.md) antes de agregar código para conservar las reglas de arquitectura.
