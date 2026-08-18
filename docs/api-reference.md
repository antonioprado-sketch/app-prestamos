# Referencia de API — AppPrestamitos

Base URL: `/api/v1` (dev vía Nginx en `http://localhost/api/v1`; directo al API en `http://localhost:3000/api/v1`).

- Autenticación: `Authorization: Bearer <access_token>` salvo los endpoints marcados como públicos.
- Errores: HTTP status code con cuerpo `{ "statusCode": number, "message": string | string[], "error": string }`.
- Swagger interactivo (solo dev): `http://localhost:3000/api/v1/docs`.
- Roles: `CLIENT`, `COLLECTOR`, `ADMIN`. Cuando el actor no tiene acceso a un recurso existente, la API devuelve `404` (no `403`) para no filtrar existencia de IDs.

## Salud

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/health` | — | Liveness: el proceso responde |
| GET | `/health/ready` | — | Readiness: dependencias listas |

## Autenticación (`/auth`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | — | Registro de **cliente**. Valida teléfono (bloqueado si está en `Blacklist`), crea `User` (CLIENT) + `Customer` con `isNewCustomer=true`. |
| POST | `/auth/login` | — | Login por teléfono+contraseña. Fuerza `mustChangePassword`; bloquea `INACTIVE` y `BLOCKED` (por intentos fallidos). Devuelve `{ accessToken, refreshToken, user }`. |
| POST | `/auth/refresh` | — | Renueva el access token con un refresh token válido (rotativo: el usado se revoca). |
| POST | `/auth/logout` | Bearer | Revoca el refresh token. |
| POST | `/auth/change-password` | Bearer | Cambio de contraseña (usado en el primer login obligatorio y a demanda). |
| POST | `/auth/forgot-password` | — | Solicita recuperación de contraseña (envía enlace/código). |
| POST | `/auth/reset-password` | — | Restablece contraseña con el token de recuperación. |
| GET | `/auth/me` | Bearer | Datos del usuario autenticado (rol, estado, perfil según rol). |

## Cliente — perfil y onboarding (`/customers`, `/locations`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| PATCH | `/customers/me` | CLIENT | Actualiza el perfil del cliente (onboarding: datos, aval, dirección, referencias). |
| GET | `/customers/me/score` | CLIENT | Nivel de score del cliente (`GREEN/YELLOW/ORANGE/RED`) y sus reglas (umbrales). |
| POST | `/locations` | CLIENT | Registra una ubicación GPS (`lat`, `lng`, `accuracy`, `source`). |
| GET | `/admin/locations` | ADMIN | Última ubicación por cliente (para el mapa). |

## Préstamos — cliente (`/loans`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/loans/quote` | Opcional | Cotización sin crear nada: `{ amount, model, openingDate }` → `{ amount, total, payment, lastPayment, schedule }`. Con token aplica el tope del cliente. |
| GET | `/loans/quote-limit` | Opcional | Tope máximo del usuario: `null` (sin tope, anónimo/cliente sin restricción) o un número. |
| POST | `/loans` | CLIENT | Crea el préstamo (estado `DRAFT`) + schedule. `409` si ya existe uno vigente (`ActiveLoanExistsError`). |
| GET | `/loans` | CLIENT | Préstamos del cliente autenticado. |
| GET | `/loans/:id` | CLIENT | Detalle de un préstamo propio (404 si no es suyo). |
| GET | `/loans/:id/penalty` | CLIENT | Penalización acumulada a hoy (función pura `loan-penalty`). |
| POST | `/loans/:id/pagare` | CLIENT | Genera el pagaré PDF (firma PNG → PDF con detalle de cuotas), lo sube a MinIO como `Document` tipo `PAGARE` y pasa el préstamo a `SUBMITTED`. Requiere onboarding completo y estado `DRAFT`/`REQUIRES_CORRECTION`. |
| GET | `/loans/:id/payments` | CLIENT/COLLECTOR/ADMIN | Pagos de un préstamo (owner-validado). |

## Documentos (`/documents`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/documents` | CLIENT | Sube un documento. Body: imagen base64 (INE frente/reverso, comprobante de domicilio) o video (identidad). Guarda en MinIO con checksum SHA-256. |
| GET | `/documents` | CLIENT | Documentos del cliente. |
| GET | `/documents/:id/signed-url` | CLIENT | URL firmada de MinIO para descargar/ver el documento (expira). |
| GET | `/admin/documents/:id/signed-url` | ADMIN | URL firmada de cualquier documento (revisión del admin). |

## Pagos (`/loans/:id/payments`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/loans/:id/payments` | ADMIN/COLLECTOR | Registra un pago: `{ amount, idempotencyKey, notes? }`. Aplica monto a las cuotas (orden de vencimiento, primera la multa pendiente). `409` si la `idempotencyKey` ya se usó; `400` si sobrepasa lo adeudado. Primer pago de `APPROVED` → `ACTIVE`; pago total → `LIQUIDATED`. |

## Score — admin (`/admin/scores`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/scores` | ADMIN | Scores de todos los clientes. |
| PATCH | `/admin/scores/:phone` | ADMIN | Sobreescribe el score de un cliente (`scoreOverride`). |

## Colección — cobrador (`/collector/loans`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/collector/loans` | COLLECTOR | Préstamos asignados al cobrador (cartera), con saldo y estado de cuotas. |
| GET | `/collector/loans/:id` | COLLECTOR | Detalle de un préstamo asignado (404 si no es suyo). |
| GET | `/collector/loans/:id/documents` | COLLECTOR | Documentos del préstamo (para verificar identidad al cobrar). |
| GET | `/collector/loans/:id/location` | COLLECTOR | Ubicación del cliente (última registrada). |
| POST | `/collector/loans/:id/documents` | COLLECTOR | Sube documento del cobrador (`COLLECTOR_DOC`, ej. evidencia de cobro). |

## Aumento de crédito (`/credit-increase`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/credit-increase` | CLIENT | Solicita aumento: `{ amount }` (múltiplo de $500). `409` si ya hay una solicitud `PENDING`. Notifica a admins/cobradores activos (app + correo). |
| GET | `/credit-increase/me` | CLIENT | Solicitudes del cliente autenticado. |
| GET | `/credit-increase` | ADMIN/COLLECTOR | Solicitudes `PENDING` (y resueltas). |
| PATCH | `/credit-increase/:id` | ADMIN/COLLECTOR | Resuelve la solicitud: `{ status: 'APPROVED'\|'REJECTED', note? }`. El primero que la resuelve cierra el caso; aprobar actualiza `Customer.creditLimit` + `isNewCustomer=false` (auditado). |

## Notificaciones (`/notifications`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/notifications` | Bearer | Notificaciones del usuario. |
| PATCH | `/notifications/:id/read` | Bearer | Marca una notificación como leída. |
| POST | `/notifications/webpush-subscribe` | Bearer | Guarda una suscripción Web Push (VAPID) para el usuario. |

## Administración — usuarios (`/admin/users`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/users` | ADMIN | Lista unificada de usuarios (admins, cobradores, clientes) con rol, status y perfil. |
| POST | `/admin/users/:phone/reset-password` | ADMIN | Genera contraseña temporal y fuerza `mustChangePassword=true`. |
| PATCH | `/admin/users/:phone/role` | ADMIN | Cambia el rol de un usuario. |
| PATCH | `/admin/collectors/:phone/status` | ADMIN | Activa/desactiva un cobrador (`Collector.active` + `User.status` sincronizados). |

## Administración — clientes (`/admin/customers`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/customers` | ADMIN | Lista de clientes (búsqueda por nombre/teléfono). |
| POST | `/admin/customers` | ADMIN | Alta manual de un cliente. |
| GET | `/admin/customers/:phone` | ADMIN | Detalle de un cliente (incluye score, crédito, préstamos). |
| GET | `/admin/customers/:phone/documents` | ADMIN | Documentos del cliente. |
| DELETE | `/admin/customers/:phone` | ADMIN | Baja de cliente (hard delete cascada). |
| PATCH | `/admin/customers/:phone/new-client` | ADMIN | Marca/desmarca `isNewCustomer` (controla el tope de cliente nuevo). |

## Administración — préstamos (`/admin/loans`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/loans` | ADMIN | Lista de solicitudes, con filtro por `status`. |
| GET | `/admin/loans/:id` | ADMIN | Detalle completo (cliente, documentos, schedule, pagos). |
| POST | `/admin/loans/:id/approve` | ADMIN | Aprueba (requiere estado revisable). Notifica al cliente. |
| POST | `/admin/loans/:id/reject` | ADMIN | Rechaza con `reason`. Notifica al cliente. |
| POST | `/admin/loans/:id/request-correction` | ADMIN | Devuelve a `REQUIRES_CORRECTION` con `reason`. Notifica al cliente. |
| POST | `/admin/loans/:id/assign-collector` | ADMIN | Asigna cobrador (estado `APPROVED`/`ACTIVE`). Notifica al cobrador. |
| POST | `/admin/loans/:id/unassign-collector` | ADMIN | Quita el cobrador asignado. |

## Administración — cobradores (`/admin/collectors`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/collectors` | ADMIN | Lista de cobradores. |
| POST | `/admin/collectors` | ADMIN | Alta de cobrador (crea `User` COLLECTOR + `Collector`). |
| PATCH | `/admin/collectors/:phone/status` | ADMIN | Activa/desactiva (ver `/admin/users`). |

## Administración — configuración (`/admin/configuration`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/configuration/business-rules` | ADMIN | Reglas actuales (multa/día, umbrales de score, topes por color). |
| PUT | `/admin/configuration/business-rules` | ADMIN | Actualiza las reglas (validadas contra el esquema). |
| GET | `/admin/configuration/email` | ADMIN | Configuración de correo (sin exponer la contraseña). |
| PUT | `/admin/configuration/email` | ADMIN | Guarda credenciales SMTP (contraseña cifrada con `EMAIL_ENCRYPTION_KEY`). |
| POST | `/admin/configuration/email/test` | ADMIN | Envía un correo de prueba con la configuración actual. |

## Administración — blacklist (`/admin/blacklist`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/blacklist` | ADMIN | Teléfonos vetados. |
| POST | `/admin/blacklist` | ADMIN | Veta un teléfono (bloquea registro y creación de préstamos). |
| DELETE | `/admin/blacklist/:phone` | ADMIN | Desveta un teléfono. |

## BI (`/admin/bi`)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/admin/bi/kpis` | ADMIN | KPIs núcleo financiero (cartera, desembolsado, morosidad, clientes activos, etc.). Se testean por delta. |
| GET | `/admin/bi/collectors` | ADMIN | Desglose de cartera por cobrador. |
| GET | `/admin/bi/trends` | ADMIN | Tendencia semanal (para la gráfica Recharts). |
| GET | `/admin/bi/geo` | ADMIN | Distribución por zona (para el mapa). |

## Códigos de estado frecuentes

| Código | Caso |
|---|---|
| 200 | OK |
| 201 | Recurso creado |
| 400 | Validación de DTO o regla de negocio (mensaje en `message`) |
| 401 | Token faltante/inválido/expirado |
| 403 | Rol no permitido o teléfono vetado |
| 404 | Recurso inexistente o ajeno (ownership) |
| 409 | Conflicto de estado: préstamo vigente, solicitud PENDING duplicada, `idempotencyKey` repetida, estado no revisable |
| 429 | Rate limit (throttler) |
| 500 | Error no controlado |