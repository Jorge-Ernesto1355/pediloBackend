---
name: api-design
description: Design consistent HTTP APIs for Pedilo without leaking infrastructure concerns.
---

# API design

- Validate request inputs and outputs with Zod at the presentation boundary.
- Keep controllers thin; invoke application use cases through ports.
- Use consistent HTTP status codes and the global error format.
- Do not add business endpoints or resources without an explicit requirement.
