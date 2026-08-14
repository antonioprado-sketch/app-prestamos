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
| 6. Bootstrap admin + Auditoría | ✅ Hecho | `AdminBootstrapService` (`OnApplicationBootstrap`) crea admin desde `.env` si no existe, `must_change_password=true`. `AuditService` ya existía desde Task 5. 3/3 e2e específico + 16/16 e2e total PASS (commit `eaeb768`) |
| 7. Frontend — scaffold PWA + Design System | ✅ Hecho | Vite+React 18+TS, Tailwind con tokens, vite-plugin-pwa, componentes `Button`/`Input`/`Card`/`Alert`/`Spinner`, `apiFetch` con refresh automático. Build+lint+vitest (2/2) OK (commit `053e7c7`) |
| 8. Frontend — pantallas de autenticación | ✅ Hecho | `AuthProvider`/`useAuth`, `LoginPage` (con test), `RegisterPage`, `ChangePasswordPage`, `App.tsx` con router protegido por rol y `mustChangePassword`, `DashboardShell` placeholder. Build+lint+vitest (3/3) OK; verificado end-to-end vía curl contra proxy real de Vite (commit `ece1648`) |
| 9. CI/CD — GitHub Actions | ❌ No iniciado | |
| 10. Verificación final de Fase 1 | ❌ No iniciado | |

### Cambios recientes (2026-08-14)

Task 4 cerrado: esquema Prisma núcleo escrito y migrado contra MySQL (`docker-compose.dev.yml`, puerto host `3307`). Nota de implementación: usuario `prestamos` no tenía permiso para crear la shadow database que usa `prisma migrate dev`; se le otorgó `GRANT ALL PRIVILEGES ON *.*` vía root (solo dev, no aplica a prod). `AuditLog.userPhone` es nullable, así que la relación `user` se dejó opcional con `onDelete: SetNull` (el plan no especificaba ese detalle).

Task 5 cerrado: autenticación completa. Dos decisiones no cubiertas por el plan original, resueltas con el usuario o por necesidad técnica:
- **Validación de teléfono**: el plan no definía el formato exacto. Se fijó en 10 dígitos exactos (`register`/`forgot-password`/`reset-password`). Para `login`, `ADMIN_PHONE` (default `admin`, no numérico) rompía un regex estricto — se creó un validador custom `IsPhoneOrAdmin` (`api/src/auth/validators/`) que acepta 10 dígitos o el valor literal de `ADMIN_PHONE`. Confirmado con el usuario.
- **Orden de módulos**: `AuditService`/`EmailService` (nominalmente Task 6) se adelantaron porque `AuthService` los consume directamente; `AdminBootstrapService` (el resto de Task 6) sigue pendiente.
- `GET /auth/me` devuelve `{user, customer}` (no aplanado) — si el test e2e de Task 6 (documentado en el plan como `me.body.mustChangePassword`) se escribe literal, ajustar a `me.body.user.mustChangePassword`.

Verificado 2026-08-14: `npm run build` OK, `npm run lint` OK, `npm test` 9/9 PASS, `test/auth.e2e-spec.ts` 11/11 PASS. Working tree limpio tras commits `6407ee5`, `33f2570`, `ccd7bef`.

Task 6 cerrado: `AdminBootstrapService`. Hallazgo importante: los e2e de Task 5 no limpiaban sus datos (mismo teléfono/admin persistente en la BD de dev), así que una segunda corrida de la suite completa fallaba en cascada (teléfono ya registrado, admin con contraseña ya cambiada). Se agregó `deleteMany` en `beforeAll`/`afterAll` de `auth.e2e-spec.ts` y `admin-bootstrap.e2e-spec.ts` — verificado corriendo la suite dos veces seguidas (16/16 PASS ambas veces). Este patrón de limpieza debe repetirse en los e2e de Tasks futuras que creen datos con teléfonos fijos.

Verificado 2026-08-14: `npm run build` OK, `npm run lint` OK, `npm test` 9/9 PASS, e2e completo (health+auth+admin-bootstrap) 16/16 PASS, repetido dos veces. Working tree limpio tras commit `eaeb768`.

Task 7 cerrado: scaffold de `web/`. Decisión confirmada con el usuario: el template de Vite instala por defecto React 19 + Vite 8; se bajó explícitamente a React 18.3 + Vite 5.4 para cumplir la decisión ya fijada en CLAUDE.md (no reabierta, solo ejecutada). Vulnerabilidad npm audit conocida (esbuild <=0.24.2, moderate, solo dev-server) aceptada — arreglarla requeriría subir a Vite 8, que contradice la decisión de versión; no afecta el build de producción.

Verificado 2026-08-14: `npm run build` OK (incluye generación de service worker), `npm run lint` (oxlint) OK, `npm test` (vitest) 2/2 PASS. Working tree limpio tras commit `053e7c7`.

Task 8 cerrado: pantallas de autenticación. `login()` del contexto se modificó respecto al snippet del plan para devolver el `AuthUser` (no solo `Promise<void>`) — `LoginPage`/`RegisterPage` necesitan el `role`/`mustChangePassword` recién resueltos para decidir a dónde navegar, y leer del contexto tras `await` no garantiza el valor actualizado en el mismo ciclo. No se pudo verificar visualmente en navegador (extensión de Chrome no conectada en esta sesión); se verificó el contrato end-to-end con curl contra el proxy real de Vite (`/api/v1/auth/login`, `/api/v1/auth/me`) — pendiente una pasada visual manual antes de dar la Fase 1 por cerrada del todo.

Verificado 2026-08-14: `npm run build` OK, `npm run lint` OK, `npm test` (vitest) 3/3 PASS. Working tree limpio tras commit `ece1648`. Dev servers quedaron corriendo (api :3000, web :5173) para pruebas manuales.

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

Task 9: CI/CD — GitHub Actions (`.github/workflows/ci.yml`: lint+test api con MySQL en container, build web), siguiendo `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md`. Antes de eso, conviene una pasada visual manual del flujo de auth en navegador (no verificada aún).
