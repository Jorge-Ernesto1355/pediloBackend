---
name: testing
description: Plan and implement focused Vitest coverage for Pedilo backend changes.
---

# Testing

- Prefer isolated unit tests for domain rules and application use cases.
- Use integration tests only when adapter behavior requires PostgreSQL or HTTP.
- Keep tests deterministic and avoid depending on a developer's local database.
- Run lint, typecheck and the full Vitest suite before handing off changes.
