# Estado del proyecto — AppPrestamitos

> Plataforma web de préstamos (cliente / cobrador / administrador). Mobile-first, PWA. Desarrollo bajo protocolo `addv-web-app` (Analizar → Proponer → Confirmar → Implementar; ver `CLAUDE.md`).

Última actualización: 2026-08-14.

## Fase actual: Fase 2 — Cliente (en curso, sin plan escrito task-por-task)

Fase 1 completa: `docs/superpowers/plans/2026-08-13-fase1-fundaciones.md` (10/10 tasks). Spec de diseño: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`. Fase 2 (calculadora/quote, onboarding por pasos, documentos, video, pagaré PDF, solicitud + estados) se está construyendo incrementalmente sin plan escrito previo — cada corte se confirma con el usuario antes de implementar.

### Fase 2 — avance

**Calculadora de préstamos (primer corte, 2026-08-14, commit `29ef0f7`):** motor financiero puro (`api/src/loans/loan-quote.ts`, 14/14 tests TDD) para modelos semanal (20 pagos, total/20) y quincenal (10 pagos en día 15/último día del mes, total/10), redondeo con último pago absorbiendo residuo, nunca expone la tasa 40% (R4). Endpoint público `POST /api/v1/loans/quote` (anónimo o cliente sin tope; cliente nuevo con tope $3,000 configurable vía tabla `Configuration`, clave `loans.new_client_max_amount`, editable por admin cuando exista panel en Fase 3 — sin código nuevo). Frontend: `CalculatorPage` pública en `/calculadora`, CTA "Lo quiero" → registro si no hay sesión.

**Alcance confirmado con el usuario:** solo cotizador + CTA a registro; onboarding/solicitud/documentos/video/pagaré quedan para próximos cortes de Fase 2.

**Bug encontrado y corregido:** `AuthService.register()` (Task 5, Fase 1) nunca marcaba `customer.isNewCustomer = true` (el default del schema es `false`), así que ningún cliente recién registrado quedaba sujeto al tope de $3,000 de R12. Corregido en el mismo commit. Verificado manualmente: cliente nuevo con monto $10,000 → `400`; cliente existente sin flag → sin tope.

**Verificado 2026-08-14:** `npm test` API 23/23 PASS, `npm run test:e2e` 16/16 PASS (repetido, sigue idempotente), `npm run build`/`lint` API y web OK, `npm test` web 4/4 PASS. Probado end-to-end contra el stack Docker real (`localhost`), no solo unit tests.

**Esquema Prisma para préstamos (2026-08-14, commit `079ba68`):** se agregaron los modelos `Loan` y `LoanSchedule` (sección 6 de la spec), adaptados a las convenciones ya usadas en el schema (BigInt autoincrement en vez de UUID como sugiere la spec, enums UPPERCASE, `DECIMAL(10,2)`). `Loan.model` usa el mismo enum `WEEKLY`/`BIWEEKLY` que ya devuelve `loan-quote.ts`. Migración `20260814211137_loans` aplicada y verificada (`prisma migrate status` OK, build/lint/23 unit/16 e2e en verde, container `api` reconstruido y probado contra el stack real). Nota de la sesión: `prisma generate` puede fallar con `EPERM` en Windows por archivos `.tmp` residuales del query engine si hay procesos node colgados — no bloqueante, se limpia borrando los `.tmp` y el cliente generado en el primer intento suele ser válido igual (verificar con grep en `.prisma/client/index.d.ts` antes de asumir que falló).

**POST /api/v1/loans — "Lo quiero" (2026-08-14, commit `e79fa1d`):** crea el `Loan` en `DRAFT` + su `LoanSchedule`, reusando el mismo `calculateQuote()` server-side (nunca confía en totales que mande el cliente). Lógica extraída a `LoansService` (antes vivía inline en el controller; ahora `quote()` y `create()` comparten `resolveMaxAmount()`). Reglas de negocio confirmadas con el usuario:
- **Un cliente no puede tener dos solicitudes en curso**: si ya tiene un `Loan` con status distinto de `LIQUIDATED`/`CANCELLED`/`REJECTED`, `POST /loans` devuelve `409`.
- **Folio único `ppni-XXXX`** (C1): 4 dígitos aleatorios, reintento en colisión (hasta 10 intentos) capturando el código Prisma `P2002` sobre la columna `folio`.
- Requiere sesión + rol `CLIENT` (`JwtAuthGuard` + `RolesGuard` + `@Roles('CLIENT')`) — a diferencia de `/loans/quote` que sigue siendo público/opcional.
- Frontend: "Lo quiero" ahora llama al endpoint real (antes solo mostraba "próximamente"); guarda folio+status y lo muestra como confirmación en la misma página de la calculadora — sin redirigir, ya que la idea es retomar esos mismos datos cuando exista el onboarding (no construido todavía).

Verificado 2026-08-14: 6/6 e2e nuevos de `loans.e2e-spec.ts` (401 sin token, 403 rol distinto de CLIENT, 400 fecha inválida, 400 tope de cliente nuevo, 201 creación con folio+calendario, 409 duplicado). Suite e2e completa 22/22, corrida dos veces seguidas (idempotente). Probado también contra el stack Docker real: crea borrador `ppni-1326` y bloquea la segunda solicitud con `409`.

**GET /api/v1/loans y /:id — retomar el borrador (2026-08-14, commit `14250ff`):** `findMyLoans()` lista los préstamos del cliente autenticado (con calendario completo); `findOne()` valida propiedad y devuelve `404` (no `403`) si el préstamo no es suyo, para no filtrar existencia de IDs ajenos. Frontend: `CalculatorPage` consulta `GET /loans` al montar — si hay una solicitud sin terminar (status fuera de `LIQUIDATED`/`CANCELLED`/`REJECTED`), muestra esa cotización guardada directamente en vez del formulario vacío, cumpliendo lo que pidió el usuario ("guardalo en el back como temporal... al terminar el onBoarding se muestra esa misma información"). 10/10 tests en `loans.e2e-spec.ts`, 26/26 e2e total, verificado dos veces seguidas. Probado contra el stack Docker real: `GET /loans` devuelve el borrador `ppni-1326` creado antes, `GET /loans/5` idem.

**Onboarding de datos del cliente — PATCH /api/v1/customers/me (2026-08-14, commit `c139b8c`):** módulo `CustomersModule` nuevo. Valida los 10 campos que R14 marca obligatorios (nombres, apellidos, aval + su teléfono, dirección completa por C5, referencias), marca `Customer.onboardingComplete=true` al guardar, audita el cambio. Decisiones confirmadas con el usuario: **formulario único** para V1 (no el wizard multi-paso con Stepper que describe la spec literalmente — queda como posible mejora de UX después, sin tocar el backend) y **entrada desde la calculadora** ("Completar mis datos" cuando hay un borrador guardado), no desde el dashboard. `GET /customers/me` no se construyó — no hacía falta todavía porque `/auth/me` ya devuelve `customer`, y el formulario arranca vacío en el primer llenado.

5/5 e2e nuevos (`customers.e2e-spec.ts`), 31/31 e2e total, verificado dos veces seguidas (idempotente). Nota de sesión: probar acentos con `curl -d` desde Git Bash en Windows los corrompe (bug del terminal — bytes UTF-8 rotos antes de salir del shell, confirmado con `HEX()` en MySQL); el flujo real se verificó con `fetch()` en Node (mismo motor que el navegador), que guardó "García"/"Portón" correctamente. Si se necesita probar acentos por curl en esta máquina de nuevo, usar Node/fetch en vez de `-d` con comillas.

**Documentos + MinIO — INE y comprobante (2026-08-14, commits `3881170` backend + `01f944c` frontend):** modelo `Document` (Prisma) + `StorageModule` (cliente MinIO) + `DocumentsModule` (`POST /api/v1/documents` multipart, `GET /api/v1/documents` lista propia, `GET /api/v1/documents/:id/signed-url`). Validación por magic bytes reales (no el `Content-Type` que declara el cliente) para JPEG/PNG/PDF, tope 5MB, checksum SHA-256 — todo con TDD (8/8 unit en `document-validation.spec.ts`).

**Bug real encontrado y corregido antes de llegar a producción:** el cliente MinIO firmaba las URLs usando el endpoint interno de Docker (`minio`, solo resoluble dentro de la red del compose) — el navegador del cliente final nunca hubiera podido abrir el link de descarga, aunque todos los tests con Supertest (que corren en el mismo proceso/red que la API) lo hubieran dejado pasar sin detectarlo. Se separó un segundo cliente MinIO (`publicClient`) apuntando a `MINIO_PUBLIC_ENDPOINT`/`MINIO_PUBLIC_PORT` (`localhost:9000` en dev) solo para firmar — `presignedGetObject` firma localmente sin conectar de verdad cuando el `region` del cliente ya está seteado, así que el contenedor no necesita poder alcanzar ese endpoint. Verificado descargando el archivo real con `curl -o` a través de la URL firmada: bytes JPEG (`ffd8ff`) intactos.

**Pendiente real, no bloqueante ahora:** `docker-compose.prod.yml` no expone MinIO al host (a propósito, por seguridad) — en producción hace falta un reverse-proxy de Nginx hacia MinIO (o exponer un endpoint público equivalente) antes de que las URLs firmadas funcionen fuera de dev. Documentado en `.env.example`.

Frontend: `DocumentsPage` en `/documentos` (3 slots: INE frente/reverso, comprobante), enlazada desde el éxito de `OnboardingPage` y desde la calculadora. `apiFetch` se ajustó para no forzar `Content-Type: application/json` cuando el body es `FormData`.

Verificado 2026-08-14: 8 unit + 6 e2e nuevos de documents, 37/37 e2e total (corrida dos veces, idempotente), build/lint/test API y web en verde, subida+descarga real probada contra el stack Docker completo (no solo Supertest).

**Pagaré PDF — cierre de la solicitud (2026-08-14/15, commit `4ba586e`):** `POST /api/v1/loans/:id/pagare` genera el PDF (pdfkit: folio, deudor, domicilio, aval, calendario de pagos, firma embebida, timestamp/IP — nunca la tasa, solo totales por R4/C9), lo guarda vía MinIO/`Document` (nuevo `DocumentType.PAGARE`, server-generated, nunca subido crudo por el cliente), y en la misma transacción Prisma pasa `Loan.status` de `DRAFT` a `SUBMITTED`. Decisiones confirmadas con el usuario: la firma cierra la solicitud (coincide con el flujo de la spec: "...pagaré → tu solicitud está siendo procesada") y el único prerequisito es onboarding completo (no se bloquea todavía por documentos ni video, que siguen pendientes de construir). Bloquea re-firma con `409` si el préstamo ya no está en `DRAFT` — evita pagarés duplicados sobre el mismo folio.

Frontend: `PagarePage` en `/pagare` con canvas de firma (pointer events, funciona con mouse y touch), nombre completo, envía la firma como PNG data URL. `CalculatorPage` ahora oculta los botones de completar datos/documentos/pagaré una vez que el préstamo sale de `DRAFT` (muestra "Tu solicitud está siendo procesada" en su lugar).

Verificado 2026-08-15: 5/5 e2e nuevos (`pagare.e2e-spec.ts`), 42/42 e2e total corrido dos veces (idempotente), build/lint/test API y web en verde. Probado contra el stack Docker real con el flujo completo: registro → crear préstamo → completar onboarding → firmar → PDF real descargado vía URL firmada (`%PDF`, 2550 bytes) → `GET /loans/:id` confirma `SUBMITTED`.

**Video de identidad — última pieza de Fase 2 (2026-08-15, commit `51ae570`):** nuevo `DocumentType.VIDEO_IDENTITY`, reutiliza el endpoint genérico `POST /api/v1/documents` (sin ruta nueva). `document-validation.ts` ahora reconoce magic bytes de WEBM (header EBML) y MP4 (átomo `ftyp`), y usa un tope de tamaño **por tipo** (5MB imágenes, 50MB video — antes era un único límite global). El mime declarado por `MediaRecorder` viene con parámetros de códec (`video/webm;codecs=vp9,opus`); se normaliza a la parte base antes de comparar contra el sniff, si no todas las subidas de video hubieran fallado con "no coincide con el tipo declarado".

Decisiones confirmadas con el usuario (evitando repetir los problemas de dependencias nativas de esta sesión — Prisma/EPERM, Avast+Docker, etc.):
- **Duración/resolución se validan solo client-side** (el video se graba en vivo con `getUserMedia`, no es un archivo que el usuario elige del disco) + magic bytes/tamaño server-side. No se agregó `ffmpeg`/`ffprobe` al Dockerfile — el admin revisa manualmente de todos modos (C17b ya lo exige como capa adicional).
- **Detección facial completa con MediaPipe ahora**, no diferida a un corte aparte: `@mediapipe/tasks-vision` corre `FaceDetector` sobre frames durante la grabación (mínimo 3 detecciones positivas antes de aceptar el video). Se importa dinámicamente (`await import(...)`) — quedó en su propio chunk de ~155KB gzip, no infla el bundle principal (verificado en el build de Vite).
- **Frase declarada** (R9) es un texto de consentimiento propuesto por Claude, mostrado en pantalla durante la grabación — no viene de la spec original literal.

**Nota de arquitectura, no bloqueante:** el modelo de MediaPipe (`blaze_face_short_range.tflite`) y el runtime WASM se cargan desde el CDN de Google (`storage.googleapis.com`/`cdn.jsdelivr.net`) en el primer uso — es solo el modelo genérico de detección facial, el video del cliente nunca sale del navegador (cumple "sin enviar el video a servicios externos" de C17b). Si se necesita operar sin dependencia de red externa (ej. red corporativa restringida), habría que self-hostear esos archivos — no se hizo en este corte.

Verificado 2026-08-15: 17/17 unit + 7/7 e2e de documents (incluye subida de video simulado), 43/43 e2e total corrido dos veces (idempotente). Probado contra el stack Docker real: ruta `/video` sirve `200`, subida de video vía multipart funciona end-to-end.

**Probado con cámara real (2026-08-15, commit `096eed7`):** extensión de Chrome se conectó, se usó `claude-in-chrome` para operar el navegador del usuario directamente. Flujo completo con cámara física: preview en vivo, MediaPipe cargó y corrió detección facial real ("Graph successfully started running"), grabación de ~8s, reproducción del preview post-grabación (sí reproduce — el thumbnail inicial en negro antes de tocar play es comportamiento normal de `<video controls>`, no bug), envío del video.

**Bug real encontrado en esa prueba (arreglado, commit `096eed7`):** el envío fallaba con `413 Payload Too Large`. Nginx tiene `client_max_body_size` en 1MB por defecto — mucho menor que el video (hasta 50MB). Ningún test automatizado lo detectó porque Supertest pega directo a la API sin pasar por Nginx; solo apareció al probar el flujo real de punta a punta. Se agregó `client_max_body_size 50m;` al `location /api/` en `nginx.dev.conf` y `nginx.prod.conf` (mismo bug hubiera existido en producción). Confirmado tras el fix: video real de ~3MB (`video/webm`) subido y persistido en MinIO, verificado leyendo `GET /documents` con el token real de la sesión del navegador.

**Nota de proceso:** la extensión de Chrome no estaba conectada al arrancar esta tarea; tras reconectarla, el permiso de cámara del sitio quedó en estado "prompt" y el popup nativo de Chrome (fuera del DOM de la página, no capturable por screenshot ni clickeable por las herramientas de automatización) requirió que el usuario lo aceptara manualmente con un clic — las herramientas de automatización no pueden interactuar con UI nativa del navegador (permisos, `chrome://settings`), solo con el contenido de la página.

**Calendario de pagos + calculadora de penalización en el cotizador (2026-08-14, commit `7119504`):** `CalculatorPage` reemplaza el resumen plano (total/pago/última fecha) por una tabla de calendario de pagos (fecha larga, abono, saldo pendiente calculado por fila), factorizada en `ScheduleSummary` y reutilizada tanto en la vista de resultado recién cotizado como en la de un borrador retomado. Se agregó `PenaltyCalculator`: simulador de multa por atraso ($50 MXN/día, según R3/C6 de la spec), siempre visible al fondo de la tarjeta.

Revisado antes de commitear (build/lint/tsc en verde, sin huérfanos de `formatDate`). Dos puntos quedaron pendientes de ajuste, a pedido del usuario ("ajusto después"):
- El simulador de multa es standalone: el usuario mete "días de atraso" a mano, no lee la mora real del préstamo ni respeta el orden de aplicación de pagos (multas → cuota vencida → cuota vigente, C7). Riesgo: un cliente con atraso real podría leer un monto que no coincide con su deuda real.
- El widget se muestra siempre (con o sin cotización, con o sin sesión) en vez de estar acotado al contexto de un préstamo con atraso real.

**Multa movida a backend real (2026-08-15):** a pedido del usuario ("ajusta el simulador de multa a backend"), se reemplazó el simulador manual por un cálculo real. Alcance confirmado con el usuario vía pregunta explícita: **endpoint calculado en vivo**, no el sistema completo de la spec (tabla `penalty_events` + worker cron + módulo `payments` con orden C7) — eso es Fase 3/4 y se deja fuera a propósito para no reabrir el orden de fases.

- `api/src/loans/loan-penalty.ts`: función pura `calculateLoanPenalty(schedule, today)` — $50/día por cuota no `PAID` con `dueDate` pasada, sin período de gracia el mismo día del vencimiento (el plazo corre hasta las 23:59:59 de ese día, conforme R3/C6), `PARTIAL` sigue acumulando multa plana. 7/7 tests unitarios (TDD, escritos antes que la implementación).
- `todayInMexicoCity()` (antes privada en `loan-quote.ts`) se exportó para reusar el mismo cálculo de "hoy" que ya usa `calculateQuote`.
- `LoansService.getPenalty()` + `GET /api/v1/loans/:id/penalty` (mismo patrón de ownership/404 que `findOne`, `JwtAuthGuard`+`RolesGuard`+`@Roles('CLIENT')`).
- Frontend: `CalculatorPage` quitó el input manual de "días de atraso"; ahora consulta `/loans/:id/penalty` cuando hay un `draft` real y solo muestra la sección si `totalPenalty > 0` (tabla de cuotas vencidas con días de atraso y multa). Ya no aparece nada de multa en la vista de cotización sin `draft` — resuelve también el problema de que el widget se mostrara fuera de contexto.

**Bug encontrado en el primer intento del e2e nuevo:** el test backdateaba fechas con `Date.now() - N*86400000` (instante UTC absoluto) en vez de partir de `todayInMexicoCity()`. Como ya había pasado la medianoche UTC pero no la medianoche de Ciudad de México al momento de correr la prueba, la fecha UTC del test iba un día adelante de la fecha de negocio real, restando 1 día de atraso a cada cuota. Corregido reusando `todayInMexicoCity()` en el test — mismo patrón que ya usa el código de producción para evitar justo este tipo de bug (ver riesgo "Multas mal calculadas por zona horaria" en la spec, sección de riesgos).

Verificado 2026-08-15: `npm test` API 55/55 PASS (48 + 7 nuevos de `loan-penalty.spec.ts`), `npm run test:e2e` 48/48 PASS con `--runInBand` (el script `test:e2e` sin ese flag corre suites en paralelo y compite por crear el admin de `.env` — se detectó al correr esta sesión, no es nuevo, CI ya usa `--runInBand`; no se tocó el script, solo se corrió igual que CI), corrido dos veces seguidas (idempotente). `npm run build`/`lint`/`tsc --noEmit` API y web en verde, `npm test` web 8/8 PASS. Probado contra el stack Docker real: préstamo real con cuotas backdateadas por SQL directo, `GET /loans/:id/penalty` devolvió `{"totalPenalty":250,"overdueInstallments":[{"seq":1,"dueDate":"2026-08-09","daysLate":5,"penalty":250}]}` (5 días × $50, correcto), datos de prueba limpiados después. **No se pudo verificar visualmente en navegador** (extensión de Chrome desconectada esta sesión, mismo problema recurrente ya documentado arriba) — pendiente una pasada visual real de `PenaltySummary` en `/calculadora` cuando se reconecte.

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

**Nota operativa (2026-08-14, misma sesión):** el `worker` se dejó **detenido** (`docker compose stop worker`) a pedido del usuario en vez de reintentando indefinidamente — no se auto-reinicia hasta `docker compose up -d worker` o `start worker`. Recordar levantarlo cuando exista `main-worker.ts` (Fase 2, jobs de multas).

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

**Fase 2 "Cliente" completa**: cotizar → crear borrador → retomarlo → completar datos → subir documentos (INE+comprobante) → video de identidad → firmar pagaré → `SUBMITTED`. Todo el roadmap de Fase 2 de la spec (calculadora/quote, onboarding, documentos, video, pagaré, solicitud+estados) está construido y verificado contra el stack Docker real.

Siguiente: **Fase 3 (Administrador)** — hoy las solicitudes quedan en `SUBMITTED` sin que nadie las revise (no existe panel de admin, ni `GET /admin/loans`, ni aprobar/rechazar/pedir corrección, ni asignar cobradores, ni reglas/multas/score). Es el bloqueo real para que el flujo tenga sentido de negocio completo. Confirmar alcance con el usuario antes de implementar (sin plan escrito task-por-task para Fase 2/3 todavía).

Pendiente no bloqueante: el video de identidad ya se probó visualmente con cámara real (ver arriba). El resto de las pantallas (login, registro, calculadora, onboarding, documentos, pagaré) siguen sin una pasada visual real en navegador — todo verificado por curl/Node fetch/API — recomendable antes de seguir apilando UI, ya que el bug de Nginx (413 en subida de video) demostró que hay problemas que solo aparecen probando el flujo real de punta a punta, no con tests que le pegan directo a la API.
