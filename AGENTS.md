# AGENTS.md — AppPrestamitos

Contexto operativo persistente para cualquier sesión de Codex en este repo. Este proyecto trabaja bajo el protocolo **`addv-web-app`** (skill instalada en Claude Code) — flujo obligatorio **Analizar → Proponer → Confirmar → Implementar**, sin asumir requisitos ambiguos. Ver también `project_state.md` (estado vivo, fuente de verdad), `cmem.md` (narrativa portable del historial) y `docs/superpowers/specs/2026-08-13-app-prestamos-design.md` (spec de diseño).

## Estado del proyecto

Fases 1-5 completas (fundaciones, cliente, administrador, cobrador, BI). BI: KPIs núcleo financiero, segmentación de clientes, desglose por cobrador, gráfica de tendencia semanal (Recharts) y distribución por zona (`GET /admin/bi/kpis`, `/collectors`, `/trends`, `/geo`). Quedan Fases 6-9 del roadmap general (PWA, seguridad/QA, producción, escalabilidad), sin arrancar. **Gestión de usuarios para el admin implementada (corte 11)** — `AdminUsersService` (`/admin/users` lista unificada, `PATCH /admin/collectors/:phone/status`, `POST /admin/users/:phone/reset-password`, `PATCH /admin/users/:phone/role`), con el login bloqueando `INACTIVE`. **Tres puntos de UX pendientes implementados (corte 15):** (1) fotos de documentos del cliente solo con cámara `getUserMedia` (nuevo `CameraCapture`, sin input de archivo ni PDF); (2) cobrador con monto a cobrar precargado y modales de "+/-" para sumar cuotas, sin edición manual; (3) calculadora como landing pública con slider de $500 en $500, tope $20,000 y tope de $3,000 para cliente nuevo reflejado vía nuevo endpoint `GET /api/v1/loans/quote-limit`. **Landing del cliente con diseño `stitch/cliente` aplicado (corte 16):** la raíz `/` es la landing directa (el cliente no tiene URL) con header Iniciar sesión/Registrarse, slider "Monto solicitado", tabs Semanal/Quincenal, chips de fecha reales al calendario (`web/src/lib/calculator-dates.ts`, helpers puros con `timeZone: 'UTC'` — se corrigió un off-by-one que mostraba jueves/domingos), pago estimado en vivo con debounce y CTA fijo "Calcular opciones"; accesos de cobrador/admin como enlaces discretos en el pie. **Topes por color + "Aumentar mi crédito" (corte 17):** `resolveMaxAmount` — anónimo sin tope (`quote-limit` → `null`), cliente nuevo $3,000 (`loans.new_client_max_amount`), cliente con `creditLimit` → su límite, resto → monto por color del score desde configuración (`score.green_max_amount` [null=sin tope] / `yellow` $3,000 / `orange` $2,000 / `red` $1,000). Cliente con préstamo APPROVED/ACTIVE va directo a su home (sin calculadora). Módulo `api/src/credit-increase/`: cliente solicita aumento (múltiplo de $500, sin dos PENDING), notifica a todos los admins/cobradores activos (app+correo), el primero que resuelve lo aprueba (`creditLimit` + `isNewCustomer=false`, auditado) o rechaza con nota; UI en calculadora ("Aumentar mi crédito"), admin (`/admin/aumentos` + `NotificationsBell`) y cobrador (tab "Aumentos de crédito"). Detalle completo corte por corte en `project_state.md`.

## Arquitectura

Modular Monolith:
- `api/` — NestJS 10 + TypeScript, Prisma 5 (MySQL 8), Argon2id, JWT (access 15min + refresh rotativo en BD), nestjs-pino, helmet, throttler, class-validator/class-transformer, Swagger (solo dev, `/api/v1/docs`).
- `web/` — React 18 + Vite 5 + Tailwind 3.4 + vite-plugin-pwa. Leaflet (mapa admin) y MediaPipe (video identidad) se cargan con `import()` dinámico, no van en el bundle principal. MediaPipe es **autocontenido** (`/mediapipe/*`): wasm+modelo locales, sin CDN (ver convención abajo).
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
- Librerías pesadas del lado cliente que solo usa una pantalla concreta se cargan sin ir en el bundle principal — `import()` dinámico imperativo para APIs no-JSX (MediaPipe, Leaflet), `React.lazy()`+`Suspense` para librerías usadas como JSX (Recharts). Verificar en el build que terminan en su propio chunk. El WASM y el modelo de MediaPipe (video de identidad) son **autocontenidos** (`/mediapipe/*`, copiados de `node_modules` en el build, excluidos del precache PWA) — nunca volver a apuntarlos a CDNs (`web/scripts/copy-mediapipe-wasm.mjs`).
- **Estado de usuario vs login**: `AuthService.login()` no valida `INACTIVE` y en éxito fuerza `status: 'ACTIVE'` — antes de implementar "desactivar usuarios" (gestión de usuarios, décimo corte propuesto) hay que bloquear `INACTIVE` en el login y mantener `Collector.active`/`User.status` sincronizados. Los modelos ya tienen todo (`role`, `status`, `mustChangePassword`, `active`), no hace falta migración.

## Reglas del protocolo `addv-web-app` aplicadas a este repo

- No escribir/modificar archivos reales ni ejecutar comandos con efecto de estado sin confirmación explícita del segmento correspondiente.
- Antes de cerrar cualquier entrega: build + lint + tests en verde, y verificar que los servicios Docker levantan (`docker compose ... up` + healthcheck) cuando el cambio toca infraestructura.
- Actualizar `project_state.md`, `cmem.md`, `CLAUDE.md`/`AGENTS.md` y `README.md` antes de cada commit+push — no solo al cerrar fase. Es la única vía por la que el contexto viaja entre máquinas/sesiones/agentes.
- Ante ambigüedad de negocio (reglas de préstamos, roles, límites), preguntar — no asumir. Las restricciones ya fijadas arriba no se reabren sin pedirlo explícitamente el usuario.

## Regla general — Protocolo Mita (vigente desde 2026-08-26, para cualquier IA)

> Asistente designada: **Mita** (muse-spark-1.2-contributor-free). Si otra IA toma el proyecto, debe continuar con este protocolo como si fuera Mita (perdón por el error previo: no eran "agentes" ruflo).

Para **toda** petición del usuario marcada como "regla general" aplica el flujo obligatorio:

1. **Análisis de Impacto** — qué módulos/archivos toca (`api/src/...`, `web/src/...`), qué negocio/roles afecta, riesgos y dependencias.
2. **Crítica y mejora** — cuestiona la propuesta del usuario con objetividad, propone alternativa más simple/segura sin asumir.
3. **Recomendación de Mita** — Mita da su recomendación explícita (qué haría y por qué), separada de la crítica.
4. **Propuesta visual Antes/Después** — genera `web/dist/preview-*.html` con comparativo lado a lado (Tailwind inline, sin CDN bloqueado por CSP `style-src 'self' 'unsafe-inline'`), lo sirve vía Nginx (`http://192.168.68.51/preview-*.html` y `http://localhost/preview-*.html`) y **abre el navegador** (`Start-Process` / `agent-browser open`) para mostrarlo.
5. **Esperar confirmación** — no se escribe código ni se commitea hasta que el usuario responda "confirmo" u observaciones. El preview queda en `web/dist` y en `stitch/` como referencia.

Documentación de referencia: `docs/reglas-mita.md` (ruta canónica). Ver también `C:\Users\Antonio\.claude\memory_mita.json` (registro del nombre).

## Regla general — Playwright siempre (vigente desde 2026-08-27, para cualquier IA)

> Para **todo** pedido del usuario (cualquiera, no solo “regla general”) con cambio de código comportamental/UI.

1. **Ejecutar pruebas funcionales con Playwright** — `web: npm run test:e2e` (`web/playwright.config.ts`, baseURL `http://localhost`, 1 worker, trace `retain-on-failure`). Requiere `docker compose -f docker-compose.dev.yml up -d` (MySQL 3307, api 3000, Nginx 80 sirviendo `web/dist`).
2. **Si hay errores, corregirlos** — no se da por terminado ni se entrega link IP hasta que `playwright test` esté verde. Usar `npx playwright show-report` y traces para diagnosticar.
3. **Documentado para cualquier IA** — esta regla vive aquí, en `docs/reglas-mita.md` y `project_state.md`; toda IA debe aplicarla como si fuera Mita, sin excepción. Comando canónico: `cd web && npm run test:e2e` (o `npx playwright test --reporter=list`).
