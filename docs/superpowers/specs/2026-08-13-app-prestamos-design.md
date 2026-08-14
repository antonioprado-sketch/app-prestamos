# Diseño — Plataforma Web de Préstamos "AppPrestamitos"

**Fecha:** 2026-08-13
**Estado:** Borrador para revisión
**Versión:** 0.1

---

## 1. Resumen ejecutivo

Se construirá una plataforma web de préstamos personales (fintech de crédito) 100% web con
estrategia **Mobile First + Responsive + PWA**, con tres experiencias de usuario separadas por
rol: **Cliente**, **Cobrador** y **Administrador**.

El negocio: préstamos a trabajadores por cuenta propia, plazo de 20 semanas, tasa de negocio
plana del 40% (no visible al cliente), pagos semanales o quincenales, multa de $50 MXN por día
de atraso, score visual de 4 colores, cobradores en campo (ubicación, WhatsApp, llamadas),
aprobación manual por administrador y panel de Business Intelligence.

Arquitectura objetivo: **Modular Monolith** — una API backend modular, un frontend PWA
monolítico multi-rol, MySQL como fuente de verdad, worker de tareas programadas, almacenamiento
S3-compatible (MinIO) para documentos/video. Despliegue inicial en Ubuntu con Docker Compose.
Diseñada para operar con ~10 usuarios hoy y crecer a 1,000+ sin reconstruir.

Prioridades: 1) Seguridad, 2) Integridad financiera, 3) Integridad de datos, 4) UX,
5) Confiabilidad, 6) Mantenibilidad, 7) Rendimiento, 8) Escalabilidad, 9) Costo, 10) Complejidad.

---

## 2. Análisis del requerimiento: lo definido, lo ambiguo y lo contradictorio

### 2.1 Definido sin ambigüedad

| # | Requerimiento | Estado |
|---|---------------|--------|
| R1 | Interés 40% plano sobre capital; Total = Capital × 1.4 | Definido |
| R2 | Semanal: 20 pagos, pago = total/20, primer cobro = alta + 7 días, días válidos lun/vie | Definido |
| R3 | Multa $50 MXN/día de atraso, acumulativa diaria | Definido |
| R4 | El cliente no debe ver la tasa del 40% | Definido |
| R5 | Folio `ppni-nnnn`, único, generado aleatoriamente | Definido (rango ambiguo, ver C1) |
| R6 | Roles: Cliente, Cobrador, Administrador con permisos descritos | Definido |
| R7 | Admin inicial `admin:admin` vía .env + cambio obligatorio en primer acceso | Definido |
| R8 | Campos del cliente y obligatoriedad | Definido |
| R9 | Video grabado en vivo (no galería) con frase declarada | Definido |
| R10 | Estados de solicitud: borrador → enviada → en revisión → requiere corrección → aprobada → rechazada → activa → liquidada / cancelada | Definido |
| R11 | Stack base obligatorio: Docker Compose, MySQL, Ubuntu | Definido |
| R12 | Nuevo cliente: máximo $3,000 configurable global e individual | Definido |
| R13 | Aprobación 100% manual inicialmente | Definido |
| R14 | Todos los campos del cliente obligatorios | Definido |
| R15 | Cobrador no modifica multas/score; no aprueba préstamos | Definido |

### 2.2 Ambiguo / contradictorio (requiere decisión)

| ID | Requerimiento original | Problema | Propuesta recomendada |
|----|------------------------|----------|----------------------|
| C1 | Folio `ppni-nnnn` con "nnnn del 0 al 19" | Rango imposible: solo 20 folios únicos (colisión garantizada). Contradice "impedir duplicidades" con volumen. | **APROBADO:** `nnnn` = 4 dígitos aleatorios 0000–9999 (10,000 combos). PK interna UUID + columna `folio` UNIQUE con reintento de colisión. El folio visible no cambia. |
| C2 | Modelo quincenal: "20 semanas" + "pagos cada 15 días" + "día 15 y último día del mes" | Regla no determinística: 15 días exactos ≠ día 15/último día (meses de 28–31 días). ¿Cuántos pagos? | **APROBADO (regla corregida por el negocio):** el préstamo siempre dura **20 semanas**. El costo total = capital + 40% sin importar el modelo. El cobro semanal no cambia de monto (base total/20); lo que cambia es **cuándo se cobra**: el cobrador solo cobra en **día de quincena** (día 15 y último día del mes, cuando el cliente tiene dinero) para **no penalizar** al cliente. Cada cobro de quincena recoge el equivalente a 2 pagos semanales (total/10). 10 cobros en total (~20 semanas). **La multa solo aplica si no paga en su día de quincena.** |
| C3 | Contraseña: mínimo 7, máximo 10, alfanumérica, mayúsculas y minúsculas | Máximo 10 y solo alfanumérica = mala práctica (entropía baja, rompe passphrases). | **APROBADO:** mínimo 8, máximo 64, permitir símbolos, exigir 1 mayúscula + 1 número. Hash Argon2id. |
| C4 | "Pago semanal/quincenal" (sección 14) vs "Pago = total/20" (sección 12) | La fórmula del total/20 solo aplica al modelo semanal. | Semanal: total/20. Quincenal: total/10. Ambos con último pago ajustado para que la suma = total exacto. |
| C5 | Datos del cliente no incluyen dirección | El cobrador debe ver "dirección" (sección 39) y subir comprobante de domicilio. | **APROBADO:** agregar campos de dirección al onboarding: calle, número, colonia, CP, ciudad, estado, referencias. |
| C6 | Inicio de la multa: ejemplo dice "viernes: $50" si no se pagó el viernes | ¿La multa corre desde el mismo día del vencimiento? ¿Hay gracia? | **APROBADO:** día 1 de atraso = el mismo día del vencimiento (sin período de gracia), conforme al ejemplo. Hora límite 23:59:59 local. |
| C7 | Orden de aplicación de pagos | ¿El pago cubre primero multas o cuotas? | **APROBADO:** orden 1) multas acumuladas, 2) cuota vencida más antigua, 3) cuota vigente. |
| C8 | ID = número celular (llave primaria) | Riesgo: número reciclado, cambio de número, portabilidad, colisiones. | **APROBADO (decisión de negocio):** el teléfono **es la identidad** del cliente. Se usa como llave primaria de `users`. **No existe flujo de cambio de número** (cambiar el número implica perder el usuario — medida anti-fraude). La validación manual de video + INE detecta suplantaciones. |
| C9 | Interés 40% plano en 20 semanas | Tasa equivalente anualizada ≈ 104%+ (sin capitalización). Implicación legal mexicana (usura, CAT, LFPDPPP). | Mantener la regla de negocio tal cual. Documentar riesgo legal y recomendar validación jurídica. El pagaré muestra total a pagar, no la tasa. |
| C10 | "Quincenal: día 15 y último día del mes" en la calculadora | El cliente elige fecha de apertura; ¿fecha de apertura quincenal solo 15/último día? | Sí: en la calculadora, para quincenal solo se habilitan día 15 y último día del mes. Para semanal, solo lunes y viernes. |
| C11 | Firma del pagaré (imagen de firma ≠ firma electrónica válida) | Valor jurídico incierto. | **APROBADO:** firma dibujada en canvas + nombre completo + timestamp/IP + **video declarativo vinculado al folio** como consentimiento. Nota legal: validar con abogado si se requiere FEA (e.firma SAT). |
| C12 | Offline + registro de pagos | Riesgo de doble registro por reintento. | **Idempotency key** (UUID generado en el dispositivo al capturar el pago) + UNIQUE constraint. Cola de sincronización local del cobrador. |
| C17b | Validación del video de identidad | Criterios no definidos. | **APROBADO:** mínimos técnicos (duración ≥ 3s, resolución ≥ 480p, peso ≤ 50MB) + **detección facial automática con MediaPipe en el navegador** (rostro presente en varios fotogramas, sin enviar el video a servicios externos) + revisión manual del admin. Rechazo con motivo claro y opción de repetir. |
| C13 | Almacenamiento de archivos "dentro del contenedor" | Video/doc crecen rápido; volumen efímero. | Volumen Docker dedicado + abstracción S3 (MinIO) para migrar a R2/S3 sin cambios. Backups del volumen. |
| C14 | Push/Web Push "cuando sea viable" | Costo/complejidad vs. valor con 10 usuarios. | Fase 6: Web Push (VAPID) en cliente y cobrador. Email + in-app como canal primario desde el inicio. |
| C15 | Geolocalización "cada vez que el cliente use la app" | Privacidad LFPDPPP; consumo de batería; permiso. | Captura con consentimiento explícito (aviso de privacidad), al login y en eventos clave (solicitud, pago). Nunca en background sin permiso. |
| C16 | OCR para INE/comprobantes | Costo (cloud) vs. precisión (self-hosted). | Fase 2+ opcional: Tesseract self-hosted. No bloquea el MVP. Los documentos se validan manualmente por el admin. |
| C17 | Video: "validar calidad técnicamente" | Criterios no definidos. | Mínimos: duración ≥ 3s, resolución ≥ 480p, no vacío, peso ≤ 50MB. Detección facial (MediaPipe) opcional en fase 2+. |

### 2.3 Riesgos detectados

| Riesgo | Tipo | Mitigación |
|--------|------|------------|
| Fraude de identidad (INE ajena, video pre-grabado) | Negocio | Video en vivo (getUserMedia, sin galería), revisión manual del admin, auditoría |
| Doble registro de pagos offline | Integridad financiera | Idempotency key + UNIQUE + transacciones |
| Redondeo: suma de pagos ≠ total | Integridad financiera | Último pago absorbe residuo; DECIMAL(10,2); pruebas matemáticas |
| Número celular reciclado | Identidad | UUID interno + validación documental |
| Acceso no autorizado a documentos privados | Seguridad | URLs firmadas con expiración, proxy backend, bucket privado |
| Exposición de la tasa del 40% | Cumplimiento de regla de negocio | Nunca enviar la tasa en respuestas de API del cliente |
| Video/datos creciendo en disco | Operación | MinIO + lifecycle, límites de peso/resolución, backups |
| Multas mal calculadas (zona horaria) | Integridad financiera | Zona horaria única (America/Mexico_City) en backend y BD |
| Cumplimiento legal (LFPDPPP, usura, CAT) | Legal | Aviso de privacidad, consentimiento, documentación, validación jurídica pendiente |
| Pérdida de datos | Operación | Backups diarios MySQL + MinIO, restauración probada |

---

## 3. Actores y permisos (RBAC)

| Acción | Cliente | Cobrador | Administrador | Sistema |
|--------|:-------:|:--------:|:-------------:|:-------:|
| Registrarse / recuperar contraseña | ✔ | ✖ | ✖ | — |
| Solicitar préstamo (calculadora → lo quiero) | ✔ | ✖ | ✖ | — |
| Consultar préstamo/pagos/multas/score/fechas | ✔ (solo los propios) | ✔ (asignados) | ✔ (todos) | — |
| Actualizar datos propios (con auditoría) | ✔ | ✖ | ✔ | — |
| Registrar pagos | ✖ | ✔ (asignados, importe precargado ±) | ✔ | ✔ (multas automáticas) |
| Modificar multas | ✖ | ✖ | ✔ (auditado) | ✔ |
| Modificar score | ✖ | ✖ | ✔ (auditado) | ✔ |
| Aprobar / rechazar / pedir corrección | ✖ | ✖ | ✔ | — |
| Asignar cobradores | ✖ | ✖ | ✔ | — |
| Consultar ubicaciones / BI | ✖ | ✔ (asignados) | ✔ (todos) | — |
| Administrar reglas/configuración | ✖ | ✖ | ✔ | — |
| Crear cobradores | ✖ | ✖ | ✔ | — |
| Llamar / WhatsApp | ✔ (soporte) | ✔ (clientes asignados) | ✔ | — |
| Recibir notificaciones | ✔ | ✔ | ✔ | — |

---

## 4. Arquitectura propuesta

```
                    ┌─────────────────────────────────────────────┐
                    │               Nginx (reverse proxy)          │
                    │  TLS (Let's Encrypt) · estáticos del frontend│
                    └──────┬──────────────────────┬────────────────┘
                           │                      │
              ┌────────────▼──────┐   ┌───────────▼──────────────┐
              │  Frontend PWA     │   │  API Backend (NestJS)     │
              │  React + Vite     │   │  Modular Monolith         │
              │  cliente/cobrador │   │  /api/v1 · RBAC · OpenAPI │
              │  /admin (multi-   │   └───┬──────────┬────────────┘
              │  rol, un bundle)  │       │          │
              └────────────┬──────┘       │          │
                           │              │          │
                    ┌──────▼──────────────▼──┐   ┌───▼──────────────┐
                    │      MySQL 8           │   │ Worker (cron)    │
                    │  fuente de verdad      │   │ multas · correos │
                    │  DECIMAL · transacc.   │   │ recordatorios ·  │
                    └────────────────────────┘   │ PDFs · jobs      │
                                                └───┬──────────────┘
                                                ┌───▼──────────────┐
                                                │ MinIO (S3)       │
                                                │ docs · video ·   │
                                                │ pagarés          │
                                                └──────────────────┘
```

**Decisión: Modular Monolith, no microservicios.**

Justificación: equipo pequeño, ~10 usuarios actuales, y la regla de negocio exige
transacciones entre préstamo/pago/multa/score (una BD única simplifica la integridad
financiera). Los módulos se organizan con límites claros (auth, customers, loans, payments,
penalties, scores, collectors, documents, locations, notifications, bi, audit, admin) para que
puedan extraerse a servicios independientes si el volumen lo justifica (≥ miles de usuarios).

Componentes:

1. **Nginx**: reverse proxy, TLS, sirve el build del frontend, compresión, cache de estáticos.
2. **API (NestJS + TypeScript)**: REST `/api/v1`, autenticación JWT, RBAC, validación,
   transacciones, OpenAPI/Swagger, rate limiting, logs estructurados (pino).
3. **Worker (NestJS standalone)**: procesos programados vía jobs con tabla en MySQL
   (sin Redis para no añadir infraestructura): cálculo diario de multas (idempotente),
   recordatorios, envío de correos, generación de PDF, reportes.
4. **MySQL 8**: única fuente de verdad. `DECIMAL(10,2)` para dinero, zona horaria
   `America/Mexico_City`, charset utf8mb4.
5. **MinIO (S3-compatible)**: documentos INE, comprobantes, video, pagarés. Buckets privados,
   acceso por URLs firmadas a través de la API. Migrable a Cloudflare R2/AWS S3 sin cambios de código.
6. **Frontend PWA**: React + TypeScript + Vite, un solo bundle multi-rol (rutas protegidas por
   rol), `vite-plugin-pwa` (manifest, service worker, instalabilidad), Tailwind + Design System.

No se incluyen en v1 (no necesarios): Redis, colas externas, CDN, Prometheus/Grafana,
ClamAV, motor de OCR (se evalúan en fases posteriores).

---

## 5. Stack tecnológico y justificación

| Capa | Tecnología | Versión | Función | Justificación | Alternativas | Costo | Escalabilidad |
|------|-----------|---------|---------|---------------|--------------|-------|---------------|
| Frontend | React + TypeScript + Vite | React 18, Vite 5 | SPA PWA multi-rol | Ecosistema maduro, DX excelente, PWA bien soportada (vite-plugin-pwa), TypeScript reduce errores | Next.js, Svelte, Angular | $0 | Alta |
| UI | Tailwind CSS | v3/v4 | Design System | Utility-first, consistencia, mobile-first, árbol de CSS pequeño | MUI, Chakra, shadcn | $0 | Alta |
| PWA | vite-plugin-pwa (Workbox) | — | Manifest, SW, offline shell | Integrado a Vite, estrategias de cache controladas | next-pwa | $0 | Alta |
| Backend | NestJS + TypeScript | NestJS 10 | API REST modular | Estructura por módulos (futuro split a microservicios), DI, guards RBAC, validación con class-validator, OpenAPI nativo | Fastify, Express, Adonis | $0 | Alta |
| ORM | Prisma | 5.x | Migraciones + acceso MySQL | Tipos seguros, Decimal nativo, migraciones versionadas, seed | TypeORM, Knex, raw SQL | $0 | Alta |
| BD | MySQL | 8.x | Fuente de verdad | Obligatorio por requerimiento; DECIMAL, transacciones ACID, FK, índices | PostgreSQL | $0 | Alta |
| Hash | Argon2id (node-argon2) | — | Hash de contraseñas | OWASP #1 recomendación, resistente a GPU | bcrypt, scrypt | $0 | — |
| Auth | JWT (access 15min + refresh rotativo) | jsonwebtoken | Sesiones API | Stateless, simple, refresh en cookie HttpOnly | Sessions, OAuth | $0 | Alta |
| Storage | MinIO | latest | Documentos/video | S3-compatible, self-hosted, costo 0, migrable a R2/S3 | AWS S3, R2, volumen | $0 (self) | Alta |
| PDF | pdf-lib | — | Pagaré | Generación server-side, sin dependencias nativas | Puppeteer, react-pdf | $0 | Media |
| Email | Gmail SMTP (App Password) | — | Correos transaccionales desde una sola cuenta Gmail | **APROBADO (decisión del negocio):** cuenta Gmail corporativa, App Password en `.env`. Módulo de correo abstraído (interfaz) para poder cambiar a Resend/SendGrid sin tocar el resto. Límite ~500/día (suficiente para la escala) | Resend, SendGrid, SMTP propio | $0 | Media |
| Entornos | dev y producción únicamente | — | Sin entorno intermedio | **APROBADO (decisión del negocio):** solo dev y prod | staging | $0 | — |
| Maps | Deep links (geo:/Google Maps URL) | — | Navegación cobrador | Costo $0, sin API key, UX nativa | Google Maps JS API, MapLibre | $0 | Alta |
| Maps (admin) | Leaflet + OpenStreetMap | — | Mapa de ubicaciones | $0, sin key, suficiente para visualizar | Google Maps API | $0 | Media |
| Jobs | Worker NestJS + tabla `jobs` | — | Multas, correos, PDF | Sin Redis, confiable (registro en MySQL), idempotente | BullMQ+Redis, cron del SO | $0 | Media |
| Logs | pino (JSON estructurado) | — | Observabilidad | Rápido, estructurado, listo para Loki/ELK | winston | $0 | Alta |
| Tests | Vitest + Supertest + Playwright | — | Unit/integration/E2E | Un solo ecosistema TS | Jest, Cypress | $0 | — |
| CI/CD | GitHub Actions | — | Lint, test, build, deploy | Integrado a GitHub | Jenkins, GitLab CI | $0 | — |
| Proxy | Nginx | 1.25 | TLS, estáticos, proxy | Estándar, eficiente, Let's Encrypt con certbot | Caddy, Traefik | $0 | Alta |

### Tecnologías evaluadas y descartadas (v1)

| Tecnología | Motivo de descarte |
|------------|--------------------|
| Microservicios / Event-driven (Kafka/RabbitMQ) | Complejidad innecesaria para 10→1,000 usuarios; la integridad financiera se simplifica con una BD y monolitos modulares |
| Redis | No hay necesidad real en v1; la tabla de jobs cubre tareas programadas |
| Next.js (SSR) | La app es una SPA autenticada; SSR no aporta SEO y añade complejidad de despliegue |
| Google Maps JS API | Costo por uso; deep links cubren la navegación del cobrador; Leaflet cubre el mapa del admin |
| ClamAV / OCR (Tesseract) | Posponen a fases posteriores; la revisión manual del admin es el control en v1 |
| Prometheus/Grafana | v1 usa healthchecks + logs estructurados; se agregan en Fase 8 |
| Firestore/Supabase/etc. | Requerimiento fija MySQL y Docker Compose |

---

## 6. Modelo de datos (ER lógico)

```
users (phone VARCHAR(15) PK, email, password_hash, role ENUM, status, 
       must_change_password BOOL, created_at, updated_at)
  ├─ customers (phone FK PK, nombres ≤25, apellidos ≤35, aval, aval_phone,
  │            direccion {calle, numero, colonia, cp, ciudad, estado, referencias},
  │            is_new_customer BOOL, max_loan_amount DECIMAL(10,2) NULL,
  │            onboarding_completed_at, created_at)
  ├─ collectors (id UUID PK, phone FK UNIQUE, name, phone, active, created_at)
  └─ admins (id UUID PK, phone FK UNIQUE)

loans (id UUID PK, folio ppni-nnnn UNIQUE, customer_id FK, collector_id FK NULL,
       amount DECIMAL(10,2), total_to_pay DECIMAL(10,2), model ENUM(weekly, biweekly),
       status ENUM(draft, submitted, in_review, requires_correction, approved, rejected,
                   active, liquidated, cancelled),
       opening_date DATE, approved_by FK NULL, approved_at, liquidated_at,
       created_at, updated_at)
  ├─ loan_schedules (id PK, loan_id FK, seq INT, due_date DATE, amount DECIMAL(10,2),
  │                  status ENUM(pending, paid, partial, overdue), paid_amount DECIMAL(10,2),
  │                  UNIQUE(loan_id, seq))
  ├─ payments (id UUID PK, loan_id FK, schedule_id FK NULL, collector_id FK NULL,
  │            amount DECIMAL(10,2), received_at DATETIME, idempotency_key UUID UNIQUE,
  │            notes, created_by FK)
  ├─ penalty_events (id PK, loan_id FK, event_date DATE, days_late INT, amount DECIMAL(10,2),
  │                  source ENUM(system, admin), reason, prev_value, new_value, created_by,
  │                  UNIQUE(loan_id, event_date, source))
  ├─ penalties (loan_id PK/FK, days_late INT, accrued DECIMAL(10,2), last_calc_at)
  ├─ status_history (id PK, loan_id FK, from_status, to_status, changed_by FK, reason, at)
  ├─ documents (id UUID PK, customer_id FK, loan_id FK NULL, type ENUM(ine_front, ine_back,
  │             address_proof, video_identity, pagare, collector_doc, other),
  │             storage_key, mime, size_bytes, checksum, uploaded_by, created_at)
  └─ collector_assignments (id PK, loan_id FK, collector_id FK, assigned_at, active)

scores (id PK, customer_id FK UNIQUE, value INT, level ENUM(red, orange, yellow, green),
        updated_by, updated_at, reason)
score_rules (id PK, name, metric, operator, threshold, points, enabled, updated_at)

locations (id PK, customer_id FK, lat DECIMAL(9,6), lng DECIMAL(9,6), accuracy, 
           captured_at, source ENUM(onboarding, login, payment, request))

notifications (id PK, user_id FK, type, channel ENUM(in_app, email, push), title, body,
               status ENUM(pending, sent, failed, read), sent_at, read_at, metadata JSON)
email_events (id PK, to, subject, template, status, error, sent_at)

audit_logs (id PK, user_id FK NULL, action, entity, entity_id, prev_value JSON NULL,
            new_value JSON NULL, ip, user_agent, created_at)

configuration (key PK, value JSON, updated_at, updated_by)
business_rules (id PK, rule_key, params JSON, enabled, version, updated_by, updated_at)

jobs (id PK, type, status ENUM(pending, running, done, failed), payload JSON,
      run_at DATETIME, attempts INT, last_error, UNIQUE(type, dedupe_key))
```

Reglas clave:

- **Dinero**: siempre `DECIMAL(10,2)`; nunca float. Ajuste de redondeo en la última cuota.
- **Índices**: `loans(customer_id, status)`, `loan_schedules(loan_id, due_date)`,
  `payments(loan_id, received_at)`, `locations(customer_id, captured_at)`,
  `documents(loan_id)`, `audit_logs(entity, entity_id, created_at)`, `users(phone)`.
- **Soft delete**: solo en `users` (status), los datos financieros nunca se borran (auditoría).
- **Auditoría**: tabla `audit_logs` para login/logout/cambios de contraseña, aprobaciones,
  rechazos, correcciones, modificación de multa/score/préstamo, asignación de cobrador,
  registro de pago, cambios de datos del cliente, eliminación de documentos, cambios de reglas.
- **Zona horaria**: `America/Mexico_City` en sesión MySQL y en el backend.

---

## 7. Motor financiero (reglas centralizadas en backend)

1. **Quote (cotización)**: `POST /api/v1/loans/quote` calcula server-side:
   - Semanal: `total = round2(capital * 1.4)`; `pago = round2(total / 20)`;
     `ultimo_pago = total - (19 * pago)`. Fechas: alta + 7 días y cada +7 días (20 fechas).
   - Quincenal: `total = round2(capital * 1.4)`; `pago = round2(total / 10)`;
     `ultimo_pago = total - (9 * pago)`. Fechas: alternar día 15 / último día del mes,
     primera ≥ alta + 15 días (10 fechas).
   - Validación: capital > 0, ≤ máximo (3,000 para nuevo cliente si aplica), días hábiles
     válidos según modelo.
2. **Multas**: al pasar un vencimiento sin pago completo de esa cuota, el cron diario
   inserta `penalty_events` (idempotente por `UNIQUE(loan_id, event_date, source)`) con
   `days_late = días desde vencimiento` y `amount = days_late × 50`. La multa deja de
   acumularse cuando no existe monto vencido.
3. **Aplicación de pagos** (transaccional): 1) multas acumuladas → 2) cuota vencida más
   antigua → 3) cuota vigente. El sobrante ajusta la cuota vigente (pago anticipado).
4. **Score**: `green` = sin multas; `yellow/orange/red` por reglas configurables
   (`score_rules`). El admin puede ajustar manualmente (auditado).
5. **Idempotencia**: pagos y solicitudes con `idempotency_key` (UUID del cliente/dispositivo)
   + UNIQUE constraint; el cron de multas es idempotente por fecha.

---

## 8. API Design (resumen)

Versionado `/api/v1`, JSON, errores RFC 7807, OpenAPI en `/api/v1/docs`.

| Módulo | Endpoints principales | Permisos |
|--------|----------------------|----------|
| Auth | POST /auth/register (pasos onboarding), POST /auth/login, POST /auth/refresh, POST /auth/logout, POST /auth/forgot-password, POST /auth/reset-password, POST /auth/change-password (obligatorio 1er login) | público |
| Quote | POST /loans/quote | público (anónimo conserva cotización con id local) |
| Loans | POST /loans (Lo quiero), GET /loans, GET /loans/:id, GET /loans/:id/schedule | cliente (propio) / admin |
| Admin loans | GET /admin/loans?status=, POST /admin/loans/:id/approve, /reject, /request-correction, PATCH /admin/loans/:id | admin |
| Payments | POST /payments (idempotency), GET /loans/:id/payments | cobrador (asignado) / admin / cliente (propio) |
| Penalties | GET /loans/:id/penalties, PATCH /admin/loans/:id/penalties (motivo obligatorio) | cliente propio / admin |
| Scores | GET /customers/me/score, PATCH /admin/scores/:id, GET /admin/scores | cliente / admin |
| Customers | GET /customers/me, PATCH /customers/me (auditado + notificación admin), GET /admin/customers, PATCH /admin/customers/:id/new-client | cliente / admin |
| Collectors | CRUD /admin/collectors, POST /admin/assignments | admin |
| Collector app | GET /collector/portfolio (ordenado por fecha de cobro más próxima), GET /collector/customers/:id (ubicación/contacto) | cobrador |
| Documents | POST /documents (upload validado), GET /documents/:id/signed-url, GET /admin/documents | cliente / admin |
| Locations | POST /locations, GET /admin/locations, GET /admin/locations/map | cliente / admin |
| Notifications | GET /notifications, PATCH /notifications/:id/read, POST /notifications/webpush-subscribe | autenticados |
| BI | GET /admin/bi/kpis, /admin/bi/trends, /admin/bi/collectors, /admin/bi/geo | admin |
| Admin | GET /admin/pending-review (documents/videos), GET /admin/audit-log | admin |
| Health | GET /health, GET /health/ready | público |

---

## 9. Seguridad

- **OWASP Top 10**: validación de entrada (class-validator), SQL injection neutralizada por
  Prisma parametrizado, XSS por escape de React + CSP estricta, SSRF evitado (sin fetches a
  URLs de usuario), rate limiting por IP y por usuario (throttler), headers seguros (helmet),
  CORS con allowlist.
- **Autenticación**: Argon2id (mem 64MB, t=3, p=4); JWT access 15 min + refresh token
  rotativo en cookie HttpOnly+Secure+SameSite; cambio de contraseña obligatorio para el
  admin inicial; logout revoca refresh; bloqueo temporal tras 5 intentos fallidos.
- **Documentos**: buckets MinIO privados; descargas por URLs firmadas (expiración 5 min)
  emitidas por la API tras autorización; nunca archivos en el docroot público; checksum SHA-256
  al subir; límites: INE/comprobante ≤ 5MB, video ≤ 50MB, formatos validados por magic bytes.
- **Secrets**: solo `.env` (gitignored) + `.env.example` con placeholders; nunca hardcodeados;
  admin inicial desde `ADMIN_USERNAME`/`ADMIN_PASSWORD` de .env.
- **TLS**: HTTPS con Let's Encrypt (certbot) detrás de Nginx; HSTS.
- **Backups cifrados**: mysqldump + `openssl enc` (GPG/AES) y espejo de MinIO a ubicación
  externa.
- **Auditoría**: `audit_logs` con actor, IP, user-agent, antes/después; logs de seguridad
  separados.
- **Privacidad**: aviso de privacidad + consentimiento explícito (ubicación, video, datos
  personales); minimización; retención definida (préstamos liquidados: 5 años, configurable);
  derecho de acceso/rectificación (flujo de actualización auditado).

---

## 10. Infraestructura (Docker Compose, Ubuntu)

Servicios: `nginx` (proxy+estáticos+TLS), `api` (NestJS), `worker` (jobs), `mysql` (8.x),
`minio` (S3). Envío de correos: Gmail SMTP (App Password) en ambos entornos (dev y prod),
sin servicio de correo intermedio. Solo existen los entornos **dev** y **producción**.

- Restart policies, healthchecks en todos los servicios, límites de memoria/CPU.
- Volúmenes: `mysql_data`, `minio_data`, `uploads_tmp` (workdir de procesamiento).
- Backups: script `scripts/backup.sh` (cron del host): dump MySQL + `mc mirror` de MinIO,
  cifrado, retención 14 días, restauración documentada y probada en Fase 8.
- Firewall UFW (22, 80, 443), actualizaciones automáticas, usuario deploy sin root,
  keys SSH.

---

## 11. UX / Design System (resumen)

- **Design tokens**: paleta financiera profesional (primario: verde esmeralda `#0F8B5F`;
  secundario: azul noche `#1B2A4A`; estados: rojo/naranja/amarillo/verde para score;
  éxito/error/alerta; tipografía Inter; radios, sombras, spacing 4px grid).
- **Componentes**: Button, Input, Select, Modal, Alert, Card, Table, Badge, Tabs, Stepper,
  Skeleton, EmptyState, ErrorState, Toasts, BottomSheet, FAB, ProgressBar, ScoreMeter.
- **Mobile-first**: touch targets ≥ 44px, navegación bottom bar en móvil, pull-to-refresh.
- **Accesibilidad WCAG 2.2 AA**: contraste AA, labels, foco visible, teclado, lectores.
- **Flujo clave (Lo quiero)**: calculadora → botón Lo quiero → onboarding en pasos con
  progreso y guardado progresivo (la cotización nunca se pierde) → documentos → video →
  pagaré → "Tu solicitud está siendo procesada".
- **Onboarding del cliente**: recorrido guiado al primer acceso (dashboard, fechas, pagos,
  multas, score, perfil, pull-to-refresh).
- **Cobrador**: lista ordenada por fecha de cobro más próxima, buscador por nombre, botones
  llamar/WhatsApp/mapa.

---

## 12. Notificaciones

1. **In-app**: tabla `notifications` + badge en la app (canal principal).
2. **Email**: Resend; plantillas: solicitud recibida, aprobada, rechazada, requiere
   corrección, pagaré + calendario adjuntos, recordatorio de pago, comprobante.
3. **Web Push (Fase 6)**: VAPID + service worker para cliente y cobrador.

---

## 13. BI (Administrador)

KPIs: capital colocado/recuperado/pendiente; préstamos activos/nuevos/liquidados/
rechazados/pendientes; cobrado/pendiente/vencido, morosidad %, tasa de recuperación;
multas acumuladas/cobradas/clientes con multas; clientes activos/nuevos/score/recurrencia;
por cobrador: cartera, pagos registrados, cumplimiento, cartera vencida.
Gráficas: tendencia temporal, distribución por zona (Leaflet), tablas de morosidad y riesgo.
Sin librería BI pesada: endpoints de agregación SQL + Recharts.

---

## 14. Estrategia de pruebas

- **Unit (Vitest)**: motor financiero (quote semanal/quincenal, redondeo, último pago,
  multas 1/10 días, pago parcial/anticipado/duplicado, aplicación de pagos, score).
- **Integración (Supertest + MySQL test container)**: API completa, transacciones,
  idempotencia, RBAC.
- **E2E (Playwright)**: onboarding completo (calculadora → lo quiero → registro → docs →
  video → pagaré → solicitud), flujo cobrador, aprobación admin.
- **Seguridad**: fuerza bruta, manipulación de roles, acceso a documentos ajenos.
- **PWA**: instalabilidad, service worker, offline shell.
- **Verificación matemática**: `Σ pagos + ajustes = total` en cada escenario de prueba.

---

## 15. Despliegue y observabilidad

- **CI/CD**: GitHub Actions: lint + test + build; deploy vía SSH a Ubuntu (docker compose up).
- **Healthchecks**: `/health` (liveness) y `/health/ready` (BD/MinIO).
- **Logs**: pino JSON en stdout; docker logging json-file; separación app/security/audit/business.
- **Alertas**: docker healthcheck + email (Fase 8: Prometheus/Grafana opcional).

---

## 16. Roadmap

| Fase | Contenido |
|------|-----------|
| 0 | ✅ Diseño y arquitectura (este documento) |
| 1 | Fundaciones: repo, Docker Compose, MySQL + Prisma, backend NestJS (auth, RBAC, health), frontend Vite + Design System, admin inicial con cambio de contraseña |
| 2 | Cliente: calculadora/quote, onboarding por pasos, documentos, video, pagaré PDF, solicitud + estados |
| 3 | Administrador: clientes, préstamos, cobradores, aprobaciones, correcciones, reglas, multas, score |
| 4 | Cobrador: cartera, pagos (idempotencia), ubicación, llamar/WhatsApp, documentos de campo |
| 5 | BI: KPIs y dashboards |
| 6 | PWA: instalación, push, caching, onboarding guiado |
| 7 | Seguridad y QA completo (auditoría, pruebas, accesibilidad) |
| 8 | Producción: TLS, firewall, backups, monitoring, restauración probada |
| 9 | Escalabilidad: índices, cache, MinIO→R2, revisión de colas |

---

## 17. Decisiones aprobadas (registro de trazabilidad)

| ID | Decisión | Estado |
|----|----------|--------|
| C1 | Folio `ppni-XXXX` (0000–9999) + UUID interno | ✔ Aprobado |
| C2 | Quincenal: 20 semanas, 10 cobros en día de quincena (15/último día), cada cobro = 2 pagos semanales (total/10), multa solo si no paga en su día de quincena | ✔ Aprobado |
| C3 | Contraseña: mín. 8, máx. 64, símbolos, 1 mayúscula + 1 número, Argon2id | ✔ Aprobado |
| C6 | Multa desde el mismo día del vencimiento (sin gracia) | ✔ Aprobado |
| C7 | Orden de pagos: multas → cuota vencida más antigua → cuota vigente | ✔ Aprobado |
| C5 | Dirección completa en onboarding (calle, número, colonia, CP, ciudad, estado, referencias) | ✔ Aprobado |
| C8 | Teléfono como identidad (PK de users), sin flujo de cambio de número | ✔ Aprobado |
| C11 | Firma canvas + nombre + timestamp/IP + video declarativo vinculado | ✔ Aprobado |
| C17b | Video: mínimos técnicos + detección facial MediaPipe en navegador + revisión manual admin | ✔ Aprobado |
| Stack | React+Vite+NestJS+Prisma+MySQL 8+MinIO+Nginx; **solo entornos dev/prod**; **Gmail SMTP (App Password)** como correo; módulo de correo abstraído | ✔ Aprobado |

---

## 18. Notas legales (sin inventar requisitos)

- México: LFPDPPP (aviso de privacidad, consentimiento), Ley de Títulos y Operaciones de
  Crédito (pagaré), Ley Federal de Protección al Consumidor (CAT/transparencia), posible
  análisis de usura. **Recomendación: validación jurídica por abogado** antes de producción;
  el video declarativo y la firma canvas no equivalen a FEA del SAT.