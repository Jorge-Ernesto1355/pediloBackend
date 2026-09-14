---
name: security
description: Apply baseline security practices to Pedilo HTTP and configuration changes.
---

# Security

- Keep secrets in environment variables and out of version control.
- Preserve Helmet, CORS configuration and centralized error handling.
- Validate all untrusted input with Zod before it reaches application code.
- Avoid exposing stack traces, database errors or sensitive configuration in HTTP responses.
- Review authorization and data access boundaries whenever a feature is added.
