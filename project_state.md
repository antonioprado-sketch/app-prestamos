# Estado del proyecto — AppPrestamitos

> Plataforma web de préstamos (cliente / cobrador / administrador). Mobile-first, PWA. Desarrollo bajo protocolo `addv-web-app` (Analizar → Proponer → Confirmar → Implementar; ver `CLAUDE.md`).

Última actualización: 2026-08-14.

## Fase actual: Fase 1 — Fundaciones

Plan completo: `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md` (10 tasks). Spec de diseño: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`.

### Qué existe

| Task | Estado | Detalle |
|---|---|---|
| 1. Scaffolding del repo | ✅ Hecho | `.gitignore`, `.env.example`, `README.md`, `docs/architecture.md` (commit `d87292b`) |
| 2. Docker Compose dev/prod | ✅ Hecho | mysql, minio, api, worker, nginx (commits `cda6280`, `18505b6`) |
| 3. Backend NestJS — bootstrap y salud | ✅ Hecho | `AppModule`, `HealthController` (`/api/v1/health`, `/health/ready`), `PrismaService`, `HttpExceptionFilter`, `ValidationPipe`, helmet, CORS, throttler, pino logger (commits `4fa9604`, `d43cabc`) |
| 4. Esquema Prisma — tablas núcleo | ✅ Hecho | `api/prisma/schema.prisma` con `User`, `RefreshToken`, `Customer`, `Collector`, `Admin`, `AuditLog`, `Configuration` + enums `Role`/`UserStatus`; migración `20260814035948_init` aplicada y verificada (commit `6407ee5`) |
| 5. Autenticación | ✅ Hecho | `api/src/auth/` completo: register/login/refresh/logout/change-password/forgot-password/reset-password, `TokensService` (refresh rotativo en BD), `JwtAuthGuard`/`RolesGuard`, decoradores `@Roles`/`@CurrentUser`, `password.policy.ts` (TDD). Módulos base `audit/` y `email/` creados como dependencia (bootstrap de admin real va en Task 6). 11/11 e2e + 6/6 unit PASS (commit `ccd7bef`) |
| 6. Bootstrap admin + Auditoría | ❌ No iniciado | `AuditService`/`AuditModule` ya existen (creados en Task 5). Falta `api/src/admin-bootstrap/` |
| 7. Frontend — scaffold PWA + Design System | ❌ No iniciado | `web/` existe vacío |
| 8. Frontend — pantallas de autenticación | ❌ No iniciado | Depende de Task 7 |
| 9. CI/CD — GitHub Actions | ❌ No iniciado | |
| 10. Verificación final de Fase 1 | ❌ No iniciado | |

### Cambios recientes (2026-08-14)

Task 4 cerrado: esquema Prisma núcleo escrito y migrado contra MySQL (`docker-compose.dev.yml`, puerto host `3307`). Nota de implementación: usuario `prestamos` no tenía permiso para crear la shadow database que usa `prisma migrate dev`; se le otorgó `GRANT ALL PRIVILEGES ON *.*` vía root (solo dev, no aplica a prod). `AuditLog.userPhone` es nullable, así que la relación `user` se dejó opcional con `onDelete: SetNull` (el plan no especificaba ese detalle).

Task 5 cerrado: autenticación completa. Dos decisiones no cubiertas por el plan original, resueltas con el usuario o por necesidad técnica:
- **Validación de teléfono**: el plan no definía el formato exacto. Se fijó en 10 dígitos exactos (`register`/`forgot-password`/`reset-password`). Para `login`, `ADMIN_PHONE` (default `admin`, no numérico) rompía un regex estricto — se creó un validador custom `IsPhoneOrAdmin` (`api/src/auth/validators/`) que acepta 10 dígitos o el valor literal de `ADMIN_PHONE`. Confirmado con el usuario.
- **Orden de módulos**: `AuditService`/`EmailService` (nominalmente Task 6) se adelantaron porque `AuthService` los consume directamente; `AdminBootstrapService` (el resto de Task 6) sigue pendiente.
- `GET /auth/me` devuelve `{user, customer}` (no aplanado) — si el test e2e de Task 6 (documentado en el plan como `me.body.mustChangePassword`) se escribe literal, ajustar a `me.body.user.mustChangePassword`.

Verificado 2026-08-14: `npm run build` OK, `npm run lint` OK, `npm test` 9/9 PASS, `test/auth.e2e-spec.ts` 11/11 PASS. Working tree limpio tras commits `6407ee5`, `33f2570`, `ccd7bef`.

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

Task 6: Bootstrap del administrador inicial (`AdminBootstrapService`, `OnApplicationBootstrap`) + su e2e-spec, siguiendo `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md`. `AuditService` ya está listo, solo falta el bootstrap.
