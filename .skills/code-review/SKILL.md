---
name: code-review
description: Review Pedilo backend changes for architecture, correctness and operational regressions.
---

# Code review

- Verify dependency direction and module boundaries against `AGENTS.md`.
- Check that business logic is not placed in controllers or Prisma adapters.
- Look for missing validation, error mapping, tests and configuration handling.
- Run `npm run lint`, `npm run typecheck` and `npm test` when reviewing a change.
- Flag accidental endpoints, models, credentials or unrelated scope expansion.
