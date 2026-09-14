---
name: backend-architecture
description: Guide modular Hexagonal Architecture changes in the Pedilo backend.
---

# Backend architecture

- Organize work by module under `src/modules`.
- Keep domain code framework-agnostic and define application ports as interfaces.
- Put Prisma, Express and external services in infrastructure or presentation adapters.
- Keep dependency direction pointing toward the domain.
- Reuse `shared` only for genuinely cross-cutting concerns.
- Check `AGENTS.md` before changing structure.
