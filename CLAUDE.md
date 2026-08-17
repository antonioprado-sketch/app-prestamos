# CLAUDE.md — AppPrestamitos

Contexto operativo persistente para cualquier sesión de Claude en este repo. Este proyecto trabaja bajo el protocolo **`addv-web-app`** (skill instalada) — flujo obligatorio **Analizar → Proponer → Confirmar → Implementar**, sin asumir requisitos ambiguos. Ver también `project_state.md` (estado vivo) y `docs/superpowers/specs/2026-08-13-app-prestamos-design.md` (spec de diseño) y `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md` (plan de Fase 1, task por task).

## Arquitectura

Modular Monolith:
- `api/` — NestJS 10 + TypeScript, Prisma 5 (MySQL 8), Argon2id, JWT (access 15min + refresh rotativo en BD), nestjs-pino, helmet, throttler, class-validator/class-transformer, Swagger (solo dev, `/api/v1/docs`).
- `web/` — React 18 + Vite 5 + Tailwind 3.4 + vite-plugin-pwa (`strategies: 'injectManifest'`, service worker propio en `web/src/sw.ts` — no `generateSW`, porque Web Push necesita listeners `push`/`notificationclick` personalizados).
- MySQL 8, MinIO (documentos/video/pagarés vía URLs firmadas), Nginx como proxy.
- Solo dos entornos: `docker-compose.dev.yml` y `docker-compose.prod.yml`.

## Restricciones globales (no reabrir sin pedir al usuario)

- Dinero: siempre `DECIMAL(10,2)`, nunca float.
- Teléfono = PK de `users` (`VARCHAR(15)`); no existe flujo de cambio de número.
- Password: 8–64 caracteres, ≥1 mayúscula, ≥1 número, símbolos permitidos. Hash: Argon2id (nunca bcrypt/plain).
- Secrets solo en `.env` (gitignored); `.env.example` con placeholders siempre actualizado.
- Admin inicial vía `.env` (`ADMIN_PHONE`, `ADMIN_PASSWORD`), `must_change_password=true` forzado en primer login.
- Zona horaria `America/Mexico_City` en MySQL y backend. Idioma UI: español (MX). Moneda: MXN (`$`).
- No exponer secrets/contraseñas/datos sensibles en logs ni respuestas de API.
- Commits pequeños, mensaje convencional (`feat:`, `fix:`, `chore:`, `docs:`).
- API versionada bajo `/api/v1`.

## Comandos frecuentes

Backend (`api/`):
```bash
npm run start:dev   # dev con watch
npm run build        # compilar (nest build)
npm run lint          # eslint --fix
npm test               # jest (unit)
npm run test:e2e     # jest e2e (requiere MySQL arriba)
npm run test:cov     # cobertura
```

> `npm run test:e2e` sin flags corre las suites en paralelo (varios workers bootstrapean `AdminBootstrapService` a la vez y chocan creando el mismo admin). Localmente correr con `npx jest --config ./test/jest-e2e.json --runInBand` (mismo flag que ya usa CI en `.github/workflows/ci.yml`).

Docker (raíz del repo):
```bash
docker compose -f docker-compose.dev.yml up     # dev completo
docker compose -f docker-compose.prod.yml up    # prod
```

Prisma (`api/`):
```bash
npx prisma migrate dev --name <nombre>
npx prisma generate
npx prisma migrate status
```

## Convenciones de código

- Todo error HTTP pasa por `api/src/common/filters/http-exception.filter.ts` (registrado global como `APP_FILTER`). Respuesta: `{ statusCode, message, error }` — `message` puede ser string o array (mensajes de `class-validator`).
- Validación global de DTOs vía `api/src/common/pipes/validation.pipe.ts` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- `PrismaModule` es `@Global()` — no reimportar `PrismaService` por feature module.
- TDD: en el plan de Fase 1 cada task escribe primero el test que falla, luego la implementación. Mantener esa disciplina para tasks nuevas.
- Todo cambio de funcionalidad va con su test unitario/e2e ejecutable con `npm test` / `npm run test:e2e`. Un cambio sin test no se da por terminado.
- Lógica de negocio financiera (cotización, multas, aplicación de pagos, score) vive en funciones puras sin dependencias de Nest/Prisma (`loans/loan-quote.ts`, `loans/loan-penalty.ts`, `payments/payment-application.ts`, `score/score-calculation.ts`), cada una con su `.spec.ts` de unit tests TDD. El `Service` correspondiente solo envuelve esa función pura con acceso a BD/auditoría — mantener este patrón al agregar reglas de negocio nuevas.
- Reglas de negocio configurables (multa/día, umbrales de score) viven en la tabla `Configuration` (`key`/`value` JSON) vía `ConfigurationService` (get/set genérico) y `BusinessRulesService` (`configuration/business-rules.service.ts`, `@Global()`) que centraliza las 3 claves conocidas (`business-rules.constants.ts`) en un solo `get()`/`set()` con validación cruzada (ej. `yellowMaxDays < orangeMaxDays`). Las funciones puras reciben estos valores como parámetro explícito (nunca los leen de una constante de módulo) — si se agrega una regla configurable nueva, sumarla a `business-rules.constants.ts` y pasarla como parámetro, no hardcodearla.
- Overrides manuales auditados (ej. `Customer.scoreOverride`) son permanentes hasta que se limpian explícitamente (`level: null`), nunca se pierden solo por un evento real (pago, nuevo atraso) — mismo criterio si se agrega otro override similar.
- Los `Service` de `admin/` construyen y exportan tipos/helpers reusables (`AdminLoanResult`, `toAdminLoanResult`, `ADMIN_LOAN_INCLUDE` en `admin/admin-loans.service.ts`) para que otros módulos con la misma forma de datos pero distinto scope de ownership (ej. `collector/collector-loans.service.ts`, que filtra por `collectorId` en vez de ver todo) los reusen en vez de duplicar el mapeo Prisma→DTO.
- `documents/documents.service.ts` separa explícitamente `customerPhone` (dueño del documento) de `uploadedBy` (quien lo subió) — no asumir que son siempre la misma persona al agregar un flujo de subida nuevo; el schema de `Document` ya tiene ambas columnas por diseño.
- Captura de datos opcional del lado cliente (ej. `web/src/lib/location.ts`) nunca bloquea ni muestra error al usuario si falla — permiso denegado, navegador sin soporte, o request fallido se ignoran en silencio. Solo se dispara si hay consentimiento explícito guardado (`localStorage`), nunca a ciegas.
- Un endpoint nunca devuelve `null`/`undefined` como cuerpo completo de la respuesta — NestJS lo serializa como `200` con body vacío (no el literal JSON `null`), lo que rompe `res.json()` del lado cliente. Envolver siempre en un objeto, ej. `{ location: T | null }` (ver `collector/collector-loans.controller.ts` → `findLocation`).
- Librerías pesadas del lado cliente que solo usa una pantalla concreta se cargan sin ir en el bundle principal — verificar siempre en el build que terminan en su propio chunk. Dos formas según cómo se consuma la librería: `import()` dinámico imperativo dentro de un `useEffect` para APIs no-JSX (`@mediapipe/tasks-vision`, `leaflet`); `React.lazy()` + `<Suspense>` envolviendo un componente aparte cuando la librería se usa como JSX (`recharts` en `WeeklyTrendChart.tsx`) — no se puede `import()` imperativamente un set de componentes React y seguir escribiéndolos como JSX.
- Endpoints que agregan sobre toda la BD (ej. `GET /admin/bi/kpis`) se testean por **delta** (llamar antes/después de crear un fixture conocido y comparar la diferencia), nunca por igualdad absoluta — el endpoint ve todos los datos de la BD de test, no solo el fixture del test actual, así que una aserción de igualdad exacta es frágil frente a datos residuales de otros tests o de uso manual previo.
- RBAC por ownership, no solo por rol: `RolesGuard` valida el rol del token, pero el `Service` siempre valida además que el recurso pertenece al actor (cliente ve solo lo propio, cobrador solo lo asignado — `Loan.collectorId`). Cuando el actor no tiene acceso a un recurso que sí existe, devolver `404` (no `403`) para no filtrar la existencia de IDs ajenos — patrón ya usado en `loans`, `payments`, `admin-loans`.
- PWA — el runtime caching y `navigateFallback` viven ahora en `web/src/sw.ts` (workbox-precaching/routing/strategies importados a mano, `injectManifest`), no en `vite.config.ts`: `NetworkFirst` acotado a GET de `/api/v1/**` **excluyendo siempre `/api/v1/auth/**`** — nunca cachear en disco nada que pueda contener tokens/credenciales. TTL corto (5 min) + `networkTimeoutSeconds` bajo para no servir datos viejos si hay red. `navigateFallback` a `/index.html` necesita `/api/` en su denylist, si no las rutas de API caen al shell de React en vez de responder JSON. `src/sw.ts` está excluido de `tsconfig.app.json` (lib `webworker` choca con el lib `DOM` del resto del frontend) — si se edita, no hay type-check automático vía `tsc -b`.
- Banners/tours dismissibles del lado cliente (`LocationConsentBanner`, `WelcomeTour`, `PushConsentBanner`) siguen el mismo patrón: helper propio en `web/src/lib/` con `get*()`/`set*()` sobre una clave dedicada de `localStorage` (nunca una clave genérica compartida), sin backend ni dependencia nueva — el componente lee el flag en el primer render y no vuelve a mostrarse una vez marcado. Reusar este patrón para cualquier UI "mostrar una sola vez" nueva en vez de armar un mecanismo distinto.
- Notificaciones (`api/src/notifications/`, `NotificationsModule` `@Global()` igual que `AuditModule`/`EmailModule`): `NotificationsService.create()` es el único punto de entrada — inserta la fila `Notification` (in-app, fuente de verdad de lista/badge/leído) y dispara el Web Push en segundo plano sin bloquear al llamador (nunca `await` directo en el flujo principal, siempre `.catch(() => undefined)` en el call site — mismo criterio que `captureLocation`: efecto secundario opcional, nunca hace fallar la acción real). Sin `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` en el `.env`, loggea `[push-simulado]` en vez de fallar — mismo patrón que `EmailService` sin credenciales de Gmail. Al agregar un evento nuevo que deba notificar, llamar `notifications.create({...}).catch(() => undefined)` justo después del `audit.log()` del `Service` que ya hace la acción real — no crear lógica de negocio nueva para esto.
- Cualquier módulo nuevo cuyo controller use `@UseGuards(JwtAuthGuard)` debe importar `JwtModule.register({})` en su propio `@Module` (ver `notifications.module.ts`, `collector-loans.module.ts`, `locations.module.ts`) — `JwtAuthGuard` necesita `JwtService` resuelto desde el contexto del módulo que lo usa, no alcanza con que `AuthModule` lo exporte.
- `class-validator`: `@ValidateNested()` solo, sin `@IsDefined()` antes, **no** rechaza una propiedad anidada completamente ausente del body — el DTO pasa la validación con esa propiedad `undefined` y el crash aparece más abajo como `500`, no como `400`. Si un campo anidado es obligatorio, poner `@IsDefined()` + `@ValidateNested()` + `@Type(() => Dto)` juntos (ver `notifications/dto/subscribe-push.dto.ts`).

## Reglas del protocolo `addv-web-app` aplicadas a este repo

- No escribir/modificar archivos reales ni ejecutar comandos con efecto de estado sin confirmación explícita del segmento correspondiente.
- Antes de cerrar cualquier entrega: build + lint + tests en verde, y verificar que los servicios Docker levantan (`docker compose ... up` + healthcheck) cuando el cambio toca infraestructura.
- Actualizar `project_state.md` al cerrar cada segmento — no solo al final de la fase.
- **Antes de cada `git commit`+`git push`, sin excepción**: actualizar los cuatro documentos vivos — `project_state.md` (estado, ya cubierto arriba), `cmem.md` (narrativa portable — agregar sección nueva cuando hubo decisiones de arquitectura/patrón desde su última edición, no solo en cierres de fase), `CLAUDE.md` (este archivo — actualizar cuando se agregan módulos nuevos, convenciones o patrones reusables que una sesión futura necesita conocer sin tener que re-derivarlos leyendo código) y `README.md` (instrucciones de instalación/ejecución — actualizar cuando cambian pasos de setup, variables de entorno nuevas, o comandos). Es la única vía por la que el contexto viaja entre máquinas/sesiones (la memoria de conversación no sincroniza) — dejar alguno desactualizado significa que la próxima sesión (o alguien nuevo siguiendo el README) arranca con contexto viejo.
- Ante ambigüedad de negocio (reglas de préstamos, roles, límites), preguntar — no asumir. Las restricciones ya fijadas arriba no se reabren sin pedirlo explícitamente el usuario.
