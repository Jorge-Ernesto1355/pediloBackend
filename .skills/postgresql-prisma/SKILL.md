---
name: postgresql-prisma
description: Work safely with PostgreSQL and Prisma adapters in the Pedilo backend.
---

# PostgreSQL and Prisma

- Read `DATABASE_URL` from the centralized environment configuration.
- Keep Prisma access behind infrastructure repositories or adapters.
- Never import Prisma into domain or presentation code.
- Review migrations, indexes and transaction boundaries for each persistence change.
- Keep the Prisma schema free of business models until a feature requires them.
