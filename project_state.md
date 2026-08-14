# Estado del proyecto — AppPrestamitos

> Plataforma web de préstamos (cliente / cobrador / administrador). Mobile-first, PWA. Desarrollo bajo protocolo `addv-web-app` (Analizar → Proponer → Confirmar → Implementar; ver `CLAUDE.md`).

Última actualización: 2026-08-14.

## Fase actual: Fase 1 — Fundaciones (✅ completa) → definiendo Fase 2

Plan completo: `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md` (10/10 tasks hechas). Spec de diseño: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`. Fase 2 (préstamos/cuotas/pagos, documentos, etc.) aún no tiene plan escrito.

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
| 9. CI/CD — GitHub Actions | ✅ Hecho | `.github/workflows/ci.yml`: job `api` (lint+build+`migrate deploy`+unit+e2e con servicio MySQL) y job `web` (lint+test+build). Verificado localmente que `migrate deploy` no requiere shadow DB (commit `1d95b3b`) |
| 10. Verificación final de Fase 1 | ✅ Hecho | Stack completo verificado con `docker compose -f docker-compose.dev.yml up -d --build` real (no solo servicios sueltos): health checks vía Nginx→API→MySQL, flujo admin (login→cambio obligatorio→me) y registro/login de cliente, todo por curl contra `http://localhost`. README actualizado con instrucciones. 3 bugs de infra encontrados y corregidos (commit `7d58daf`) |

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

Task 9 cerrado: pipeline CI. Se corrigieron 3 gaps del snippet original del plan (confirmado con el usuario): faltaba lint en ambos jobs, usaba `prisma migrate dev --name ci` (requiere shadow DB — mismo problema de permisos resuelto ad-hoc en Task 4) en vez de `migrate deploy`, y el `npx jest --runInBand` del plan solo corre unit tests (el `testRegex` no matchea `*.e2e-spec.ts`) pese a que el objetivo del task decía "unit e integración". Se agregó step separado de e2e con `test/jest-e2e.json`. Verificado localmente (no en GitHub Actions real, no hay corrida remota todavía) que `prisma migrate deploy` aplica limpio con un usuario de privilegios acotados a una sola BD — igual a como el servicio `mysql` de Actions crea `MYSQL_USER`.

**Pendiente:** el workflow no se ha ejecutado en GitHub real (requiere push/PR); solo validado localmente (sintaxis YAML + `migrate deploy` aislado).

Task 10 cerrado: verificación final de Fase 1 con **docker compose real** (no dev servers locales sueltos, que fue lo usado en Tasks 3-9). Esto expuso 3 bugs de infraestructura que ningún test unitario/e2e local detecta porque corren fuera de contenedores:

1. **`.dockerignore` no excluía `api/node_modules`** (549MB) — el patrón bare `node_modules` no se comportó como recursivo de forma confiable; el build context llegó a transferir 513MB y el primer intento de `npm ci` dentro del build falló con "Exit handler never called!" (bug conocido de npm, agravado por el contexto gigante).
2. **Bloqueo de red no relacionado con el código**: Avast (antivirus del host) intercepta TLS y su certificado (`NODE_EXTRA_CA_CERTS`) solo está registrado en el host, no dentro del contenedor Alpine — `npm ci` fallaba con `UNABLE_TO_VERIFY_LEAF_SIGNATURE` hasta que el usuario desactivó Avast. No se tocó el Dockerfile para esto (no se debe commitear un cert de antivirus personal); en CI (GitHub Actions) no aplica.
3. **El bind mount `./api:/app` en dev tapaba el `node_modules` Linux de la imagen con el `node_modules` Windows del host** (host y contenedor comparten el mismo path pero arquitecturas distintas) → `nest: not found` dentro del contenedor. Se agregó volumen anónimo `/app/node_modules` en `api` y `worker`.
4. **`Dockerfile.api` nunca corría `prisma generate`** — el cliente Prisma quedaba sin los tipos generados (`User`, `Role` no exportados), rompiendo la compilación TS dentro del contenedor aunque compilaba bien en el host (donde sí se había corrido `prisma generate` manualmente en Task 4). Se agregó el paso en los stages `dev` y `build` de `Dockerfile.api`.

Verificado 2026-08-14 contra el stack real: `curl http://localhost/api/v1/health` y `/health/ready` → `200 ok`; login admin (`admin`/`admin`) fuerza `mustChangePassword`, cambio de contraseña limpia la bandera; registro de cliente (`5512345678`) + login + `/auth/me` devuelve `customer` asociado. El servicio `worker` reinicia en bucle porque `main-worker.ts` es de Fase 2 — es el comportamiento esperado, documentado en el README. Working tree limpio tras commit `7d58daf`.

**Fase 1 — Fundaciones: completa (Tasks 1-10).**

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

Fase 1 completa. Definir con el usuario el alcance de Fase 2 (spec: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`) — probablemente préstamos/cuotas/pagos, MinIO para documentos, worker de jobs. Pendiente no bloqueante: nunca se hizo una pasada visual real en navegador del flujo de auth (Task 8 solo se verificó por curl/API) — recomendable antes de construir Fase 2 encima.
