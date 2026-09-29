# Auditoría interna de privacidad y seguridad del backend

Fecha de revisión: 2026-09-29

Este documento describe el comportamiento observado en el backend. No es un aviso de
privacidad ni una opinión legal. Las decisiones jurídicas y los textos públicos deben
revisarse con el responsable de Pedilo y asesoría legal mexicana.

## 1. Datos que procesa el backend

| Área          | Datos observados                                                                                       | Finalidad técnica actual                           |
| ------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Cuenta        | `User.id`, nombre, correo, `emailVerified`, fechas e imagen opcional                                   | Cuenta, autenticación, perfil y verificación       |
| Autenticación | sesiones, tokens de sesión, IP y user-agent de sesión, cuentas OAuth, credenciales hash                | Mantener sesiones, login, OAuth y recuperación     |
| Recuperación  | hashes de tokens, expiración y uso                                                                     | Recuperación de contraseña y verificación de email |
| Negocio       | nombre, slug, descripción, ubicación, coordenadas, horarios, teléfono, WhatsApp y dirección de negocio | Catálogo, operación y contacto del negocio         |
| Clientes      | nombre y teléfono normalizado a 10 dígitos                                                             | Identificar clientes del negocio y asociar pedidos |
| Pedidos       | número, estado, productos, cantidades, precios, nombre/teléfono del cliente y notas                    | Crear, administrar y consultar pedidos             |
| Catálogo      | nombres, descripciones, precios, disponibilidad, opciones e imágenes                                   | Mostrar y operar el catálogo                       |
| Imágenes      | URLs, `publicId` y blur URLs de Cloudinary                                                             | Mostrar y eliminar imágenes subidas                |

No se encontró correo, dirección ni datos financieros del cliente en el modelo de
pedidos. El teléfono se valida con el esquema existente y se normaliza antes de
persistirlo. Las notas de pedido son texto libre y podrían contener datos personales;
el producto no las interpreta.

## 2. Endpoints públicos revisados y control de acceso

Las tres rutas legacy siguientes permanecen registradas para no romper consumidores
existentes, pero responden `200` con datos vacíos y no ejecutan casos de uso,
repositorios ni consultas a la base de datos:

| Endpoint                                      | Visibilidad | Respuesta actual        | Riesgo y decisión                                                                                    |
| --------------------------------------------- | ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `GET /api/v1/businesses`                      | Pública     | `[]`                    | Antes exponía perfiles resumidos. Se deshabilitó la lectura y se conserva solo por compatibilidad.   |
| `GET /api/v1/businesses/:id`                  | Pública     | `{}`                    | Antes exponía el perfil por ID. Se deshabilitó la lectura; no hay consulta por el ID recibido.       |
| `GET /api/v1/businesses/slug/:slug`           | Pública     | `{}`                    | Antes duplicaba el perfil por slug. Se deshabilitó la lectura; no hay consulta por el slug recibido. |
| `GET /api/v1/public/businesses/:slug/catalog` | Pública     | Catálogo público activo | Se mantiene porque es el flujo público soportado para mostrar el negocio y realizar pedidos.         |

El catálogo público devuelve únicamente información necesaria para la experiencia
pública: `id`, nombre, slug, descripción, URLs de logo/portada, ubicación y
coordenadas configuradas como públicas, WhatsApp del negocio, horarios, menús,
categorías, productos disponibles y grupos/opciones disponibles con sus precios y
orden. Los identificadores de negocio, menú, categoría, producto y opción son
necesarios para navegar el catálogo y crear pedidos; los precios y disponibilidad son
necesarios para mostrar y validar la compra. Los timestamps y algunos identificadores
operativos se conservan por compatibilidad del contrato actual y deben revisarse antes
de retirarlos.

No se exponen en estas respuestas usuarios, `ownerId`, correos privados, clientes,
sesiones, tokens, cuentas OAuth, credenciales, secretos ni configuración
administrativa. La ruta de catálogo tampoco devuelve objetos Prisma completos: arma
una respuesta explícita con los campos públicos del catálogo.

Las operaciones privadas de administración, menús, productos, clientes, pedidos,
imágenes y configuración permanecen protegidas por autenticación y autorización por
negocio. La creación pública de pedidos valida el negocio y los productos recibidos.

- Auth: registro, login, sesión actual, logout, recuperación, reset, verificación de
  email y eliminación de cuenta.
- Cuenta: perfil, cambio de nombre, cambio de contraseña y verificación de email.
- Negocio: administración autenticada de negocio, imágenes y configuración.
- Menús, categorías, productos y opciones: operaciones autenticadas y filtradas por
  pertenencia al negocio.
- Clientes y pedidos: lectura/administración autenticada; la creación de pedidos es
  pública para permitir el flujo del catálogo y valida el negocio y los productos.
- Público: catálogo por slug. No consulta usuarios, sesiones, clientes ni cuentas.
- Dashboard: ventas autenticadas y limitadas al negocio del usuario.

Los repositorios administrativos verifican la relación del identificador recibido con
el negocio del usuario. Deben mantenerse pruebas de IDs cruzados para cada nuevo
endpoint.

## 3. Minimización y datos heredados

No se eliminó ninguna columna existente. El esquema contiene algunos elementos que
requieren decisión antes de una migración destructiva:

- `ProductImage` no tiene uso en los repositorios actuales; `Product.imageUrl`,
  `imageBlurUrl` e `imagePublicId` son el flujo activo.
- `BusinessImage` y las columnas de URLs de `Business` mantienen representación
  duplicada por compatibilidad histórica.
- `Business.scheduleId` y `ubicationMapsId` son referencias redundantes junto con las
  relaciones Prisma.
- `User.image` puede ser poblado por OAuth aunque no se expone actualmente como parte
  de la cuenta.

Antes de retirar cualquiera de ellos hay que comprobar datos en producción, clientes
existentes, migraciones y un plan de reversión.

## 4. Cookies y sesiones

Better Auth administra las cookies de sesión y de estado OAuth. El backend configura
las cookies predeterminadas como `HttpOnly`, `SameSite=Lax` y `Secure` únicamente en
producción; esto permite HTTP local y exige HTTPS en producción. Con la configuración
actual, la cookie principal de sesión usa el nombre predeterminado
`better-auth.session_token` en desarrollo y su variante segura con prefijo
`__Secure-` en producción. Better Auth puede crear temporalmente cookies de estado
OAuth (`better-auth.state` o `better-auth.oauth_state`, según el flujo/configuración).
Todas son cookies técnicas de autenticación/seguridad y no cookies de analytics,
marketing o tracking.

La sesión se almacena en PostgreSQL mediante Better Auth. Logout y eliminación de
cuenta invalidan sesiones; la eliminación de cuenta también borra cuentas, tokens y
registros de verificación relacionados.

Las rutas de cambio de estado también comprueban el encabezado `Origin` cuando el
navegador lo envía y rechazan orígenes fuera de `TRUSTED_ORIGINS`. Las solicitudes sin
`Origin` se conservan para clientes no navegador; por ello los consumidores externos
deben proteger sus credenciales y no se considera una sustitución de toda la política
CSRF del producto.

Los endpoints de registro, login, Better Auth y creación pública de pedidos tienen
límites de solicitudes en memoria por IP. En despliegues con varias réplicas se debe
reemplazar este mecanismo por un almacén compartido si se necesita un límite global.

## 7. Revisión final de seguridad

La revisión específica no encontró secretos, tokens, cookies ni contraseñas en las
respuestas o logs intencionales del backend. En producción no se registran bodies ni
respuestas completas. Los endpoints administrativos requieren autenticación y los
repositorios filtran por el negocio del usuario; los IDs manipulados no deben cruzar
esa frontera. Los DTOs y esquemas Zod evitan mass assignment de campos administrativos
como propietario, roles y fechas. Las respuestas públicas de catálogo se construyen
con mapeos explícitos y no devuelven objetos Prisma completos.

Las rutas públicas legacy de perfiles fueron deshabilitadas para evitar consultas y
exposición de esos perfiles. Se mantiene como superficie pública únicamente el
catálogo por slug. Pendientes técnicos no resueltos en esta revisión: sustituir el
rate limit en memoria por almacenamiento compartido si hay múltiples réplicas y
definir la operación de limpieza/reintento para assets externos cuando Cloudinary no
responda.

## 8. Consentimiento

No se encontró analytics, marketing, cookies no esenciales ni una finalidad que
justifique registrar una bandera genérica de consentimiento. Por eso no se agregó un
modelo ficticio de consentimiento.

Antes de registrar aceptación de términos o privacidad, el propietario debe definir:

- qué versión exacta se acepta;
- quién es el responsable de cada tratamiento;
- qué finalidades requieren consentimiento y cuáles tienen otra base jurídica;
- cómo se revoca y cómo se conserva evidencia mínima.

La aceptación de Términos, el aviso de privacidad y el consentimiento para marketing
son conceptos distintos y no deben representarse con una sola bandera.

## 9. Logs y errores

En producción el request logger ya no registra bodies ni respuestas. En desarrollo
continúa siendo útil, pero sanitiza nombres, correos, teléfonos, direcciones,
clientes, contraseñas, tokens, cookies y secretos. Los errores desconocidos devuelven
un mensaje genérico y no exponen mensajes de Prisma o del proveedor de email.

No se encontró un sistema externo de logs configurado en este repositorio. La salida
actual es stdout/stderr del proceso y Docker puede recopilarla; el despliegue debe
definir su retención y acceso.

Las subidas de imágenes requieren autenticación para administración, tienen límites de
tamaño de Multer, MIME permitido y una comprobación adicional de la firma binaria
JPEG/PNG/GIF/WebP. Los identificadores de Cloudinary se generan en el servidor y no se
construyen a partir de nombres de archivo del usuario.

## 10. Eliminación de cuenta y relaciones de datos

`DELETE /api/v1/auth/account` requiere una sesión válida. Actualmente elimina, dentro
de una transacción, los registros de Better Auth asociados al usuario (sesiones,
cuentas OAuth, tokens de recuperación y verificaciones), los elementos de pedido que
referencian productos, el negocio y sus relaciones, y finalmente el usuario. Las
relaciones de negocio eliminan en cascada sus productos, menús, categorías, clientes,
pedidos, horarios, mapas, configuraciones e imágenes de base de datos. Después de la
transacción se intentan eliminar de Cloudinary los `publicId` recopilados.

La eliminación explícita de los elementos de pedido es necesaria porque la relación
`OrderItem.productId` usa una restricción que impide borrar un producto referenciado.
Con las relaciones actuales, eliminar la cuenta también elimina pedidos históricos,
incluyendo sus productos, cantidades, precios, datos del cliente asociados y notas.
Técnicamente la operación es consistente con el esquema actual, pero es irreversible
para la aplicación y no conserva un historial anonimizado. También existe un riesgo
operativo porque la transacción de PostgreSQL y la eliminación posterior en Cloudinary
no son una sola operación atómica: podría quedar algún asset huérfano si el proveedor
externo falla.

No se cambió esta estrategia destructiva en esta revisión. Antes de implementar
anonimización, retención o conservación de pedidos, el propietario debe decidir qué
historial operativo necesita conservar y con qué finalidad.

## 11. Retención por categoría

No existe una política de retención definida en el backend. Para evitar inventar
periodos, cada categoría queda expresamente pendiente:

### Datos de cuenta

Existen identificador, nombre, correo, estado de verificación, imagen opcional,
fechas de cuenta, sesiones, cuentas OAuth y credenciales hash. Retención:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

### Clientes

Existen nombre y teléfono normalizado por negocio, utilizados para identificar al
cliente y asociar pedidos. Retención:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

### Pedidos

Existen número, estado, productos, cantidades, precios, datos del cliente usados para
el pedido y notas de texto libre. Retención:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

### Sesiones

Better Auth almacena sesiones, expiración, IP y user-agent de sesión, además de
tokens y registros de autenticación relacionados. Retención:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

### Logs

El proceso escribe stdout/stderr; en producción el logger no registra bodies ni
respuestas y sanitiza campos sensibles. Retención y acceso del proveedor de despliegue:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

### Imágenes

Existen URLs, blur URLs y `publicId` de Cloudinary para imágenes de negocios y
productos, además de registros relacionados en base de datos. Retención:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

### Eliminación

Actualmente una eliminación de cuenta borra los datos descritos en la sección
anterior y después intenta borrar assets de Cloudinary. La retención de respaldos,
logs externos y cualquier copia del proveedor de infraestructura es:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

## 12. Modelo de responsabilidades de datos pendiente de definición

Este backend no determina jurídicamente si Pedilo es responsable, encargado,
controlador, proveedor de software u otra figura. Para definir el modelo se necesita
documentar, por cada flujo:

- qué negocio utiliza Pedilo;
- quién decide para qué se utilizan los datos del cliente;
- quién recibe y atiende el pedido;
- quién atiende reclamaciones;
- quién decide cuánto tiempo se conserva la información;
- si Pedilo utiliza datos de clientes para una finalidad propia;
- si Pedilo puede acceder administrativamente a esos datos;
- si Pedilo proporciona únicamente software o también participa en la operación del
  pedido.

## 13. Datos públicos del negocio

En el catálogo público se consideran visibles, cuando el negocio los configura:
nombre, slug, descripción, logo, portada, ubicación/dirección de negocio, coordenadas,
horarios, teléfono o WhatsApp expuesto para contacto, menús, categorías, productos,
precios, disponibilidad y opciones del catálogo. La decisión de publicar un teléfono,
WhatsApp, dirección o coordenadas debe ser una decisión del negocio y del producto.

No deben exponerse `ownerId`, usuarios, configuración interna, credenciales, datos de
clientes, sesiones, tokens, cuentas OAuth ni campos administrativos. Las tres rutas
legacy de perfil quedaron vacías; la lista anterior describe exclusivamente la
superficie del catálogo público soportado.

## 14. Consentimiento futuro

No se agregó un modelo genérico ni una bandera `consent = true`. El frontend deberá
gestionar el banner de cookies, preferencias y carga condicional de analytics cuando
corresponda.

Si posteriormente una finalidad concreta requiere conservar una decisión en backend,
primero se deberá definir el tipo de finalidad, versión de la política, decisión
otorgada o rechazada, fecha/hora y sujeto al que corresponde. También deberá definirse
la forma mínima de revocación y consulta. No se implementa almacenamiento hasta que
exista esa finalidad y decisión de producto.

## 15. Eliminación y operaciones administrativas

También existen eliminaciones administrativas de negocio, clientes, productos,
menús, categorías y opciones sujetas a autenticación, propiedad del negocio y reglas
de integridad. No se definió una retención automática para ninguna de ellas:
**PENDIENTE DE DEFINIR POR EL PROPIETARIO**.

## 16. Legislación a revisar

La revisión técnica debe coordinarse con la Ley Federal de Protección de Datos
Personales en Posesión de los Particulares vigente y sus obligaciones de aviso,
finalidades, derechos ARCO, seguridad y transferencias. También debe revisarse la Ley
Federal de Protección al Consumidor para el flujo de pedidos y comercio electrónico,
además de propiedad intelectual para contenido subido por negocios.

Fuentes oficiales consultadas:

- [LFPDPPP, Cámara de Diputados, texto vigente](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPDPPP.pdf)
- [LFPC, Cámara de Diputados, texto vigente](https://www.diputados.gob.mx/LeyesBiblio/pdf/LFPC.pdf)
- [Índice oficial de leyes federales](https://www.diputados.gob.mx/LeyesBiblio/index.htm)

Este backend no declara cumplimiento legal total. Faltan decisiones del responsable,
avisos públicos, procedimientos ARCO, contratos/transferencias y revisión profesional.

## 17. Terceros e infraestructura

Las integraciones técnicas detectadas son:

- Better Auth: autenticación, cookies y sesiones; debe verificarse en su documentación
  el tratamiento exacto de cada dato y configuración.
- Google OAuth: inicio de sesión cuando se configuran credenciales; el flujo envía y
  recibe los datos necesarios para autenticar la cuenta. Deben verificarse sus términos
  y documentación oficial.
- Neon/PostgreSQL: persistencia de cuentas, negocio, catálogo, clientes, pedidos y
  sesiones; deben verificarse ubicación, respaldos, acceso y retención del plan usado.
- Cloudinary: almacenamiento y entrega de imágenes, URLs y `publicId`; deben
  verificarse ubicación, retención, borrado y subprocesadores.
- Resend: envío de correos de recuperación y verificación, incluyendo destinatario y
  contenido; deben verificarse tratamiento, logs y retención del proveedor.
- Infraestructura de despliegue: ejecuta el contenedor y puede recopilar stdout/stderr
  y respaldos según la plataforma configurada. El proveedor, región, acceso y
  retención deben confirmarse por entorno; no se asume un proveedor concreto desde el
  código.

El backend actualmente no implementa analytics ni tracking no esencial. No genera
eventos analíticos, identificadores de tracking ni cookies analíticas.

## 18. Pendientes del propietario

1. Identidad y domicilio legal del responsable.
2. Aviso de privacidad integral y simplificado.
3. Canal y procedimiento para derechos ARCO y revocación.
4. Finalidades y base jurídica para clientes de los negocios.
5. Regla de retención o conservación de pedidos históricos.
6. Si los negocios son responsables independientes de los datos de sus clientes o si
   Pedilo actúa como encargado/proveedor de plataforma.
7. Proveedores y países involucrados en hosting, correo, OAuth y almacenamiento.
8. Términos, condiciones de venta, cancelaciones y atención al consumidor.
9. Política de derechos sobre imágenes y contenido subido.
10. Política operativa para respaldos, logs y eliminación definitiva.

Las mejoras de accesibilidad corresponden principalmente al frontend y no se modificó
el frontend en esta tarea.
