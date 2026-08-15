# CLAUDE.md — AppPrestamitos

Contexto operativo persistente para cualquier sesión de Claude en este repo. Este proyecto trabaja bajo el protocolo **`addv-web-app`** (skill instalada) — flujo obligatorio **Analizar → Proponer → Confirmar → Implementar**, sin asumir requisitos ambiguos. Ver también `project_state.md` (estado vivo) y `docs/superpowers/specs/2026-08-13-app-prestamos-design.md` (spec de diseño) y `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md` (plan de Fase 1, task por task).

## Arquitectura

Modular Monolith:
- `api/` — NestJS 10 + TypeScript, Prisma 5 (MySQL 8), Argon2id, JWT (access 15min + refresh rotativo en BD), nestjs-pino, helmet, throttler, class-validator/class-transformer, Swagger (solo dev, `/api/v1/docs`).
- `web/` — React 18 + Vite 5 + Tailwind 3.4 + vite-plugin-pwa.
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
- RBAC por ownership, no solo por rol: `RolesGuard` valida el rol del token, pero el `Service` siempre valida además que el recurso pertenece al actor (cliente ve solo lo propio, cobrador solo lo asignado — `Loan.collectorId`). Cuando el actor no tiene acceso a un recurso que sí existe, devolver `404` (no `403`) para no filtrar la existencia de IDs ajenos — patrón ya usado en `loans`, `payments`, `admin-loans`.

## Reglas del protocolo `addv-web-app` aplicadas a este repo

- No escribir/modificar archivos reales ni ejecutar comandos con efecto de estado sin confirmación explícita del segmento correspondiente.
- Antes de cerrar cualquier entrega: build + lint + tests en verde, y verificar que los servicios Docker levantan (`docker compose ... up` + healthcheck) cuando el cambio toca infraestructura.
- Actualizar `project_state.md` al cerrar cada segmento — no solo al final de la fase.
- Ante ambigüedad de negocio (reglas de préstamos, roles, límites), preguntar — no asumir. Las restricciones ya fijadas arriba no se reabren sin pedirlo explícitamente el usuario.
