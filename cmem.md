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

**Quinto corte — vista de ubicación en la cartera del cobrador**: el más chico de los dos
pendientes tras el corte anterior. `GET /collector/loans/:id/location`, mismo patrón de
ownership 404 que documentos/pagos. Bug real en el primer intento del e2e: NestJS no
serializa `return null` de un controller como JSON `null` — manda `200` con body vacío,
y `res.json()` del lado cliente explota parseando string vacío. Se corrigió envolviendo
siempre en un objeto (`{ location: T | null }`) — patrón a repetir en cualquier endpoint
que pueda "no tener nada que devolver": nunca `null`/`undefined` en la raíz de una
respuesta REST.

**Sexto corte — mapa admin, cierra Fase 4 del todo**: `GET /admin/locations` (última
ubicación por cliente, dedupe en memoria — a esta escala no hace falta más) + primer uso
de `leaflet` en el proyecto (npm, MIT, sin API key, tiles OpenStreetMap). Cargado con
`import()` dinámico igual que `@mediapipe/tasks-vision` en el video de identidad, para
que su bundle no infle el chunk principal — verificado que quedó en su propio chunk
separado tras el build. `LocationsController` pasó de ruta fija (`/locations`) a
`@Controller('api/v1')` con rutas explícitas por método (mismo patrón que
`ScoreController`) para meter `POST /locations` (cliente) y `GET /admin/locations`
(admin) en un solo controller.

Con esto, Fase 4 quedó 100% completa (6 cortes): cartera, pagos, llamar/WhatsApp,
documentos de campo, ubicación (captura + vista del cobrador), mapa admin. Cierra el
roadmap explícito de Fase 4 de la spec del todo.

## Fase 5 — BI, primer corte: KPIs núcleo financiero (2026-08-15)

La spec de Fase 5 lista un set grande (capital, préstamos por estado, morosidad, multas,
clientes, por cobrador, gráficas de tendencia, mapa de distribución). Alcance de este
primer corte confirmado con el usuario: solo núcleo financiero, solo tiles de números
(sin Recharts todavía, sin desglose por cobrador ni segmentación de clientes).

`BiService.getFinancialKpis()` reusa piezas ya construidas en vez de reinventar: la
misma `calculateLoanPenalty` de multa/score para "cartera vencida" y "multas
acumuladas" (mismas `BusinessRulesService`), agregados SQL simples (`aggregate`,
`groupBy`) para lo demás — sin librería BI pesada, como pedía la spec explícitamente.
Se omitió deliberadamente "préstamos nuevos" del set de KPIs porque la spec no define
una ventana de tiempo (¿diario? ¿semanal?) — documentado como pendiente en vez de
inventar un valor arbitrario, mismo criterio de "no asumir" del resto del proyecto.

`GET /api/v1/admin/bi/kpis` (`@Roles('ADMIN')`), `AdminBiPage` en `/admin/indicadores`.
Testeado con un enfoque de deltas (antes/después de crear un préstamo con cuota
backdateada) en vez de igualdad absoluta, porque el endpoint agrega sobre TODA la BD —
más robusto frente a datos residuales de otros tests o de uso manual previo.

**Segundo corte — segmentación de clientes**: agregado al mismo `GET /admin/bi/kpis`
(spec agrupa clientes bajo la misma sección de KPIs, sin ruta aparte) — `totalClientes`,
`clientesActivos`, `clientesNuevos` (reusa `Customer.isNewCustomer`), `clientesRecurrentes`
(>1 préstamo), `porScore` (reusa `ScoreService.getAll()`). Bug real en el e2e (no en
producción): el test asumía un cliente "nuevo en la BD" que en realidad ya lo había
registrado un test anterior del mismo archivo — el delta de `totalClientes`/
`clientesNuevos` no cuadraba porque ya estaba contado en el snapshot "antes". Refuerza
el patrón de deltas ya documentado: hay que rastrear bien qué fixture es realmente nuevo
en cada punto del archivo, no solo comparar antes/después a ciegas.

**Tercer corte — desglose por cobrador**: a diferencia de la segmentación de clientes, la
spec sí lista `GET /admin/bi/collectors` como ruta propia en la tabla de endpoints —
implementado como endpoint aparte, no anidado en `/kpis`. `cumplimientoPct` reusa
`calculateLoanPenalty` por cobrador (% de su cartera sin cuotas vencidas), `pagosRegistrados`
usa `groupBy` sobre `Payment.createdBy` para evitar N+1 en vez de contar por cobrador uno
por uno.

**Cuarto corte — gráfica de tendencia**: la spec solo decía "tendencia temporal" sin
métrica ni ventana — se confirmaron ambas con el usuario (capital cobrado por semana,
últimas 12 semanas) antes de tocar código. `getWeeklyTrends()` agrupa pagos en semanas
lunes-domingo (hora CDMX), siempre 12 puntos aunque falten pagos en alguna semana.
Primer uso de **Recharts** en el proyecto — mismo patrón de lazy-loading que
Leaflet/MediaPipe: el gráfico vive en su propio componente (`WeeklyTrendChart.tsx`),
cargado con `React.lazy()`+`Suspense` en vez de `import()` imperativo (porque Recharts
se usa como JSX, no como API imperativa como Leaflet). Bug de tipos de Recharts 3.x en
el build (no runtime): los callbacks de `<Tooltip>` tipan sus parámetros más laxo que
antes, se corrigió coaccionando explícitamente en vez de tipar los parámetros directo.

**Nota operativa**: Docker Desktop se cayó a mitad de un `docker compose up` durante este
corte (pull de imagen interrumpido) — el usuario lo reinició manualmente, el volumen de
MySQL persistió sin pérdida de datos/schema. El contenedor `worker` arrancó solo al no
especificar servicio en el `up` y se volvió a detener (mismo comportamiento documentado
desde Fase 1 — `main-worker.ts` no existe todavía, no es un bug nuevo).

**Quinto corte — distribución por zona, cierra Fase 5 del todo**: mismo patrón que el
corte de tendencia — la spec no definía qué es "zona" ni dónde mostrarla, se confirmó con
el usuario antes de tocar código: agrupar por `Customer.ciudad`/`colonia` (dirección de
onboarding ya existente, sin depender de que el cliente comparta ubicación GPS opcional),
tabla en `AdminBiPage` en vez de sobre el mapa Leaflet. Reusa `ScoreService.getAll()`
igual que la segmentación de clientes.

Con esto, Fase 5 quedó **100% completa (5 cortes)**: KPIs financieros, segmentación de
clientes, desglose por cobrador, tendencia semanal (Recharts) y distribución por zona.
Roadmap explícito de la spec (`BI: KPIs y dashboards`) cerrado del todo. Patrón que se
repitió en toda Fase 5: cada vez que la spec dejaba una métrica sin definir del todo
(ventana de tiempo, granularidad, dónde mostrarla), preguntar antes de asumir — nunca se
inventó un valor arbitrario.

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

## Fase 6 — PWA, primer corte: instalación + caching (2026-08-15)

Roadmap de Fase 6 tiene cuatro puntos (instalación, push, caching, onboarding guiado);
confirmado con el usuario que instalación+caching es el más chico, se hace primero. El
scaffold de `vite-plugin-pwa` ya existía desde Fase 1 (Task 7) pero solo precacheaba el
shell — sin `workbox.runtimeCaching` ni soporte explícito iOS.

- `web/index.html`: meta tags `apple-mobile-web-app-*` + `apple-touch-icon` (Safari
  ignora el manifest para standalone, necesita sus propios tags), `viewport-fit=cover`.
- `web/public/manifest.webmanifest`: campos que faltaban (`id`, `scope`,
  `orientation`, `categories`). Íconos se dejaron sin `purpose: maskable` porque no se
  generaron variantes con zona de seguridad — declararlo hubiera sido falso.
- `web/vite.config.ts`: `NetworkFirst` acotado a GET de `/api/v1/**` excluyendo
  `/api/v1/auth/**` (tokens nunca en disco), TTL 5 min, `networkTimeoutSeconds: 5`.
  `navigateFallback: '/index.html'` con `/api/` en la denylist para que las rutas de
  React Router sigan cargando el shell sin conexión. Verificado en el `dist/sw.js`
  compilado, no solo en la config fuente.

Verificado: build/lint/tsc web en verde, `npm test` web 8/8 PASS (sin tests nuevos, es
config de build). `vite preview` real: manifest y `sw.js` sirven con `Content-Type`
correcto. No verificado instalando en dispositivo real (extensión Chrome desconectada).

Pendiente de Fase 6: Web Push (VAPID — el corte más grande, requiere modelo
`Notification` + endpoints + service worker con push handler), onboarding guiado.

## Fase 6 — PWA, segundo corte: onboarding guiado (2026-08-17)

El usuario pidió explícitamente "onboarding guiado primero, push después". Spec solo
listaba la palabra sin definir tipo — se confirmó con el usuario vía preguntas: **tour
de producto** (no checklist de pasos pendientes) y **solo rol cliente** (cobrador/admin
quedan fuera).

Al revisar el dashboard del cliente (`DashboardShell`) para diseñar el tour, se vio que
es una sola pantalla casi vacía (un botón) — spotlight/tooltips sobre elementos no tenía
mucho que resaltar ahí. El flujo real a explicar cruza varias rutas (calculadora→
onboarding→documentos→video→pagaré), así que se optó por un **modal-carrusel de 4
slides** (`WelcomeTour.tsx`) en vez de spotlight sobre la UI — mismo concepto de "tour"
pero adaptado a que el contenido a explicar no vive en una sola pantalla.

Persistencia con el mismo patrón ya usado por `LocationConsentBanner` (Fase 4):
`localStorage` con una clave dedicada (`web/src/lib/tour.ts`), sin backend ni
dependencia nueva, "Omitir" siempre visible. 4/4 tests nuevos, 12/12 web total.

Con esto, Fase 6 queda con **solo Web Push pendiente** para cerrarse del todo.

## Fase 6 — PWA, tercer corte: Web Push, cierra la fase (2026-08-17)

Al analizar el corte se encontró que **nada de notificaciones existía en el proyecto**
(ni modelo, ni módulo, ni email conectado a ningún evento) pese a que C14 de la spec ya
anticipaba "Email + in-app como canal primario desde el inicio". El roadmap de Fase 6
solo pedía Web Push explícitamente — se confirmó con el usuario vía preguntas
explícitas construir el **sistema completo** (modelo `Notification` + lista in-app con
badge/leído + Web Push), no solo el mecanismo VAPID, porque sin in-app el push no tiene
dónde registrar qué se envió ni badge real. Email quedó fuera a propósito (ya existe
`EmailService` con Nodemailer/Gmail desde Fase 1, pero no está conectado a ningún evento
de negocio — conectarlo es trabajo aparte). Triggers confirmados: solicitud
aprobada/rechazada/corrección, pago registrado, nueva asignación a cobrador. Roles:
cliente y cobrador (coincide con C14).

**Decisión de esquema deliberada, distinta de la spec literal**: la spec ponía
`channel`/`status` como enums en la misma fila de `notifications` (pensando en in-app/
email/push como entradas separadas). Se simplificó a una sola fila in-app por evento
(fuente de verdad para lista/badge/leído) con el push como intento best-effort sobre esa
misma notificación — evita inventar semántica de "estado por canal" que el resto del
proyecto no usa en ningún otro lado, mismo criterio de "adaptar la spec a las
convenciones ya usadas" que ya se aplicó en Fase 1 con `Loan`/`LoanSchedule` (BigInt en
vez de UUID, enums uppercase).

**Cambio de arquitectura PWA real**: `vite-plugin-pwa` pasó de `generateSW` a
`injectManifest` — `generateSW` no permite agregar listeners `push`/`notificationclick`
personalizados, así que hubo que escribir el service worker a mano
(`web/src/sw.ts`) usando los paquetes `workbox-*` directamente, reimplementando el mismo
runtime caching y `navigateFallback` del primer corte de Fase 6 (mismo comportamiento,
ahora explícito en código en vez de config declarativa). Problema de tipos encontrado:
`ServiceWorkerGlobalScope` (lib `webworker`) choca con el lib `DOM` que usa el resto del
frontend — no se armó un tsconfig aparte para un solo archivo, se excluyó `src/sw.ts`
del `tsc -b` de la app (trade-off aceptado, esbuild igual lo bundlea sin ese type-check).

**Bug real en el primer intento del e2e** (no producción): `idempotencyKey` de texto
libre en vez de UUID en el test de "pago registrado" — mismo bug ya documentado en el
primer corte de Fase 4 (Cobrador), volvió a aparecer por no revisar el DTO antes de
escribir el fixture. Otro bug del primer intento: `class-validator` con `@ValidateNested()`
solo, sin `@IsDefined()`, deja pasar un `keys` completamente ausente en el body (no lo
marca inválido), causando un `500` en vez de `400` cuando faltaba el objeto anidado —
hubo que agregar `@IsDefined()` explícito antes de `@ValidateNested()`.

10/10 tests e2e nuevos, 153/153 e2e total (dos corridas seguidas, idempotente), 20/20
tests web (8 nuevos: `NotificationsBell`, `PushConsentBanner`). Probado contra el stack
Docker real: rebuild del contenedor `api` necesitó el mismo gotcha ya documentado del
volumen anónimo de `node_modules` (`npm install` manual + `prisma generate` dentro del
contenedor), suscripción y notificación probadas de punta a punta vía Nginx con un
usuario real, fila verificada en MySQL directo, `sw.js` servido por Nginx confirmado con
el listener `push` embebido.

**Hallazgo aparte, arreglado en commit separado**: al correr `npm test` de la API salió a
la luz un test pre-existente y no relacionado (`loan-quote.spec.ts`, caso quincenal) con
una fecha hardcodeada (`2026-08-15`) que ya había pasado respecto a la fecha real de esta
sesión (2026-08-17) — test rot por fecha fija, no un bug de este corte. A pedido del
usuario se arregló aparte: se movió `openingDate` un mes exacto (`2026-09-15`) y se
recalcularon a mano las 10 fechas esperadas del calendario (el algoritmo de
`calculateQuote` para el modelo quincenal es periódico por mes calendario — desplazar el
ancla un mes desplaza toda la secuencia el mismo mes, verificado entrada por entrada
antes de escribir el nuevo valor esperado, no solo "ajustado hasta que pasara").

Con esto, **Fase 6 queda 100% completa (3 cortes)**: instalación + caching, onboarding
guiado, Web Push.

## Fase 7 — Seguridad y QA, primer corte: refresh token a cookie HttpOnly (2026-08-17)

Fase 7 ("seguridad y QA completo") es grande y sin plan escrito. Antes de proponer nada
se auditó el estado actual contra la sección 9 de la spec: la mayoría ya estaba cubierto
desde fases anteriores (bloqueo por fuerza bruta, URLs firmadas de 5 min, RBAC+ownership
404, `helmet()`, Argon2id). Se encontraron dos brechas reales: el refresh token viajaba
en el body JSON del login y el frontend lo guardaba en `localStorage` (robable por XSS —
la spec pide cookie `HttpOnly+Secure+SameSite`), y la CSP de `helmet()` nunca se revisó
ni ajustó. El usuario confirmó arrancar por el refresh token (mayor impacto real de
seguridad, aunque el cambio más invasivo de los cuatro candidatos presentados).

**Cambio**: `cookie-parser` en `main.ts`; `AuthController` separa `refreshToken` del
resto del body con destructuring antes de responder — nunca llega al JSON, solo vía
`res.cookie()` (`httpOnly`, `sameSite: strict`, `secure` solo en producción, `path`
acotado a `/api/v1/auth` para no viajar en cada request). Frontend: `credentials:
'include'` en todos los fetch, se borró todo el manejo manual de `refreshToken` en
`localStorage`.

**Bug real en el primer intento del e2e**: los tests de Nest arman el `TestingModule`
directo (`Test.createTestingModule({imports:[AppModule]}).compile()`), sin pasar nunca
por `main.ts`'s `bootstrap()` — `cookie-parser` nunca se registraba ahí, así que
`req.cookies` quedaba `undefined` y `/auth/refresh` fallaba `401` en silencio. Dos tests
viejos "pasaban" igual porque esperaban justo `401`, sin que nadie notara que era por la
razón equivocada — el bug solo se hizo visible al escribir un test que esperaba `200`
real. Lección para cortes futuros: cualquier middleware de Express agregado en `main.ts`
hay que replicarlo a mano en el `beforeAll` de los e2e que lo necesiten, no se hereda solo.

12/12 tests de auth (1 nuevo), 154/154 e2e total (dos corridas, idempotente), 66/66 unit,
20/20 web. Probado contra el stack Docker real vía Nginx con `curl`+cookie jar: ciclo
completo login→refresh→logout verificado con las cookies reales (Set-Cookie con los
atributos correctos, body sin refreshToken, 401 sin cookie, cookie limpiada en logout).

Pendiente de Fase 7: CSP/headers endurecidos, suite de tests de seguridad explícita,
accesibilidad WCAG 2.2 AA, E2E de navegador (Playwright, no existe todavía).

## Fase 7, segundo corte: suite de tests de seguridad explícita (2026-08-17)

El usuario pidió seguir con este punto directamente. Se auditó qué de las tres
categorías que pide la spec (fuerza bruta, manipulación de roles, acceso a recursos
ajenos) ya tenía cobertura: acceso a recursos ajenos sí (disperso por módulo, patrón
ownership-404 ya establecido desde Fase 2), fuerza bruta **no tenía ningún test** pese a
estar implementada desde Fase 1, manipulación de roles tampoco tenía nada explícito.

Se creó `test/security.e2e-spec.ts` consolidando las tres categorías en un solo archivo
con propósito de auditoría — decisión deliberada de **no duplicar** la matriz completa
de ownership ya cubierta por módulo, solo agregar 2 casos representativos como ancla.

El hallazgo más interesante del corte fue de diseño, no de bug: al revisar
`RolesGuard` para escribir el test de "manipulación de rol" se confirmó que el JWT
**nunca** lleva el rol como claim (`TokensService.issue()` solo firma `{ sub: phone }`)
— `RolesGuard` hace `prisma.user.findUnique` por cada request para leer el rol actual.
Esto significa que un token robado/manipulado no puede escalar privilegios modificando
el payload (ni siquiera haría falta manipular la firma, el campo no existe), y que un
cambio de rol de un usuario (o una baja) toma efecto **inmediatamente** en su próxima
request, sin esperar a que expire o se revoque el access token de 15 min. Era una
propiedad de diseño correcta ya presente desde Fase 1, simplemente nunca se había
verificado con un test explícito ni quedaba documentada como tal — el test nuevo la deja
protegida contra una regresión futura (ej. alguien "optimizando" el guard para leer el
rol del JWT en vez de la BD, rompiendo esta garantía sin darse cuenta).

6/6 tests nuevos, 160/160 e2e total (dos corridas, idempotente), 66/66 unit. Sin cambios
de código fuente — solo tests, no hizo falta tocar Docker.

## Fase 7, tercer corte: CSP y headers de seguridad (2026-08-17)

El hallazgo central de este corte fue de arquitectura, no de código: al ir a configurar
la CSP se cayó en la cuenta de que `helmet()` en la API **no protege el HTML real de la
SPA** — Nginx sirve `web/dist` directo como archivos estáticos, sin pasar nunca por la
API. Una CSP "estricta" solo en `helmet()` (que era el estado antes de este corte) era
casi cosmética para el riesgo real de XSS, porque el documento que un atacante querría
inyectar no pasa por ahí. La CSP que importa tiene que vivir en Nginx.

Antes de escribir la política se grepeó `web/src` completo buscando toda referencia a
dominios externos, en vez de adivinar un allowlist y arreglarlo a los golpes: apareció
`storage.googleapis.com`+`cdn.jsdelivr.net` (modelo/wasm de MediaPipe, ya documentado
desde Fase 2) y `tile.openstreetmap.org` (Leaflet, desde Fase 4) — nada de fuentes
externas (Inter cae a `system-ui`) ni scripts/estilos inline (`dist/index.html`
verificado sin inline, todo `<script src>`). Con eso se armó una CSP `'self'`-por-defecto
con esos tres dominios agregados solo donde hacen falta (`img-src`, `connect-src`,
`worker-src`), más `data:`/`blob:` para el preview de firma (canvas) y video grabado.

**Rollout en dos pasos, no directo a bloqueo** — dado el riesgo real de romper features
ya verificadas con cámara real (video identidad) o el mapa (Fase 4), se desplegó primero
como `Content-Security-Policy-Report-Only` y se probó con `claude-in-chrome` contra el
stack Docker corriendo de verdad: login, mapa de ubicaciones (tiles cargando completos) y
video de identidad (WASM de MediaPipe cargando y corriendo, verificado por su propio log
interno de inicialización de OpenGL) — cero violaciones de CSP en consola en ningún caso.
Recién ahí se pasó a bloqueo real (`Content-Security-Policy`) y se repitieron las mismas
tres pruebas con el mismo resultado limpio. El único error visto en pantalla ("no se pudo
acceder a la cámara") es esperado en un navegador automatizado sin cámara real, no tiene
relación con la CSP.

En la API, `helmet()`'s CSP quedó condicional a `NODE_ENV`: estricta en producción (API
JSON puro, `default-src 'none'`), **desactivada del todo en dev** porque Swagger UI se
monta en la API misma y necesita inline. Se agregaron también `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (cámara+geolocalización
acotadas, resto denegado) en Nginx.

No verificado en runtime real de `docker-compose.prod.yml` (no estaba levantado esta
sesión) — la rama de producción de `main.ts` se validó solo por código/build.

## Fase 7, cuarto corte: accesibilidad WCAG 2.1 AA (2026-08-17)

Corte de frontend puro, sin tocar API ni Docker. La skill `accessibility-review`
encontró dos clases de problema, ambas en componentes compartidos (no páginas
sueltas), lo que las hace de alto apalancamiento: arreglar un componente base
corrige todas sus instancias en la app de una vez.

**Contraste de color por debajo de 4.5:1 (AA) en texto.** El tono `warning`
(`#F5A623`) daba ~2:1 sobre fondo claro — muy visible al ojo pero técnicamente
ilegible para el estándar. Se separó **uso como fondo/borde** (se queda igual,
el contraste ahí no aplica de la misma forma) de **uso como texto** (pasa a
`amber-700`, ~4.7:1). `primary` y `danger` en `tailwind.config.js` se
oscurecieron directamente en el token porque se usan como texto en demasiados
lugares (botones, links, `score.red`) para separar variantes como se hizo con
`warning` — más simple bajar el tono base un par de puntos que mantener dos
paletas paralelas.

**`WelcomeTour` no era un diálogo accesible de verdad.** Visualmente sí era un
modal (overlay + tarjeta centrada), pero sin `role="dialog"`, sin trampa de
foco (Tab se escapaba al contenido detrás del overlay) y sin cierre por
Escape — un usuario de teclado o lector de pantalla no tenía forma confiable
de saber que estaba en un diálogo ni de salir sin usar el mouse. Se implementó
a mano (sin librería nueva): `role="dialog"` + `aria-modal` + `aria-labelledby`
al título, foco inicial al montar vía `ref` + `useEffect`, trampa de foco
manual comparando `document.activeElement` contra el primer/último elemento
enfocable dentro del contenedor en el handler de `onKeyDown`, y `Escape`
disparando el mismo `finish()` que ya usaba el botón "Entendido".

Verificado: build/lint/test (web) en verde, 20/20 unit sin regresión. Quedó
pendiente, no bloqueante: esta pasada cubrió los componentes base compartidos,
no cada pantalla individual — una auditoría página por página es un corte
aparte si se pide.

## Fase 7, quinto corte: Playwright contra el stack Docker real (2026-08-18)

Motivación directa: varios bugs reales de esta fase (413 de Nginx en la subida
de video, la CSP mal ajustada que hubiera roto MediaPipe/Leaflet) solo
aparecieron probando contra el stack completo, nunca en Supertest ni en
Vitest+jsdom — ninguno de los dos pasa por Nginx ni ejecuta un navegador de
verdad. Playwright cierra ese hueco de forma repetible (antes dependía de
`claude-in-chrome` manual, sesión por sesión).

Primer corte deliberadamente angosto: un solo spec, el flujo cliente feliz de
punta a punta (registro→cotizador→onboarding→documentos→pagaré→`SUBMITTED`),
Chromium únicamente. Corre contra `http://localhost` (Nginx), no contra el dev
server de Vite — mismo argumento que llevó a `docker compose up` real en vez
de servers sueltos en Fase 1 Task 10.

Un detalle no obvio: Vitest por defecto matchea cualquier `*.spec.ts` del
proyecto, así que sin excluir `web/e2e/**` en `vite.config.ts` intentaba
correr el spec de Playwright bajo `jsdom` y fallaba (no hay `page`/browser
context ahí). Los dos test runners conviven en el mismo repo pero necesitan
límites explícitos de qué archivos les tocan.

El job de CI (`e2e-browser`) es el primero del repo que levanta el stack
completo de Docker dentro de Actions — hasta ahora CI solo corría contra
servicios sueltos (`mysql` como service container para la API, nada para
web). Se excluyó `worker` del `up` porque `main-worker.ts` sigue sin existir
(Fase 2/4, multas en vivo sin cron todavía) y solo generaría reinicios en
bucle en el log sin aportar nada a este flujo.

Verificado local: 1/1 PASS, dos corridas seguidas, sin regresión en build/lint
de web. No corrido todavía en Actions real — el primer push va a ser la
prueba de fuego de si el runner de GitHub necesita ajustes (tiempos de
arranque de Docker distintos a esta máquina, permisos) que no se ven en local.

## Fase 7, hallazgo entre cortes: CI nunca había corrido (2026-08-18)

Al querer verificar el run real de Actions del corte de Playwright, la API de
Actions devolvió `total_count: 0` — cero runs, nunca, en toda la historia del
repo. Causa: `.github/workflows/ci.yml` disparaba en `push.branches: [main]`,
pero este repo siempre trabajó sobre `master` (nunca se creó `main`) y nunca
hubo un solo Pull Request (todo el desarrollo commitea directo a `master`, ver
patrón de todos los cortes anteriores). Ninguno de los dos triggers
(`push`/`pull_request`) llegó a activarse jamás.

Implicación real, no cosmética: cada "verificado en verde" de `project_state.md`
desde que existe el workflow fue una corrida **local**, nunca confirmada de
forma independiente por CI. El pipeline mismo — que existe desde Fase 1 Task 9
— nunca se había probado en el entorno real de Actions (runner de Ubuntu,
permisos, red), solo se había validado localmente "por partes" (sintaxis YAML,
`migrate deploy` aislado). Corregido a `branches: [master]` en el mismo push
que agrega el job `e2e-browser` — la primera corrida real de Actions de este
repo va a validar simultáneamente el pipeline de siempre y el job nuevo.

## Fase 7, primer run real de CI: dos bugs preexistentes que salieron a la luz (2026-08-18)

Arreglar el trigger de rama no fue el final de la historia — el primer run
real falló, y encontró dos problemas que llevaban ahí desde antes (uno desde
Fase 2, uno desde que se agregó `@playwright/test` esta misma sesión), ambos
invisibles hasta ahora exactamente porque CI nunca había corrido.

**Lockfile no instalable bajo npm 10.** El `package-lock.json` de `web/` se
generó con npm 11 (esta máquina), pero el runner de Actions usa Node 22, que
trae npm 10. npm 11 tolera/repara silenciosamente una inconsistencia menor
(referencias a una versión de `esbuild` sin sus entradas correspondientes,
originada en una copia anidada de `vite` que `vitest` resuelve como peer
opcional interno) que npm 10 rechaza en seco con `npm ci`. Se reprodujo exacto
corriendo `npm ci` dentro de un contenedor `node:22` — mismo error, letra por
letra, que el log real de Actions. Arreglado regenerando el lockfile con
`npm install` (no `ci`) dentro de ese mismo contenedor, para que quede escrito
por el mismo npm que lo va a consumir en CI.

**El job `api` de CI nunca tuvo MinIO.** Documentos, BI, cobrador — cualquier
e2e que pase por `StorageModule` — fallaban con `getaddrinfo EAI_AGAIN minio`
porque el job solo definía un servicio `mysql`. Esto es un hueco que existe
desde que se agregó MinIO en Fase 2 (14-15 de agosto), simplemente nadie lo
había visto porque CI jamás había ejecutado una sola vez en la vida del repo.
El obstáculo para arreglarlo directo con `services:` de GitHub Actions: ese
bloque no deja pasar un `command:` propio al contenedor, y la imagen
`minio/minio` no arranca sin que se le pase `server /data` explícito (no trae
default). Se resolvió igual que se resolvería en cualquier VM: un paso nuevo
con `docker run -d` antes de instalar dependencias, publicando el puerto igual
que ya hace `mysql` como servicio.

**Cómo se verificó sin gastar corridas ciegas de Actions.** Se armó el mismo
entorno en local: MySQL 8.4 y MinIO efímeros (contenedores nuevos, sin el
volumen persistente de datos de dev de esta máquina) con exactamente las
mismas variables de entorno que usa el job `api`, migraciones aplicadas desde
cero, suite completa corrida contra eso — 160/160. Detalle que casi lleva a
una conclusión equivocada: el primer intento de reproducir el bug de MinIO
*sin* aislar contenedores nuevos pasó igual, porque `api/.env` (nunca
commiteado, exclusivo de esta máquina) ya apunta a la instancia de MinIO real
del stack de dev, tapando exactamente el hueco que existe en CI. Hubo que
forzar variables de entorno explícitas y un MinIO en un puerto distinto para
que el repro fallara de la misma forma que el run real — un recordatorio de
que "pasa en mi máquina" y "pasa en un entorno limpio" no son la misma
pregunta, ni siquiera cuando ambos corren el mismo comando.

**Cómo se consiguieron los logs reales.** La API de Actions rechaza la
descarga de logs de un job sin autenticación, incluso en un repo público
(`403 Must have admin rights to Repository`). `git credential fill` ya tenía
un token OAuth guardado para `github.com` (el mismo que usa `git push` sin
pedir contraseña) — reutilizarlo para el `curl` autenticado fue lo que
permitió ver el error real en vez de adivinar a partir de "failure" sin más
contexto.

## Fase 7, segundo run real de CI: secretos horneados en la imagen Docker (2026-08-18)

Con `api` y `web` ya en verde, el tercer bug fue el más interesante de los
tres — no estaba en el YAML de CI sino en `Dockerfile.api`, y su forma de
esconderse era casi elegante: `RUN npx prisma generate` necesita que
`DATABASE_URL` exista para que `prisma.config.ts` cargue (hace
`import "dotenv/config"` y después `env("DATABASE_URL")`, que tira si la
variable no está, aunque `generate` no llega a tocar ninguna base de datos
real). El build de `docker compose ... --build` en CI no tiene ningún `.env`
en ningún lado — fallaba ahí, limpio y reproducible.

Lo que hizo que nadie lo notara antes: `api/.env` (credenciales reales de esta
máquina, nunca commiteado) se copiaba sin querer a la imagen en cada build
local, porque el patrón `.env` en `.dockerignore` solo excluye el archivo en
la raíz del build context — no `api/.env`, que vive un nivel más adentro.
Cada build de este proyecto, desde que existe `api/.env`, horneó secretos
reales en una capa de la imagen. Nadie lo vio porque nunca hubo motivo para
inspeccionar las capas de una imagen que "solo" corre en la máquina de
desarrollo — hasta que CI, sin ese archivo, expuso la dependencia oculta.

Arreglo con dos partes deliberadamente separadas: `.dockerignore` pasa de
`.env` a `**/.env` (+ `**/.env.local`) para que ningún `.env` real, en
ninguna ruta, vuelva a colarse en una imagen; y `Dockerfile.api` gana un
placeholder explícito (`ENV DATABASE_URL="mysql://user:pass@localhost:3306/db"`,
nunca una credencial real) antes de `prisma generate`, para que ya no dependa
de que exista un `.env` — real o no — en el contexto de build. En runtime el
placeholder no importa: `docker-compose.dev.yml`/`.prod.yml` siempre inyectan
el `DATABASE_URL` real vía `environment:`, que pisa cualquier `ENV` horneado.

## Fase 7, feedback real de usuario probando el panel admin (2026-08-18)

Primera vez que el usuario probó el panel admin en su propio celular, no solo
por curl/Node. Salieron cinco puntos distintos, cada uno resuelto y verificado
antes de pasar al siguiente: login de admin bloqueado por teclado numérico
del celular, falta de ojito en contraseñas, ausencia total de alta manual de
cliente, sección de ajuste de score que no explicaba qué hacía, y confusión
sobre dónde aprobar solicitudes (que resultó no ser un bug — el flujo
funciona, solo faltaban datos de prueba reales, verificado haciendo un clic
de verdad vía `claude-in-chrome` con `element.click()` cuando los clicks por
coordenada del propio tooling de automatización no registraban).

El patrón que se repitió varias veces en esta sesión: "no veo la opción de
X" casi siempre resultó ser que X sí existía pero estaba mal ubicado o sin
contexto suficiente (aprobar solicitudes, asignar cobrador), no un feature
faltante — salvo el alta manual de cliente, que genuinamente no existía. Vale
la pena, ante un reporte de "no veo X", primero confirmar en vivo si existe
antes de asumir que hay que construirlo de cero.

## Fase 7, credenciales de correo editables desde admin — reabrir una regla fija (2026-08-18)

Hasta ahora "secrets solo en `.env`" era una restricción fija del proyecto,
de las que no se reabren sin pedirlo el usuario explícitamente. El usuario
pidió exactamente eso: poder configurar Gmail (usuario, contraseña, puerto)
desde el panel admin, con una prueba de envío real. Se le presentó la
alternativa más conservadora (solo un botón de prueba usando lo que ya hay en
`.env`, sin poder editarlo desde la UI) y eligió explícitamente guardar en
BD, editable — la regla se reabre solo para este caso, con la contraseña
siempre cifrada (AES-256-GCM, clave propia en `.env`) y nunca devuelta por la
API una vez guardada.

Decisión de diseño clave: `EmailService` pasó de armar el transporter SMTP
una sola vez en el constructor (leyendo `.env` al boot, requería reiniciar el
contenedor para que un cambio de credenciales aplicara) a armarlo en cada
envío, resolviendo la config en el momento — BD primero, `.env` como fallback
legacy. Es el mismo patrón que ya usa `BusinessRulesService`/
`ConfigurationService` para reglas de negocio, extendido con cifrado porque
acá sí hay un secreto real en juego (una contraseña de aplicación de Gmail),
no solo un número de configuración.

## Fase 7, asignar cobrador desde Clientes (2026-08-18)

Pedido explícito de reusar, no reconstruir: el usuario quería poder asignar
un cobrador desde la pantalla de Clientes, no solo desde dentro de una
solicitud aprobada. Se descartó (con el usuario, vía pregunta directa) armar
una página nueva de "Usuarios" que juntara clientes+cobradores+admins — el
control de asignar/quitar cobrador que ya existía en `AdminLoansPage` se
expuso también en `AdminCustomersPage`, mismo endpoint, mismo modelo de datos
(`Loan.collectorId`, no una relación cliente↔cobrador directa). El único
cambio de backend fue de exposición de datos, no de lógica: `AdminCustomersService`
pasó a reusar `ADMIN_LOAN_INCLUDE`/`toAdminLoanResult` (ya documentado en
CLAUDE.md como el patrón a reusar entre módulos admin con la misma forma de
datos) en vez de `toLoanDraftResult`, para que el detalle de cliente también
traiga `collectorId`/`collectorName` por préstamo.

## Fase 7, octavo corte: documentos para admin + borrado de cliente + lista negra (2026-08-18)

Pedido del usuario: el admin debía poder revisar los documentos de un cliente
(INE, comprobante, video de identidad) antes de aprobar una solicitud, y cerrar
dos huecos de operación — eliminar clientes y bloquear teléfonos. Tres bloques
con una decisión de negocio confirmada explícitamente en cada uno.

**Ver documentos.** El backend ya estaba escrito (sesión anterior, cortada por
créditos, sin commitear): `GET /admin/customers/:phone/documents` + `GET
/admin/documents/:id/signed-url` con `DocumentsService.signedUrlForAdmin()`. Se
corrió su e2e nunca ejecutado (`admin-documents.e2e-spec.ts`): 7/7 PASS. El
trabajo de este corte fue el frontend: componente compartido `DocumentList.tsx`
(etiquetas en español, imagen/PDF en pestaña nueva, **video inline** con
`<video controls>` — el usuario pidió explícitamente revisar el video ahí mismo
para comparar la cara contra el INE, no en otra pestaña). Integrado en
`AdminCustomersPage` y en el detalle de cada solicitud de `AdminLoansPage`
(sección "Documentos del cliente", carga vía el endpoint de documentos al
expandir).

**Borrado de cliente.** Pregunta directa al usuario: ¿quitar solo la cuenta o
borrar todo? → **borrar todo**, sin soft-delete, porque la gracia es que el
teléfono vuelva a quedar libre para un re-registro limpio. `AdminCustomersService.remove()`:
valida rol `CLIENT` (400 si no), borra objetos MinIO best-effort (log warn, no
tumba el delete si un objeto falla — coherencia de BD importa más que limpieza
perfecta de objetos), `prisma.user.delete` confiando en las FK `onDelete:
Cascade` (loans, pagos, documentos, ubicaciones, notificaciones, refresh tokens;
`AuditLog` queda con `SetNull`, el log sobrevive al borrado). `StorageService.removeObject()`
nuevo. Frontend: botón "Eliminar cliente" con confirmación en dos pasos (warning
explicando qué se borra + botón danger), patrón que evita borrados accidentales.

**Lista negra.** La pregunta era de diseño de datos: ¿campo en `users` o tabla
aparte? → **tabla aparte** (`Blacklist`, `phone` PK, `reason`, `createdBy`,
`createdAt`, sin FK a `users` a propósito) porque así también bloquea números
que nunca se registraron y guarda el motivo. `@Global()` como `AuditModule`.
Bloquea en los dos puntos de entrada reales: `AuthService.register()`
(ForbiddenException) y `LoansService.create()` — una cuenta ya dada de alta
tampoco puede pedir préstamos nuevos. CRUD admin auditado (`blacklist_added`/
`blacklist_removed`). Frontend: card "Lista negra" en `AdminCustomersPage`
(agregar teléfono+motivo, listar con quién/cuándo, quitar).

Patrón de infra repetido: tras la migración, `docker compose exec api npx
prisma generate` + `restart api` dentro del contenedor (gotcha del volumen
anónimo ya documentado) — la migración `20260818032847_blacklist` se aplicó
desde el host y el cliente se regeneró en ambos lados. Suite completa 196/196
e2e (dos corridas), 70/70 unit API, 20/20 web, build/lint verdes.

## Decisión de despliegue: VPS de Hostinger (2026-08-18)

Aclaración del usuario sobre el destino de producción: la app **no** es para
GitHub Pages ni hosting estático — es un stack Docker completo (API + frontend +
MySQL + MinIO + Nginx) que se despliega en un **VPS de Hostinger** con
`docker-compose.prod.yml`. El CI de GitHub Actions solo valida (build, lint,
tests, e2e de navegador) y nunca despliega. La configuración de producción
(TLS/HTTPS, firewall, backups con restauración probada, exponer MinIO tras un
proxy para URLs firmadas fuera de dev) es el contenido de Fase 8 del roadmap y
se ejecutará sobre ese VPS.

## Fix "No se pudo cargar la detección facial" (2026-08-18)

El usuario lo reportó en su celular al grabar el video de identidad. Causa raíz
de doble capa: (1) **descuadre de versiones** — el paquete instalado era
`@mediapipe/tasks-vision@^1.0.1` pero el código cargaba el WASM de `0.10.14`
(en 1.x cambió el glue/WASM; `FilesetResolver` arma `${base}/vision_wasm_*
_internal.js|.wasm` según SIMD); (2) **CDNs externas en runtime** (Google Storage
para el modelo, jsDelivr para el WASM), frágil desde redes móviles.

Fix confirmado con el usuario: **autocontener todo**. El WASM se copia desde
`node_modules` a `web/public/mediapipe/wasm/` en cada build
(`web/scripts/copy-mediapipe-wasm.mjs`, hooks `predev`/`prebuild`/`prepreview`),
el modelo tflite está commiteado en `web/public/mediapipe/model/`, y el código
apunta a `/mediapipe/*` local. El wasm NO va al precache de la PWA
(`injectManifest.globIgnores: ['**/mediapipe/**']` — el shell sigue ~1MB), y la
CSP de Nginx perdió los CDNs. Nginx sirve `.wasm` con `application/wasm`.
Lección de infra: no basta con que el archivo WASM exista en el CDN — el glue JS
del bundle debe coincidir con la versión del WASM, y en producción los assets de
una app para celular no deben depender de CDNs de terceros.

## Propuesta registrada: gestión de usuarios (2026-08-18)

El usuario pidió "no veo la gestión de usuarios en la app" — y no existe: los
clientes se gestionan en su página, los cobradores solo se crean dentro de
Solicitudes, y los admins no son gestionables. Alcance confirmado por pregunta
directa: **lista unificada de usuarios + gestión de cobradores + reset de
contraseña/roles** (excluye explícitamente la gestión de administradores).

Hallazgo técnico crítico del análisis: `AuthService.login()` ignora `INACTIVE`
y fuerza `status: 'ACTIVE'` en login exitoso — "desactivar" un usuario no
funcionaría sin tocar el login. Diseño completo (endpoints `GET /admin/users`,
`PATCH /admin/collectors/:phone/status`, `POST /admin/users/:phone/reset-password`,
`PATCH /admin/users/:phone/role` con reglas de negocio, página `/admin/usuarios`,
plan TDD) registrado en `project_state.md`. **Pendiente**: confirmar 3 reglas de
negocio (rol sin ADMIN, cobrador con préstamos no degradable, desactivar bloquea
login) y la implementación del corte.

## Tres puntos de UX registrados como pendientes (2026-08-18)

El usuario pidió documentar tres pedidos de UX mientras pasa el diseño "stitch"
del admin (que vendrá en una próxima sesión). Ninguno está implementado; quedan
registrados en `project_state.md` como pendientes:

1. **Fotos de cliente solo con cámara.** `DocumentsPage` usa `<input type="file">`
   sin `capture` — permite galería. Pedido: la foto debe tomarse en el momento.
   El patrón ya existe en evidencia de visita del cobrador (`capture="environment"`).
   Pendiente por resolver: el comprobante de domicilio acepta PDF además de imagen.
2. **Cobrador: monto a cobrar precargado.** `AdminLoanResult.payment` (la cuota
   semanal ya calculada) viaja en la API, pero `CollectorLoansPage` pide teclear
   el monto en cada cobro. Pedido: precargar la cuota, permitir sumar con
   **modales de "+/-"** (múltiplos del pago) y **sin edición manual** — evita
   errores. Solo frontend.
3. **Calculadora como landing, no login.** Hoy `/` sin sesión → `/login`. Pedido:
   landing pública con la calculadora y botón "Iniciar sesión" arriba a la derecha;
   **slider de $500 en $500 con tope $20,000** en vez de input manual; y "Lo quiero"
   aplica el tope de $3,000 para cliente nuevo (regla ya existente en backend,
   hay que reflejarla en el slider).

## Fase 7, gestión de usuarios — las 3 reglas confirmadas tal cual, un ajuste de implementación (2026-08-18)

El usuario confirmó las 3 reglas propuestas sin cambios (no gestionar admins,
cobrador con préstamos no se degrada, desactivar bloquea login) — la única
decisión que quedó abierta a criterio propio fue **qué hacer con el `Customer`
al convertir un cliente en cobrador**. La propuesta original solo decía "crea
el registro `Collector`", sin especificar si había que tocar el `Customer`
existente. Borrarlo hubiera sido consistente con "ya no es cliente", pero
`Customer` tiene cascada real hacia `Loan`/`Document`/`Payment` (el mismo
cascade que usa el borrado completo de cliente) — convertir a alguien en
cobrador hubiera borrado silenciosamente todo su historial de préstamos si
alguna vez fue cliente antes. Se optó por conservarlo siempre: un cambio de
rol es reversible por diseño, un borrado de historial no debería ser un
efecto secundario de otro flujo.

**El hallazgo colateral fue más grande que la feature.** Al correr la suite
completa para verificar que nada se rompiera, fallaron 85 de 211 tests —
no por el código nuevo, sino porque la fecha real había avanzado y "rotó"
`openingDate: '2026-08-17'` hardcodeado en 12 archivos de e2e distintos.
`loan-quote.spec.ts` ya se había arreglado dos veces en sesiones anteriores
sin que nadie se preguntara si el mismo patrón estaba repetido en otro lado
— sí lo estaba, en casi todos los e2e que crean un préstamo. Se creó un
helper compartido (`api/test/test-helpers.ts`, `nextWeeklyOpeningDate()`)
en vez de parchear cada archivo con una fecha nueva que iba a rotar otra vez
— la lección de las dos veces anteriores era justo esa: una fecha hardcodeada
en un test no es un fix, es una cuenta regresiva hasta el próximo "por qué
falla esto de repente".

## Fase 7, rediseño LendWise/stitch — por qué el primer intento no se vio bien (2026-08-18)

Un corte anterior (de otra sesión) había tocado `tailwind.config.js` con la
paleta correcta del mock, pero el usuario reportó que "el diseño no se
aplicó como quiero". Investigando antes de tocar nada, aparecieron dos
razones concretas, ninguna relacionada con los colores en sí:

1. **Los tokens estaban bien, pero nadie los usó.** Ninguna página real
   había sido tocada — `AdminBiPage`, `DashboardShell`, `DocumentsPage`
   seguían con el markup viejo. Cambiar `tailwind.config.js` define qué
   *podés* usar, no rediseña nada por sí solo.
2. **Las fuentes estaban descargadas pero nunca conectadas.** `Inter` y
   `Material Symbols Outlined` (`web/public/fonts/*.woff2`) existían en
   disco desde una sesión anterior, sin un solo `@font-face` que las
   cargara — el navegador caía a la fuente del sistema, y cualquier ícono
   `material-symbols-outlined` se veía como texto plano ("home", "search")
   en vez de un ícono, porque sin el font-face la ligadura no existe.

Con el usuario habiendo exportado 5 pantallas reales de Stitch (HTML+PNG,
carpeta `stitch/`) en vez de solo pedir "aplica los colores", el trabajo
pasó de "ajustar tokens" a "portar 5 pantallas reales markup por markup" —
mucho más trabajo, pero también mucho menos ambigüedad sobre qué se
esperaba ver.

**Regla aplicada en todo el corte: fidelidad visual sí, invención de datos
no.** El mock tiene varios números/conceptos que no existen en el sistema
real (un "score" numérico tipo 850, distancia GPS entre cobrador y cliente,
"meta diaria" de cobranza, gráfica de pastel con splits fijos 40/30/20/10).
En cada caso se adaptó al dato real disponible (categoría de score en vez
de número, folio en vez de distancia, KPIs reales de `/admin/bi/kpis` en vez
del pastel decorativo) en lugar de fabricar algo que se viera bien pero
fuera falso. Es la misma disciplina que ya rigió el resto del proyecto
(nunca exponer la tasa de interés real, nunca inventar el "próximo pago" sin
poder calcularlo) aplicada ahora al terreno visual.

**Lo que no se tocó a propósito:** `VideoIdentityPage` ya estaba probada con
cámara real de hardware (Fase 2). Se agregó la pantalla de instrucciones
previa del mock como un estado de UI puro (`showInstructions`, sin efecto en
la lógica de grabación/MediaPipe) — cualquier cambio más profundo ahí
arriesgaba una feature ya validada por muy poco beneficio visual adicional.

## Fase 7, corte 13: probar desde el celular + marca "Prestamitos" (2026-08-18)

Dos cambios chicos tras el rediseño:

1. **URLs firmadas de MinIO para el celular.** El `MINIO_PUBLIC_ENDPOINT` de
   `docker-compose.dev.yml` estaba fijo en `localhost` — desde el teléfono,
   cualquier documento (INE, comprobante, pagaré PDF, video) apuntaba al
   `localhost:9000` del propio teléfono y no descargaba. Se hizo interpolable
   (`${MINIO_PUBLIC_ENDPOINT:-localhost}`) y `.env` define la IP LAN
   (`192.168.68.71`). Verificado end-to-end: URL firmada con la IP LAN + PDF
   descargado por esa IP. El "pendiente real" documentado desde Fase 2
   (MinIO tras proxy en prod) sigue siendo para producción, esto solo cubre dev.

2. **Marca real: Prestamitos, no LendWise.** El mock de Stitch inventó
   "LendWise"; la app real se llama Prestamitos (lo que ya usaban login y
   WelcomeTour). Se reemplazó en los 4 puntos donde el rediseño la había
   metido (sidebar admin + header mobile admin + los 2 headers de
   cliente/cobrador). Detalle de la sesión: el usuario pidió "cambialo en el
   admin" y se extendió a los headers de cliente/cobrador por consistencia de
   marca — si solo se quería el admin, es un cambio de una línea revertir los
   otros dos.

También se dejó `test.md` (gitignored) como ficha viva para pruebas desde el
celular: IP real, préstamos vigentes (`ppni-1292` SUBMITTED listo para
aprobar, `ppni-4733` APPROVED con cobrador) y credenciales verificadas por
login real. Nota importante que quedó ahí: por HTTP sin HTTPS, la cámara,
geolocalización y Web Push **no funcionan en el celular** (contexto seguro) —
el resto del flujo sí.

## Fase 7, corte 14: acceso por rol + prompt de instalación PWA (2026-08-18)

El usuario pidió: "no quiero el login luego luego, quiero una URL para
cliente, una para Cobrador y otra para el Admin", y que la app se pueda
instalar en el celular para que se vea como app nativa. Se confirmaron dos
decisiones con él antes de tocar código (protocolo addv-web-app): la raíz
muestra la calculadora con accesos por rol, y cada login valida el rol.

- **Tres URLs de login con rol fijo:** `/cliente`, `/cobrador`, `/admin`.
  `LoginPage` acepta prop `role`; al entrar valida que la cuenta sea de ese
  rol — si no, cierra la sesión recién abierta y muestra "Esta cuenta no
  corresponde al acceso seleccionado." (detalle importante: si no se cerrara
  la sesión, el guard de rutas redirigiría igual al home del rol real, que no
  es el que el usuario eligió). Los accesos cobrador/admin no ofrecen
  "Regístrate" (registro es solo para clientes).
- **La raíz dejó de caer al login genérico:** `LandingPage` = header con la
  marca + botón "Iniciar sesión" arriba a la derecha + 3 tarjetas de acceso +
  la calculadora debajo. Desbloquea la parte central del pendiente UX #3
  (calculadora como landing); los detalles del slider ($500 en $500, topes
  $20,000/$3,000) siguen pendientes de confirmar.
- **Prompt de instalación:** `InstallPromptBanner` montado en `main.tsx`
  (sobre toda la app, no por pantalla). Escucha `beforeinstallprompt`, muestra
  bottom sheet con "Instalar"/"Ahora no", y persiste en localStorage para no
  insistir. **Lección importante documentada en `test.md`:** `beforeinstallprompt`
  NO dispara por HTTP desde el celular — solo HTTPS o localhost —, así que el
  banner no se verá en las pruebas por IP LAN; se verá en producción. Esto
  también aplica a cámara/geolocalización/Web Push (ya documentado).
- Rutas existentes intactas: `/login` (genérico) y `/calculadora` siguen
  funcionando; la app usa `/calculadora` en el nav del cliente y el registro
  sigue apuntando a `/register`.

Verificado con tests (28/28 PASS), lint y build, y confirmando por HTTP que
Nginx responde 200 en las 4 URLs nuevas (/, /cliente, /cobrador, /admin) y
que el bundle sirve las cadenas nuevas. Queda pendiente revisar en pantalla
real (navegador/celular) el aspecto de la landing, que es nueva UI.
