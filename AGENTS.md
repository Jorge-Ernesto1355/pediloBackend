# Reglas de arquitectura de Pedilo

## Arquitectura

- El backend usa Hexagonal Architecture (Ports & Adapters) organizada por módulos.
- Cada módulo vive en `src/modules/<modulo>` y puede contener `domain`, `application`, `infrastructure` y `presentation`.
- `domain` contiene reglas y modelos del dominio sin depender de Express, Prisma ni otros adaptadores.
- `application` contiene casos de uso y puertos (interfaces); depende del dominio, nunca de infraestructura.
- `infrastructure` implementa puertos y encapsula Prisma, servicios externos y detalles técnicos.
- `presentation` contiene controladores, rutas, DTOs y validación de entrada/salida.
- `shared` solo contiene piezas realmente transversales; no usarlo para esconder lógica de un módulo.

## Dependencias

- La dirección de dependencias debe apuntar hacia el dominio.
- No importar desde `infrastructure` o `presentation` dentro de `domain`.
- No acceder a Prisma directamente desde controladores o casos de uso.
- Usar aliases `@/*` para imports desde `src` y extensiones `.js` en imports ESM.

## API y errores

- Validar entradas externas con Zod en los adaptadores de presentación.
- Traducir errores de dominio a respuestas HTTP en el manejador global.
- No añadir endpoints, modelos o casos de uso sin una necesidad funcional explícita.

## Persistencia y pruebas

- Mantener Prisma detrás de repositorios/adaptadores definidos por puertos.
- Las pruebas unitarias deben aislar el dominio y los casos de uso.
- Las pruebas de integración deben declarar explícitamente su dependencia de PostgreSQL.
- Mantener lint, typecheck, formato y tests verdes antes de entregar cambios.
