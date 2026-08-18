# AGENTS.md — AppPrestamitos

Contexto operativo persistente para cualquier sesión de Codex en este repo. Este proyecto trabaja bajo el protocolo **`addv-web-app`** (skill instalada en Claude Code) — flujo obligatorio **Analizar → Proponer → Confirmar → Implementar**, sin asumir requisitos ambiguos. Ver también `project_state.md` (estado vivo, fuente de verdad), `cmem.md` (narrativa portable del historial) y `docs/superpowers/specs/2026-08-13-app-prestamos-design.md` (spec de diseño).

## Estado del proyecto

Fases 1-5 completas (fundaciones, cliente, administrador, cobrador, BI). BI: KPIs núcleo financiero, segmentación de clientes, desglose por cobrador, gráfica de tendencia semanal (Recharts) y distribución por zona (`GET /admin/bi/kpis`, `/collectors`, `/trends`, `/geo`). Quedan Fases 6-9 del roadmap general (PWA, seguridad/QA, producción, escalabilidad), sin arrancar. Detalle completo corte por corte en `project_state.md`.

## Arquitectura

Modular Monolith:
- `api/` — NestJS 10 + TypeScript, Prisma 5 (MySQL 8), Argon2id, JWT (access 15min + refresh rotativo en BD), nestjs-pino, helmet, throttler, class-validator/class-transformer, Swagger (solo dev, `/api/v1/docs`).
- `web/` — React 18 + Vite 5 + Tailwind 3.4 + vite-plugin-pwa. Leaflet (mapa admin) y MediaPipe (video identidad) se cargan con `import()` dinámico, no van en el bundle principal.
- MySQL 8, MinIO (documentos/video/pagarés vía URLs firmadas), Nginx como proxy.
- Solo dos entornos: `docker-compose.dev.yml` y `docker-compose.prod.yml`.
- Destino de producción: **VPS de Hostinger** con `docker-compose.prod.yml` — no GitHub Pages ni hosting estático; CI solo valida, no despliega.

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

> `npm run test:e2e` sin flags corre las suites en paralelo y choca por el bootstrap del admin compartiendo BD. Correr con `npx jest --config ./test/jest-e2e.json --runInBand` (mismo flag que usa CI).

Frontend (`web/`):
```bash
npm run dev            # vite dev server
npm run build          # tsc -b && vite build
npm run lint            # oxlint
npm test                 # vitest run
```

Docker (raíz del repo):
```bash
docker compose -f docker-compose.dev.yml up     # dev completo
docker compose -f docker-compose.prod.yml up    # prod
```

> El contenedor `api` en dev usa un volumen anónimo para `node_modules` que no se regenera solo al cambiar `schema.prisma`. Tras una migración: `docker compose exec api npx prisma generate` + `docker compose restart api`.

Prisma (`api/`):
```bash
npx prisma migrate dev --name <nombre>
npx prisma generate
npx prisma migrate status
```

## Convenciones de código

- Todo error HTTP pasa por `api/src/common/filters/http-exception.filter.ts` (registrado global como `APP_FILTER`). Respuesta: `{ statusCode, message, error }` — `message` puede ser string o array (mensajes de `class-validator`).
- Validación global de DTOs vía `api/src/common/pipes/validation.pipe.ts` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- `PrismaModule`, `AuditModule`, `ConfigurationModule` y `BlacklistModule` son `@Global()` — no reimportar `PrismaService`/`AuditService`/`ConfigurationService`/`BusinessRulesService`/`BlacklistService` por feature module. `BlacklistService.isBlacklisted(phone)` se llama en cualquier punto de entrada de un cliente (registro y creación de préstamo ya lo hacen, `ForbiddenException`).
- TDD: cada task/corte escribe primero el test que falla, luego la implementación. Mantener esa disciplina para tasks nuevas.
- Todo cambio de funcionalidad va con su test unitario/e2e ejecutable con `npm test` / `npm run test:e2e`. Un cambio sin test no se da por terminado.
- Lógica de negocio financiera (cotización, multas, aplicación de pagos, score) vive en funciones puras sin dependencias de Nest/Prisma (`loans/loan-quote.ts`, `loans/loan-penalty.ts`, `payments/payment-application.ts`, `score/score-calculation.ts`), cada una con su `.spec.ts` TDD. El `Service` correspondiente solo envuelve esa función pura con acceso a BD/auditoría.
- Reglas de negocio configurables (multa/día, umbrales de score) viven en `Configuration` (key/value JSON) vía `BusinessRulesService`, que centraliza todas las claves conocidas en un solo `get()`/`set()`. Las funciones puras las reciben como parámetro explícito, nunca las leen de una constante de módulo.
- RBAC por ownership, no solo por rol: `RolesGuard` valida el rol del token, pero el `Service` siempre valida además que el recurso pertenece al actor (cliente ve solo lo propio, cobrador solo lo asignado). Cuando el actor no tiene acceso a un recurso que sí existe, devolver `404` (no `403`) para no filtrar existencia de IDs ajenos.
- Los `Service` de `admin/` exportan sus helpers de mapeo Prisma→DTO (tipos + funciones) para que módulos con la misma forma de datos pero distinto scope de ownership (ej. `collector/`) los reusen en vez de duplicar el mapeo.
- Un endpoint nunca devuelve `null`/`undefined` como cuerpo completo de la respuesta — NestJS lo serializa como `200` con body vacío, lo que rompe `res.json()` del lado cliente. Envolver siempre en un objeto, ej. `{ location: T | null }`.
- Endpoints que agregan sobre toda la BD (ej. `GET /admin/bi/kpis`) se testean por delta (antes/después de un fixture conocido), nunca por igualdad absoluta.
- Librerías pesadas del lado cliente que solo usa una pantalla concreta se cargan sin ir en el bundle principal — `import()` dinámico imperativo para APIs no-JSX (MediaPipe, Leaflet), `React.lazy()`+`Suspense` para librerías usadas como JSX (Recharts). Verificar en el build que terminan en su propio chunk.

## Reglas del protocolo `addv-web-app` aplicadas a este repo

- No escribir/modificar archivos reales ni ejecutar comandos con efecto de estado sin confirmación explícita del segmento correspondiente.
- Antes de cerrar cualquier entrega: build + lint + tests en verde, y verificar que los servicios Docker levantan (`docker compose ... up` + healthcheck) cuando el cambio toca infraestructura.
- Actualizar `project_state.md`, `cmem.md`, `CLAUDE.md`/`AGENTS.md` y `README.md` antes de cada commit+push — no solo al cerrar fase. Es la única vía por la que el contexto viaja entre máquinas/sesiones/agentes.
- Ante ambigüedad de negocio (reglas de préstamos, roles, límites), preguntar — no asumir. Las restricciones ya fijadas arriba no se reabren sin pedirlo explícitamente el usuario.
