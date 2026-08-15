# cmem.md — Memoria portable de AppPrestamitos

> Este archivo es un **export de memoria** (no un doc de referencia como `project_state.md`).
> Sirve para que una sesión de Claude Code con el plugin **claude-mem** en otra máquina
> recupere contexto histórico del desarrollo de este proyecto sin depender de la base de
> datos local de claude-mem (que no viaja entre equipos — vive en `~/.claude-mem/`, fuera
> del repo). Léelo como una narrativa cronológica, no como estado actual: para "qué existe
> hoy" y "qué sigue", la fuente de verdad es `project_state.md`. Para reglas fijas del
> proyecto, `CLAUDE.md`. Este archivo no contiene secretos, tokens ni credenciales.

## Cómo usar este archivo

Si sos una sesión de Claude Code (con o sin claude-mem) arrancando en este repo por
primera vez en una máquina nueva: leé este archivo para entender *cómo* se llegó al
estado actual, después leé `project_state.md` para el estado vivo y `CLAUDE.md` para las
reglas operativas. Si tenés claude-mem activo y una base de memoria vacía en esta máquina,
este archivo actúa como semilla de contexto — no hace falta reconstruir el razonamiento
de cada decisión desde cero.

## Resumen ejecutivo

Plataforma web de préstamos (cliente / cobrador / administrador), Modular Monolith:
`api/` (NestJS 10 + Prisma + MySQL 8) + `web/` (React 18 + Vite + Tailwind, PWA) + MinIO
+ Nginx. Desarrollo bajo protocolo `addv-web-app`: cada corte de funcionalidad se
analiza, propone, confirma con el usuario y recién ahí se implementa — sin asumir
requisitos de negocio ambiguos. TDD estricto: función de negocio pura primero (con
`.spec.ts`), después el `Service`/`Controller` que la envuelve.

## Fase 1 — Fundaciones (completa)

10 tasks secuenciales: scaffolding del repo, Docker Compose dev/prod, bootstrap NestJS
(health, exception filter, validation pipe global), esquema Prisma núcleo (`User`,
`Customer`, `Collector`, `Admin`, `AuditLog`, `Configuration`), autenticación completa
(JWT access 15min + refresh rotativo, Argon2id, `IsPhoneOrAdmin` validator custom para
que el admin de `.env` no rompa el regex de teléfono de 10 dígitos), bootstrap de admin
inicial (`must_change_password=true` forzado), scaffold frontend (Vite+React 18+Tailwind,
bajado explícitamente desde el template que trae React 19 por defecto), pantallas de auth,
CI/CD (GitHub Actions con MySQL de servicio, `migrate deploy` no `migrate dev` para evitar
shadow DB), y verificación final contra el stack Docker real — que encontró 4 bugs de
infraestructura que ningún test unitario detecta (`.dockerignore` sin excluir
`node_modules`, certificado TLS de Avast rompiendo `npm ci` en el contenedor, bind mount
tapando `node_modules` Linux con el de Windows del host, falta `prisma generate` en el
Dockerfile).

## Fase 2 — Cliente (completa)

Construida corte por corte, cada uno confirmado con el usuario antes de implementar:

1. **Calculadora/quote** (`POST /loans/quote`): motor financiero puro en
   `loan-quote.ts` — semanal (20 pagos, total/20) y quincenal (10 pagos, día 15/último
   día del mes, total/10), interés 40% plano nunca expuesto al cliente (R4), redondeo con
   el último pago absorbiendo el residuo. Tope de $3,000 para cliente nuevo, configurable.
2. **Crear/retomar borrador** (`POST/GET /loans`): folio `ppni-XXXX` único con reintento
   de colisión, un cliente no puede tener dos solicitudes en curso.
3. **Onboarding** (`PATCH /customers/me`): formulario único (no el wizard multi-paso
   literal de la spec — decisión confirmada, mejora de UX diferida).
4. **Documentos + MinIO**: INE frente/reverso + comprobante, validación por magic bytes
   reales (no el `Content-Type` declarado), checksum SHA-256. Bug real encontrado:
   las URLs firmadas usaban el endpoint interno de Docker (`minio`, inalcanzable desde el
   navegador del cliente) — se separó un `publicClient` para firmar apuntando al endpoint
   público.
5. **Pagaré PDF**: `pdfkit` genera el PDF server-side (nunca la tasa, solo totales),
   firma la solicitud (`DRAFT` → `SUBMITTED`), documento tipo `PAGARE` nunca subido crudo
   por el cliente.
6. **Video de identidad**: `MediaPipe FaceDetector` corre client-side sobre los frames
   durante la grabación (mínimo 3 detecciones positivas), validación de tamaño/formato
   por tipo (5MB imágenes, 50MB video) vía magic bytes (WEBM/MP4) server-side. Probado
   con cámara real vía `claude-in-chrome`. Bug real encontrado en esa prueba: Nginx
   rechazaba el upload con `413` porque `client_max_body_size` estaba en el default de
   1MB — invisible a Supertest porque pega directo a la API sin pasar por Nginx.

Push inicial a GitHub al cierre de Fase 2.

## Multa: de simulador de UI a cálculo real en backend

Se detectó en revisión de código que `CalculatorPage` tenía un simulador de multa
puramente client-side (usuario tecleaba "días de atraso" a mano). Se decidió moverlo a
backend, pero **acotado**: cálculo en vivo (`loan-penalty.ts`, $50/día por cuota vencida
no pagada, sin período de gracia el mismo día del vencimiento — R3/C6 de la spec), sin
construir todavía la tabla `penalty_events` ni el worker cron completo que describe la
spec (eso se dejó explícitamente fuera de alcance). Bug real en el primer intento del
test e2e: se backdateaban fechas con `Date.now()` (instante UTC absoluto) en vez de
`todayInMexicoCity()`, y como ya había pasado la medianoche UTC pero no la de Ciudad de
México, cada cuota mostraba un día menos de atraso — corregido reusando la misma función
que ya usa producción para "hoy".

## Fase 3 — Administrador (roadmap explícito cubierto, pausada a propósito)

Cada corte confirmado con el usuario por separado, siguiendo el mismo patrón que Fase 2:

1. **Revisión de solicitudes**: `GET/POST /admin/loans` — aprobar (`APPROVED`, no salta
   directo a `ACTIVE`; eso espera el primer pago), rechazar y pedir corrección (motivo
   obligatorio, guardado en el nuevo campo `Loan.adminNote`, visible al cliente). Solo
   transiciona desde `SUBMITTED` (409 en cualquier otro estado). Se relajó el guard de
   `signPagare` para aceptar re-firma desde `REQUIRES_CORRECTION`, no solo `DRAFT`.
2. **Cobradores**: CRUD (`POST/GET /admin/collectors`, contraseña temporal generada
   server-side y devuelta una sola vez) + asignación a préstamos `APPROVED`/`ACTIVE`
   (`Loan.collectorId`, sin tabla de historial de asignaciones — un cobrador activo a la
   vez alcanza para este corte).
3. **Payments**: registrar pagos reales, aplicando el orden C7 de la spec (multa
   pendiente → cuota vencida más antigua → cuota vigente, por `seq` ascendente).
   Decisión de arquitectura necesaria: como la multa es "en vivo sin tabla", se agregó un
   acumulador `Loan.penaltyPaid` para poder "restar" lo ya pagado de multa sin construir
   el sistema completo de `penalty_events`. Sobrepago se **rechaza** con 400 (decisión
   confirmada — no se inventó concepto de saldo a favor). Idempotencia real vía
   `idempotencyKey` único: reenvíos devuelven el mismo resultado sin reaplicar. Primer
   pago activa el préstamo (`APPROVED`→`ACTIVE`); pago que cubre todo lo pendiente
   liquida (`LIQUIDATED`).
4. **Score** (verde/amarillo/naranja/rojo): mismo criterio que la multa — cálculo en vivo
   (`score-calculation.ts`), sin `score_rules` configurable todavía. Umbrales fijos
   confirmados con el usuario porque la spec los deja abiertos: 0 días de atraso=`GREEN`,
   1–7=`YELLOW`, 8–15=`ORANGE`, 16+=`RED` (máximo entre los préstamos `APPROVED`/`ACTIVE`
   del cliente). Sin ajuste manual del admin en este corte (la spec lo pide auditado) —
   dejado fuera a propósito.
5. **Gestión de clientes**: `GET /admin/customers` (lista con score), `GET
   /admin/customers/:phone` (detalle + préstamos + documentos), `PATCH
   /admin/customers/:phone/new-client` — reusa `Customer.isNewCustomer`, que ya existía y
   que `resolveMaxAmount()` ya consultaba; sin campo nuevo en el schema.

Con estos cinco cortes, el roadmap explícito de Fase 3 de la spec ("Administrador:
clientes, préstamos, cobradores, aprobaciones, correcciones, reglas, multas, score")
quedó cubierto salvo **reglas configurables** (`score_rules`/`business_rules` — en ese
momento `PENALTY_PER_DAY=$50` y los umbrales de score seguían hardcodeados). El usuario
decidió pausar Fase 3 ahí explícitamente en esa sesión — no era que faltara terminarlo,
fue una decisión tomada. Se retomó y se cerró del todo en la sesión siguiente (ver abajo).

## Fase 3 — cierre: reglas configurables + ajuste manual de score (2026-08-15)

Sexto y séptimo corte, en una sesión posterior a las cinco anteriores. El usuario retomó
explícitamente los dos puntos que había dejado pendientes.

**Sexto corte — `business_rules`/`score_rules` configurables**: `penalty.per_day`,
`score.yellow_max_days`, `score.orange_max_days` dejaron de estar hardcodeados. La tabla
`Configuration` (`key`/`value` JSON) ya existía desde Fase 1 pero solo tenía lectura
(`ConfigurationService.getNumber`) — se agregó `set()` y un `BusinessRulesService`
(`@Global()`, en `configuration/`) que centraliza las 3 claves en un solo `get()`/`set()`
con validación cruzada (`yellowMaxDays < orangeMaxDays`). Breaking change deliberado: las
funciones puras `calculateLoanPenalty`/`calculateScoreLevel` pasaron a recibir esos
valores como parámetro explícito en vez de leer una constante de módulo — TDD, specs
actualizados primero. `GET/PUT /admin/configuration/business-rules` + pantalla
`AdminConfigurationPage`. Decisiones confirmadas con el usuario vía preguntas explícitas:
multa **y** score configurables juntos (no solo uno), backend+UI en el mismo corte,
cambios en vivo y retroactivos a todo préstamo activo.

**Séptimo corte — ajuste manual de score, auditado**: la spec pedía aparte de
`score_rules` que el admin pudiera forzar el score de un cliente puntual. No era obvio
cómo convivía con que el score fuera 100% calculado en vivo (sin tabla `scores`) — se
confirmó con el usuario que el override es **permanente** (`Customer.scoreOverride`,
nuevo enum `ScoreLevel` en Prisma) hasta que el admin lo limpia explícitamente
(`level: null`), nunca se pierde solo porque el cliente pague o se atrase más. Todas las
respuestas de score exponen `isManualOverride`/`isManualScoreOverride` para
transparencia. `PATCH /admin/scores/:phone`, auditado (`score_manually_adjusted`).

Con esto Fase 3 quedó **100% completa (7 cortes)**, cubriendo el roadmap explícito
completo de la spec.

## Fase 4 — Cobrador (arrancada 2026-08-15, en curso)

**Primer corte — cartera del cobrador**: hasta este punto el rol `COLLECTOR` solo tenía
un dashboard placeholder sin pantalla real, aunque el backend de pagos ya soportaba
`COLLECTOR` con ownership desde el corte de `payments` de Fase 3. Se armó
`api/src/collector/` (`GET /collector/loans`, `GET /collector/loans/:id`) **sin lógica de
negocio nueva** — reusa `toAdminLoanResult`/`ADMIN_LOAN_INCLUDE`/`AdminLoanResult` que ya
existían en `admin/admin-loans.service.ts` (se exportaron para esto). El registro de pago
tampoco necesitó endpoint nuevo: el cobrador ya podía `POST /loans/:id/payments` desde
Fase 3, solo faltaba la UI (`CollectorLoansPage`, `/collector/cartera`) para llegar ahí.
Bug real encontrado (en el test, no en producción): `idempotencyKey` de texto libre en
vez de UUID — `RegisterPaymentDto` ya validaba `@IsUUID()`, la API respondía `400`
correctamente.

**Segundo corte — llamar/WhatsApp**: el más chico de los tres pendientes de Fase 4
(ubicación, llamar/WhatsApp, documentos de campo), elegido por eso mismo. Sin backend
nuevo — dos enlaces (`tel:+52{phone}`, `https://wa.me/52{phone}`) en `CollectorLoansPage`
usando el teléfono que ya devolvía `GET /collector/loans`. Acotado a la cartera del
cobrador; la spec también lo lista para cliente (soporte) y admin, pero eso quedó fuera
de este corte a propósito.

**Tercer corte — documentos de campo**: la spec ya anticipaba este tipo de documento en
el modelo de datos original (`documents(... type ENUM(..., collector_doc, other) ...)`),
solo faltaba habilitarlo. Nuevo `DocumentType.COLLECTOR_DOC` (imagen, 5MB, TDD). El
cambio real de fondo fue en `DocumentsService`: `persist()` asumía que
`customerPhone === uploadedBy` siempre (cierto mientras solo el cliente subía sus propios
documentos) — se separaron ambos campos explícitamente para soportar que el cobrador suba
en nombre del cliente. Nuevo `POST/GET /collector/loans/:id/documents`, mismo patrón de
ownership 404 que ya usaba `payments`. Admin ve estos documentos gratis en
`GET /admin/customers/:phone` (ya devolvía todos los documentos del cliente sin filtrar
por tipo) — cero cambios ahí. Frontend: input de archivo con `capture="environment"` para
abrir la cámara directo en mobile.

**Cuarto corte — ubicación (backend + captura consentida)**: el más grande de los cuatro
por tocar privacidad legal (C15/LFPDPPP), no solo código. Antes de implementar se
confirmaron con el usuario 3 decisiones explícitas vía preguntas puntuales:
1. **Aviso propio antes del prompt nativo del navegador** — el diálogo "compartir
   ubicación?" del browser no explica el propósito, así que se agregó un banner in-app
   (`LocationConsentBanner`) que sí lo hace, con la decisión guardada en `localStorage`
   para no volver a preguntar.
2. **Triggers solo login + solicitud** — la spec lista 3 (`onboarding`... en realidad
   login/payment/request), pero "payment" no tiene sentido del lado cliente porque el
   cliente nunca registra sus propios pagos (eso es cobrador/admin desde Fase 3). El
   enum `source` se implementó completo igual, por si se conecta más adelante.
3. **Solo backend + captura este corte** — el mapa admin (Leaflet+OSM, primera
   dependencia de mapas del proyecto) y la vista de ubicación en la cartera del cobrador
   quedaron para cortes aparte, sin confirmar todavía.

Con esto, las 4 sub-features del roadmap de Fase 4 quedaron completas (cartera, pagos,
llamar/WhatsApp, documentos de campo, ubicación backend+captura). Fase 4 no está "cerrada
del todo" en el sentido de Fase 3 — el mapa admin y la vista de ubicación del cobrador
siguen pendientes, son extensiones naturales una vez que exista ubicación real capturada
para probarlas útilmente.

## Patrones y convenciones que se repitieron (documentados en CLAUDE.md)

- **Función pura + Service wrapper**: lógica financiera (`loan-quote.ts`,
  `loan-penalty.ts`, `payment-application.ts`, `score-calculation.ts`) vive sin
  dependencias de Nest/Prisma, cada una con su `.spec.ts` TDD (escrito y verificado en
  rojo antes de implementar). El `Service` correspondiente solo la envuelve con acceso a
  BD/auditoría.
- **RBAC por ownership, no solo por rol**: `RolesGuard` valida el rol, pero el `Service`
  siempre valida además que el recurso pertenece al actor (cliente ve solo lo propio,
  cobrador solo lo asignado) — 404 en vez de 403 para no filtrar existencia de IDs ajenos.
- **`npm run test:e2e` sin flags corre en paralelo** y choca por el bootstrap del admin
  compartiendo BD — usar siempre `--runInBand` localmente (CI ya lo hace).
- **Cada corte se prueba contra el stack Docker real**, no solo Supertest — varios bugs
  reales (413 de Nginx, URLs firmadas con endpoint interno de MinIO) solo aparecieron ahí.
  Nota práctica: el contenedor `api` en dev usa un volumen anónimo para `node_modules`
  que **no** se regenera solo al cambiar `schema.prisma` — hace falta
  `docker compose exec api npx prisma generate` + `restart` después de una migración,
  si no el build dentro del contenedor falla con tipos de Prisma desactualizados.
- **Reglas de negocio configurables** viven en `Configuration` (key/value JSON) vía
  `BusinessRulesService` (`@Global()`), que centraliza todas las claves conocidas en un
  solo `get()`/`set()` con validación cruzada. Las funciones puras las reciben como
  parámetro explícito, nunca las leen de una constante de módulo.
- **Overrides manuales auditados son permanentes** hasta que se limpian explícitamente
  (no se pierden solo por un evento real) — patrón confirmado con el usuario para el
  ajuste manual de score, aplica a cualquier override similar futuro.
- **Los `Service` de `admin/` exportan sus helpers de mapeo Prisma→DTO** (tipos +
  funciones) para que módulos con la misma forma de datos pero distinto scope de
  ownership (ej. `collector/` filtrando por `collectorId` en vez de ver todo) los reusen
  en vez de duplicar el mapeo.
- **`project_state.md`, `cmem.md` y `CLAUDE.md` se actualizan los tres antes de cada
  commit+push**, no solo al cerrar fase — regla explícita del usuario (2026-08-15). Es la
  única vía por la que el contexto viaja entre máquinas/sesiones.
- **Captura opcional del lado cliente nunca bloquea el flujo principal**: `captureLocation()`
  falla en silencio (sin alertar al usuario) si el navegador no soporta geolocalización, el
  permiso fue denegado, o el request falla — el login/la solicitud de préstamo tienen que
  funcionar igual aunque la ubicación no se capture. Mismo criterio para cualquier feature
  "opcional, mejora la experiencia pero no es requisito".
- **Actor vs. dueño del recurso son campos separados, no asumir que son el mismo**: el
  schema de `documents` ya tenía `customerPhone` y `uploadedBy` como columnas distintas
  desde Fase 1, pero el código los colapsaba en un solo parámetro hasta que hizo falta que
  alguien subiera algo a nombre de otro (cobrador→cliente). Repasar este tipo de columnas
  "de más" en el schema antes de asumir que un campo nuevo hace falta — a veces ya existe,
  solo no estaba conectado.

## Estado de la extensión de Chrome

Recurrente en esta sesión y sesiones anteriores: la extensión `claude-in-chrome` aparece
desconectada al arrancar tareas nuevas y requiere reconexión manual del usuario. Varias
pantallas (incluyendo `AdminLoansPage` completa) siguen sin una pasada visual real en
navegador — todo verificado por curl/Node fetch contra la API real, pero no confirmado
visualmente.

## Sincronización entre equipos/máquinas (2026-08-15)

Pregunta del usuario: cómo hacer que otro equipo lea el contexto de Claude Code de este
proyecto. Aclarado: **no existe sync automático de sesión** entre máquinas — la memoria
de conversación de Claude Code vive local, fuera del repo. Lo único que viaja entre
equipos es lo que está en git:

- `CLAUDE.md` — reglas operativas, carga automática al abrir sesión en el repo.
- `project_state.md` — estado vivo (qué existe hoy, qué sigue).
- `cmem.md` (este archivo) — narrativa histórica portable.

Flujo para un equipo nuevo en otra máquina: `git pull` → abrir Claude Code en el repo
(`CLAUDE.md` carga solo) → pedir que lea `cmem.md` para contexto histórico. Sin
infraestructura cloud de por medio — es intencional, decisión previa del usuario
("user chose markdown export instead" de sync en la nube).

Se evaluó además `claude-mem:cloud-sync` (plugin claude-mem, sync a cmem.ai Pro) para
sincronizar memoria de observaciones entre las propias máquinas del usuario — no es
sync compartido de equipo, cada persona necesitaría su propia cuenta cmem.ai. Estado al
cierre de esta sesión: **no configurado** (`configured: false` en `/api/sync/status`).
Requiere token + user id + Hub URL desde cmem.ai → Connect; el usuario no llegó a
proveerlos en esta sesión. Nota de privacidad importante si se retoma: cloud sync sube
narrativas de observaciones y texto completo de prompts a la cuenta cmem.ai del usuario.
