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
queda cubierto salvo **reglas configurables** (`score_rules`/`business_rules` — hoy
`PENALTY_PER_DAY=$50` y los umbrales de score están hardcodeados). BI y ubicaciones son
Fases 4/5 del roadmap, no Fase 3. El usuario decidió pausar Fase 3 acá explícitamente
en vez de seguir con reglas configurables — no es que falte terminarlo, es una decisión
tomada.

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
- **`project_state.md` se actualiza al cerrar cada corte**, no solo al final de fase.

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
