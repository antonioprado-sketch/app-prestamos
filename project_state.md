# Estado del proyecto — AppPrestamitos

> Plataforma web de préstamos (cliente / cobrador / administrador). Mobile-first, PWA. Desarrollo bajo protocolo `addv-web-app` (Analizar → Proponer → Confirmar → Implementar; ver `CLAUDE.md`).

Última actualización: 2026-08-13.

## Fase actual: Fase 1 — Fundaciones

Plan completo: `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md` (10 tasks). Spec de diseño: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`.

### Qué existe

| Task | Estado | Detalle |
|---|---|---|
| 1. Scaffolding del repo | ✅ Hecho | `.gitignore`, `.env.example`, `README.md`, `docs/architecture.md` (commit `d87292b`) |
| 2. Docker Compose dev/prod | ✅ Hecho | mysql, minio, api, worker, nginx (commits `cda6280`, `18505b6`) |
| 3. Backend NestJS — bootstrap y salud | ✅ Hecho, con ajustes sin commitear | `AppModule`, `HealthController` (`/api/v1/health`, `/health/ready`), `PrismaService`, `HttpExceptionFilter`, `ValidationPipe`, helmet, CORS, throttler, pino logger (commit base `4fa9604`) |
| 4. Esquema Prisma — tablas núcleo | ❌ No iniciado | `api/prisma/schema.prisma` solo tiene el datasource default de `prisma init`, sin modelos (`User`, `Customer`, `Collector`, `Admin`, `RefreshToken`, `AuditLog`, `Configuration`) |
| 5. Autenticación | ❌ No iniciado | Sin `api/src/auth/` |
| 6. Bootstrap admin + Auditoría | ❌ No iniciado | Sin `api/src/audit/`, `api/src/admin-bootstrap/` |
| 7. Frontend — scaffold PWA + Design System | ❌ No iniciado | `web/` existe vacío |
| 8. Frontend — pantallas de autenticación | ❌ No iniciado | Depende de Task 7 |
| 9. CI/CD — GitHub Actions | ❌ No iniciado | |
| 10. Verificación final de Fase 1 | ❌ No iniciado | |

### Cambios sin commitear (2026-08-13)

`api/src/app.module.ts`, `api/src/common/filters/http-exception.filter.ts`, `api/src/main.ts`:
- Conecta `ValidationPipe` custom (`api/src/common/pipes/validation.pipe.ts`) que existía sin usar.
- Registra `HttpExceptionFilter` como `APP_FILTER` global (antes no estaba enganchado).
- `HttpExceptionFilter` ahora normaliza `message`/`error` desde el body de `HttpException` (soporta arrays de `class-validator`); la respuesta de error pasó de `{statusCode, message, path, timestamp}` a `{statusCode, message, error}`.

Verificado 2026-08-13: `npm run build` OK, `npm run lint` OK (sin warnings), `npm test` 3/3 PASS (spec nuevo `http-exception.filter.spec.ts` agregado, era el único archivo de test del repo — antes había cero tests).

**Pendiente de decisión del usuario:** si el cambio de forma de la respuesta de error (se quitó `path`/`timestamp`) rompe algún contrato ya acordado con el frontend/spec — no hay consumidores todavía (Task 7/8 sin empezar), así que no hay regresión real hoy, pero conviene confirmarlo antes de commitear.

## Decisiones ya tomadas (del spec/plan, no reabrir sin pedir)

- Modular Monolith: `api/` (NestJS 10) + `web/` (React 18 + Vite 5 + Tailwind 3.4 PWA) + MySQL 8 + MinIO + Nginx.
- Teléfono = PK de `users`, sin flujo de cambio de número.
- Password policy: 8–64 chars, ≥1 mayúscula, ≥1 número, símbolos permitidos; hash Argon2id.
- JWT access 15 min + refresh rotativo persistido en BD.
- Solo entornos dev y prod (`docker-compose.dev.yml` / `docker-compose.prod.yml`).
- Correo vía Gmail SMTP App Password; si no configurado, `EmailService` solo loguea (no falla).
- Zona horaria `America/Mexico_City`, idioma UI español (MX), moneda MXN.
- API bajo prefijo `/api/v1`.
- Admin inicial desde `.env` (`ADMIN_PHONE`/`ADMIN_PASSWORD`), `must_change_password=true` forzado en primer login.

## Próximo paso sugerido

Confirmar y commitear el segmento de Task 3 (filter/pipe/main.ts + test nuevo), luego seguir con Task 4 (esquema Prisma) siguiendo el plan.
