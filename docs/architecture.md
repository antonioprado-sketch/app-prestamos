# Arquitectura técnica — AppPrestamitos

Documento de arquitectura del sistema. La spec de diseño original (contexto, requisitos y decisiones de Fase 1) está en `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`.

## 1. Visión general

Plataforma web de préstamos personales (fintech) con tres roles: **cliente**, **cobrador** y **administrador**. Mobile-first, instalable como PWA, con cobranza semanal/quincenal, multas por atraso, score de riesgo por cliente, video de identidad y notificaciones push.

Es un **Modular Monolith**: una sola API NestJS con módulos de dominio claramente separados, servida junto al frontend por Nginx, con MySQL y MinIO como infraestructura.

## 2. Componentes del sistema

```
                 ┌────────────────────────────────────────────┐
   Cliente /     │  Nginx (proxy + estáticos)                  │
   Cobrador /    │  ├── /        → web/dist (SPA React)        │
   Admin         │  └── /api/v1/*→ API NestJS (reverse proxy)  │
                 └──────────────┬─────────────────────────────┘
                                │ HTTP (JSON, versionado)
                 ┌──────────────▼─────────────┐
                 │  api/  (NestJS 10, TS)      │
                 │  auth, loans, payments,     │
                 │  admin, collector, bi,      │
                 │  credit-increase, ...       │
                 └──┬───────────┬──────────┬───┘
                    │           │          │
              ┌─────▼───┐  ┌────▼────┐  ┌──▼─────────────┐
              │  MySQL 8│  │ MinIO   │  │ (worker)*      │
              │ Prisma 5│  │ docs/   │  │                │
              └─────────┘  │ video/  │  └────────────────┘
                           │ pagarés │
                           └─────────┘
```

`*` El servicio `worker` está definido en los compose desde Fase 1 pero su código (`main-worker.ts`) aún no existe: las multas se calculan en vivo (función pura) en lugar de con un cron. El contenedor se mantiene **detenido** en dev (`docker compose stop worker`).

## 3. Stack tecnológico

| Capa | Tecnología |
|---|---|
| API | NestJS 10 + TypeScript, Prisma 5 (MySQL 8), Argon2id, JWT (access 15 min + refresh rotativo en BD), nestjs-pino, helmet, throttler, class-validator/class-transformer, Swagger (solo dev) |
| Frontend | React 18 + Vite 5 + Tailwind 3.4 + vite-plugin-pwa. Leaflet (mapa admin) y MediaPipe (video identidad) con `import()` dinámico |
| Almacenamiento | MinIO (documentos, video, pagarés) con URLs firmadas |
| Infra | Docker Compose (dev/prod), Nginx (proxy + estáticos), CI GitHub Actions (solo valida) |
| Producción | VPS Hostinger con `docker-compose.prod.yml` |

## 4. Estructura del monorepo

```
api/                      # Backend NestJS
  prisma/schema.prisma    # Modelo de datos (fuente única)
  src/
    common/               # filters, guards, pipes, decorators
      filters/http-exception.filter.ts   # formato de error global
      guards/{jwt-auth, roles, optional-jwt-auth}.guard.ts
      pipes/validation.pipe.ts           # whitelist + forbidNonWhitelisted
    auth/                 # registro, login, refresh, recuperación
    customers/            # perfil del cliente (PATCH me)
    loans/                # cotización, creación, pagaré, penalización
    payments/             # registro de pagos y aplicación a cuotas
    documents/            # subida de documentos (cliente)
    locations/            # geolocalización del cliente
    notifications/        # notificaciones en app + Web Push
    score/                # score de riesgo por nivel de atraso
    credit-increase/      # solicitudes de aumento de crédito
    admin/                # módulos de administración
      admin-loans, admin-customers, admin-collectors, admin-users,
      admin-configuration, admin-blacklist, admin-documents
    bi/                   # KPIs, tendencias, distribución geo
    collector/            # cartera del cobrador
    health/               # liveness / readiness
web/                      # Frontend React (SPA)
  src/
    pages/                # una página por pantalla
    pages/dashboard/      # shells por rol (client/collector/admin)
    components/           # UI kit (ui/*) + componentes de dominio
    lib/                  # api.ts, calculator-dates.ts, push.ts, location.ts
stitch/                   # diseños de referencia exportados (ver §9)
docs/                     # spec, plan, arquitectura, referencia API, guía
docker/nginx/             # configs de Nginx (dev y prod)
```

## 5. Backend — patrones y convenciones

### 5.1 Módulos globales (`@Global()`)
- `PrismaModule` → `PrismaService`
- `AuditModule` → `AuditService` (auditoría de acciones administrativas)
- `ConfigurationModule` → `ConfigurationService` (reglas configurables) y `BusinessRulesService`
- `BlacklistModule` → `BlacklistService.isBlacklisted(phone)` — bloquea registro y creación de préstamos de teléfonos vetados (`ForbiddenException`).

No se reimportan por feature module.

### 5.2 Lógica de negocio en funciones puras
La lógica financiera vive en funciones puras (sin dependencias de Nest/Prisma), cada una con su `.spec.ts` (TDD):

| Archivo | Responsabilidad |
|---|---|
| `loans/loan-quote.ts` | Cotización: factor 1.4, 20 parcialidades semanales / 10 quincenales, fechas `Date.UTC` |
| `loans/loan-penalty.ts` | Multa por día de atraso (configurable `penalty.per_day`) |
| `payments/payment-application.ts` | Aplica un pago a las cuotas (en orden, primera vencida) + multa; valida sobrepago |
| `score/score-calculation.ts` | Nivel de score desde días máximos de atraso |

El `Service` correspondiente solo envuelve la función pura con acceso a BD, auditoría y notificaciones.

### 5.3 Errores y validación
- Todo error HTTP pasa por `http-exception.filter.ts` (registrado como `APP_FILTER`): respuesta `{ statusCode, message, error }`, donde `message` puede ser string o array (class-validator).
- Validación global con `validation.pipe.ts`: `whitelist`, `forbidNonWhitelisted`, `transform`.
- RBAC por ownership: `RolesGuard` valida el rol del token; el `Service` además valida que el recurso pertenezca al actor. Recursos ajenos existentes → `404` (no `403`), para no filtrar existencia de IDs.

### 5.4 Seguridad
- Passwords con **Argon2id** (nunca bcrypt/plain), 8–64 caracteres, ≥1 mayúscula, ≥1 número.
- JWT access 15 min + refresh token rotativo (hash en BD, `RefreshToken`), logout revoca.
- Login con bloqueo por intentos fallidos (`failedAttempts`/`blockedUntil`) y fuerzas `status: ACTIVE`; el login bloquea `INACTIVE`.
- Admin inicial desde `.env` (`ADMIN_PHONE`/`ADMIN_PASSWORD`) con `mustChangePassword=true` en el primer login.
- Helmet, throttler, pino (no se loguean secretos/contraseñas).
- Secreto `EMAIL_ENCRYPTION_KEY` cifra la contraseña de correo guardada en configuración (AES en BD, nunca en claro).

## 6. Modelo de datos

Fuente única: `api/prisma/schema.prisma` (MySQL 8, PK de `users` = teléfono `VARCHAR(15)`, dinero siempre `DECIMAL(10,2)`).

### Entidades
| Modelo | Descripción | Relaciones clave |
|---|---|---|
| `User` | Cuenta (teléfono PK, `role`, `status`, `mustChangePassword`) | 1:1 con Customer/Collector/Admin, 1:N tokens/audit/notifications/push |
| `Customer` | Perfil del cliente (datos, aval, dirección, `isNewCustomer`, `creditLimit`, `scoreOverride`) | 1:N loans/documents/locations/creditIncreaseRequests |
| `Collector` | Cobrador (activo/inactivo) | 1:N loans |
| `Admin` | Administrador | — |
| `RefreshToken` | Refresh tokens rotativos (hash) | N:1 User |
| `AuditLog` | Auditoría de acciones (prev/new JSON) | N:1 User |
| `Loan` | Préstamo (folio único, monto, total, modelo, estado, penalización pagada) | N:1 Customer/Collector/Approver, 1:N schedule/documents/payments |
| `LoanSchedule` | Cuotas (secuencia, vencimiento, monto, estado) | N:1 Loan |
| `Document` | Documento firmado en MinIO (tipo, checksum, storageKey) | N:1 Customer, N:1 Loan |
| `Location` | Geolocalización del cliente | N:1 Customer |
| `Payment` | Pago recibido (monto, penalización, idempotencyKey única) | N:1 Loan |
| `Configuration` | Reglas de negocio key/value JSON | — |
| `Blacklist` | Teléfonos vetados | — |
| `Notification` | Notificación en app | N:1 User |
| `PushSubscription` | Suscripción Web Push (VAPID) | N:1 User |
| `CreditIncreaseRequest` | Solicitud de aumento de crédito | N:1 Customer/Resolver |

### Enums clave
- `Role`: `CLIENT | COLLECTOR | ADMIN`
- `UserStatus`: `ACTIVE | INACTIVE | BLOCKED`
- `LoanStatus`: `DRAFT | SUBMITTED | IN_REVIEW | REQUIRES_CORRECTION | APPROVED | REJECTED | ACTIVE | LIQUIDATED | CANCELLED`
- `ScheduleStatus`: `PENDING | PAID | PARTIAL | OVERDUE`
- `LoanModel`: `WEEKLY | BIWEEKLY`
- `ScoreLevel`: `GREEN | YELLOW | ORANGE | RED`
- `DocumentType`: `INE_FRONT | INE_BACK | ADDRESS_PROOF | PAGARE | VIDEO_IDENTITY | COLLECTOR_DOC`
- `CreditIncreaseStatus`: `PENDING | APPROVED | REJECTED`

## 7. Flujos de negocio

### 7.1 Ciclo de vida del préstamo
```
Cliente                          Admin                          Cobrador
  │  calcula cotización (quote)                                  │
  │  crea préstamo → DRAFT (schedule PENDING)                    │
  │  completa onboarding + docs + video                          │
  │  firma pagaré → SUBMITTED                                    │
  │                                  ├── revisa → IN_REVIEW      │
  │                                  ├── aprueba → APPROVED      │
  │                                  │      (notif. al cliente)  │
  │                                  ├── rechaza → REJECTED      │
  │                                  └── pide corrección →       │
  │                                      REQUIRES_CORRECTION      │
  │                                  asigna cobrador (APPROVED/   │
  │                                  ACTIVE) → notif. al cobrador │
  │                                                    cobra →    │
  │ 1er pago → ACTIVE                                primer pago  │
  │                                                    pagos →    │
  último pago → LIQUIDATED                           liquidación  │
```
- Un cliente con préstamo `APPROVED`/`ACTIVE` va directo a su home (no puede cotizar/solicitar otro).
- `ActiveLoanExistsError` → `409` si intenta crear con un préstamo vigente.

### 7.2 Cotización
`POST /api/v1/loans/quote` (auth opcional): factor de interés **1.4** sobre el monto, dividido en **20 pagos semanales** o **10 quincenales** (el último pago ajusta el redondeo). Las fechas se calculan sobre `America/Mexico_City` usando `Date.UTC` (helpers puros en `loan-quote.ts` y `calculator-dates.ts`).

Tope máximo (`resolveMaxAmount`):
- Anónimo → sin tope (`quote-limit` devuelve `null`).
- Cliente nuevo → `loans.new_client_max_amount` (default $3,000).
- Cliente con `Customer.creditLimit` → ese límite.
- Resto → tope por color de score (configurable, ver §7.5).
- La UI obliga a montos múltiplos de $500, de $500 a $20,000.

### 7.3 Pagos y penalización
- Registro de pago: `POST /api/v1/loans/:id/payments` (admin/cobrador). Aplica monto a las cuotas en orden de vencimiento, cobra primero la multa pendiente.
- `idempotencyKey` única por pago (evita duplicados).
- Multa por día de atraso: `penalty.per_day` (default $50), calculada en vivo por `loan-penalty.ts` (sin cron).
- El primer pago de un préstamo `APPROVED` lo pasa a `ACTIVE`; el pago que cubre todo lo liquida (`LIQUIDATED`).

### 7.4 Score
`calculateScoreLevel(maxDaysLate, yellowMaxDays, orangeMaxDays)`:
- 0 días de atraso → `GREEN`
- ≤ `score.yellow_max_days` (7) → `YELLOW`
- ≤ `score.orange_max_days` (15) → `ORANGE`
- resto → `RED`

El score se calcula sobre préstamos `APPROVED`/`ACTIVE`. El admin puede sobreescribirlo por cliente (`Customer.scoreOverride`).

### 7.5 Reglas de negocio configurables (`Configuration`)
Claves centralizadas en `BusinessRulesService` (`configuration/business-rules.constants.ts`):

| Clave | Default | Uso |
|---|---|---|
| `penalty.per_day` | 50 | Multa por día de atraso (MXN) |
| `score.yellow_max_days` | 7 | Umbral YELLOW (días) |
| `score.orange_max_days` | 15 | Umbral ORANGE (días) |
| `score.green_max_amount` | `null` | Tope GREEN (null = sin tope) |
| `score.yellow_max_amount` | 3000 | Tope YELLOW |
| `score.orange_max_amount` | 2000 | Tope ORANGE |
| `score.red_max_amount` | 1000 | Tope RED |

Las funciones puras reciben estos valores como parámetro explícito, nunca los leen de constantes de módulo. Editable desde `/admin/configuracion`. También hay configuración de correo (`GET/PUT/POST test /admin/configuration/email`) con cifrado AES de la contraseña.

### 7.6 Aumento de crédito
- El cliente solicita un aumento (`POST /api/v1/credit-increase`): monto múltiplo de $500, sin dos solicitudes `PENDING` simultáneas.
- Notifica a todos los admins/cobradores activos (notificación en app + correo).
- El primero que resuelve (`PATCH /api/v1/credit-increase/:id`) cierra el caso:
  - **Aprobar**: `Customer.creditLimit = amount`, `isNewCustomer = false` (auditado).
  - **Rechazar**: nota obligatoria.
- UI: sección "Aumentar mi crédito" en la calculadora (cliente), tab "Aumentos de crédito" en cartera (cobrador) y `/admin/aumentos` (admin).

### 7.7 Notificaciones y Web Push
- Notificaciones en app por usuario (`Notification`).
- Web Push con VAPID (`PushSubscription`, `webpush-subscribe`). Sin claves VAPID el envío se simula (log) en vez de fallar.
- Eventos que notifican: aprobación/rechazo/corrección de préstamo, asignación a cobrador, resolución de aumento de crédito.

## 8. Frontend

### 8.1 Rutas
Públicas:
| Ruta | Página |
|---|---|
| `/` | Landing (calculadora pública) o redirige al home del rol |
| `/calculadora` | Calculadora pública (slider $500–$20,000, tabs Semanal/Quincenal, "Aumentar mi crédito") |
| `/login`, `/register` | Autenticación (registro solo cliente) |
| `/cliente`, `/cobrador`, `/admin` | Logins por rol (accesos discretos en el pie de la landing) |
| `/change-password` | Cambio de contraseña obligatorio (`mustChangePassword`) |

Cliente:
| Ruta | Página |
|---|---|
| `/app/cliente` | Home (`ClientHome`): saldo pendiente, próximo pago, progreso % y anillo de score; sin préstamo activo muestra CTA a `/calculadora` |
| `/onboarding` | Datos personales + aval + dirección |
| `/documentos` | Fotos de documentos con cámara (`CameraCapture`, `getUserMedia`) |
| `/video` | Video de identidad (MediaPipe autocontenido) |
| `/pagare` | Firma de pagaré (PDF con `signedAt = openingDate` si es migrado) |
| `/calculadora` | Solicitar préstamo / aumento; historial de pagos visible como `schedule` con `paidAmount`/`status` |

Cobrador:
| Ruta | Página |
|---|---|
| `/app/cobrador` | Home del cobrador |
| `/collector/cartera` | Cartera asignada: monto precargado, modales "+/-" de cuotas, tab "Aumentos de crédito" |

Admin:
| Ruta | Página |
|---|---|
| `/admin/indicadores` | BI (KPIs, tendencia semanal Recharts, distribución por zona) |
| `/admin/solicitudes` | Solicitudes de préstamo (aprobar/rechazar/corrección/asignar cobrador) |
| `/admin/clientes` | Clientes (crear, detalle, documentos, nuevo cliente) |
| `/admin/usuarios` | Gestión de usuarios (status, rol, reset de contraseña) |
| `/admin/configuracion` | Reglas de negocio + correo |
| `/admin/ubicaciones` | Mapa Leaflet |
| `/admin/aumentos` | Aumentos de crédito |

### 8.2 Carga diferida
- Librerías pesadas que usa una sola pantalla **no** van en el bundle principal: `import()` dinámico imperativo para APIs no-JSX (MediaPipe, Leaflet), `React.lazy()`+`Suspense` para JSX (Recharts). Se verifica en el build que terminen en su propio chunk.
- MediaPipe es **autocontenido**: wasm + modelo se copian a `/mediapipe/*` desde `node_modules` en el build (`web/scripts/copy-mediapipe-wasm.mjs`), excluidos del precache PWA. Nunca apuntar a CDNs.

### 8.3 PWA
`vite-plugin-pwa` con service worker (`web/src/sw.ts`), precache del bundle y banner de instalación. Notificaciones push y sincronización en línea.

## 9. Diseño de referencia (`stitch/`)

- `stitch/cliente/` es el diseño de referencia **actual** (`code.html` + `screen.png` + `DESIGN.md`), aplicado a la landing/calculadora del cliente (corte 16).
- El resto de diseños antiguos (`dashboard_cliente`, `dashboard_cobrador`, `dashboard_administrador_bi`, `lendwise`, `onboarding_documentos`, `onboarding_video_identidad`) fueron eliminados del repo; la carpeta `stitch/` solo conserva lo que aún es referencia.

## 10. Infraestructura y despliegue

- **dev**: `docker compose -f docker-compose.dev.yml up` (api, web/Nginx, mysql, minio, worker detenido). `node_modules` de la API usa volumen anónimo: tras una migración, `docker compose exec api npx prisma generate` + `docker compose restart api`.
- **prod**: `docker compose -f docker-compose.prod.yml up` en el VPS Hostinger. TLS real vía Nginx, migraciones con `npx prisma migrate deploy`. Pendiente de Fase 8: firewall, backups probados de MySQL+MinIO, exponer MinIO tras proxy.
- **CI** (`ci.yml`, GitHub Actions): solo valida — build, lint, tests unitarios y e2e de navegador. No despliega.

## 11. Decisiones de diseño clave

1. **Teléfono = PK** de `users` (`VARCHAR(15)`): no existe flujo de cambio de número.
2. **Dinero en `DECIMAL(10,2)`** siempre, nunca float.
3. **Zona horaria** `America/Mexico_City` en MySQL y backend; fechas de cuotas en `Date.UTC` para evitar off-by-one.
4. **Multas calculadas en vivo** (función pura), sin cron ni worker activo.
5. **RBAC por ownership**, no solo por rol; recursos ajenos devuelven `404`.
6. **Endpoints que agregan toda la BD** (BI) se testean por delta, no por igualdad absoluta.
7. **Moneda y UI en español (MX)**, símbolo `$`.
8. **Secrets solo en `.env`** (gitignored); `.env.example` con placeholders siempre actualizado.
9. **`addv-web-app`**: flujo Analizar → Proponer → Confirmar → Implementar; TDD primero, build+lint+tests en verde antes de cerrar cada entrega; docs vivos (`project_state.md`, `cmem.md`, `CLAUDE.md`, `AGENTS.md`, `README.md`) actualizados en cada corte.

## 12. Referencias

- Spec de diseño: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`
- Referencia de API: `docs/api-reference.md`
- Guía de usuario por rol: `docs/user-guide.md`
- Estado vivo del proyecto: `project_state.md`
- Historial narrativo: `cmem.md`