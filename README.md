# AppPrestamitos

Plataforma web de préstamos personales (cliente / cobrador / administrador). Mobile-first, PWA.

## Funcionalidades por rol

- **Cliente** — landing/calculadora pública (slider de $500 en $500, tope $20,000, tabs Semanal/Quincenal), registro, onboarding (datos + fotos de documentos **solo con cámara** + video de identidad), firma de pagaré en pantalla (con fecha histórica para migrados), home con **saldo pendiente / próximo pago / progreso % / score** y seguimiento de préstamos, topes por color de score configurables y flujo **"Aumentar mi crédito"** (historial de pagos visible como avance en el home y en el calendario por cuota).
- **Cobrador** — cartera de préstamos asignados, cobro con monto precargado y modales "+/-" para sumar cuotas (sin edición manual), evidencia de cobro, ubicación del cliente, resolución de aumentos de crédito.
- **Administrador** — BI (KPIs, tendencia semanal, distribución por zona), revisión/aprobación de solicitudes, asignación de cobradores, gestión de clientes y usuarios (rol/status/reset de contraseña), configuración de reglas de negocio y correo SMTP, mapa de ubicaciones y aumentos de crédito.

Detalle pantalla por pantalla en `docs/user-guide.md`.

## Entornos
- **dev**: `docker compose -f docker-compose.dev.yml up`
- **prod**: `docker compose -f docker-compose.prod.yml up`

## Configuración
Copiar `.env.example` a `.env` y completar credenciales (MySQL, JWT, Gmail SMTP).

## Ejecución (dev)

1. Copiar `.env.example` → `.env` en la raíz y en `api/`, completar credenciales (MySQL, JWT).
2. Web Push (notificaciones): generar un par de claves VAPID una sola vez y usarlas en los tres lados —
   ```bash
   cd api && npx web-push generate-vapid-keys
   ```
   Pegar `Public Key`/`Private Key` en `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` de `.env` (raíz) y de `api/.env`, y la misma `Public Key` en `VITE_VAPID_PUBLIC_KEY` de `web/.env` (copiar antes desde `web/.env.example`). Sin esto, el envío de push se simula (log) en vez de fallar — no bloquea el resto de la app.
   Correo (Gmail SMTP): las credenciales se configuran desde el panel admin (Reglas de negocio → Correo), no hace falta tocar `.env` para eso. Sí es obligatorio `EMAIL_ENCRYPTION_KEY` en `.env` (raíz) y en `api/.env` — es la clave que cifra la contraseña guardada, generar una vez con `openssl rand -base64 32` y no perderla (si cambia, las credenciales ya guardadas dejan de poder desencriptarse).
3. Compilar el frontend (Nginx sirve `web/dist` como archivos estáticos, no lo construye el compose):
   ```bash
   cd web && npm ci && npm run build
   ```
4. Levantar el stack:
   ```bash
   docker compose -f docker-compose.dev.yml up -d --build
   ```
5. Aplicar las migraciones de Prisma contra la base del compose (una sola vez, o tras cambios de schema):
   ```bash
   cd api && npx prisma migrate deploy
   ```
6. Verificar:
   - Frontend: http://localhost
   - API: http://localhost/api/v1/health y http://localhost/api/v1/health/ready
   - Swagger (solo dev): http://localhost:3000/api/v1/docs
7. Admin inicial: `admin` / `admin` (el sistema obliga a cambiarla en el primer login).

> Nota: el servicio `worker` está definido en el compose desde Fase 1 pero su código (`main-worker.ts`) todavía no existe (multas se calculan en vivo sin cron, ver `project_state.md`). El contenedor se deja **detenido** (`docker compose stop worker`) en vez de reiniciarse en bucle.

## Despliegue (producción)

El destino de producción es un **VPS de Hostinger** (no GitHub Pages ni ningún hosting estático) — la app es un stack Docker completo (API + frontend + MySQL + MinIO + Nginx), no un sitio estático.

- El CI de GitHub Actions (`ci.yml`) **solo valida** (build, lint, tests, e2e de navegador) — no despliega nada.
- En el VPS se corre el entorno de producción: `docker compose -f docker-compose.prod.yml up -d --build` + migraciones (`cd api && npx prisma migrate deploy`). Requiere los mismos `.env` (MySQL, JWT, MinIO, VAPID, `EMAIL_ENCRYPTION_KEY`) y TLS vía Nginx (certificado en el VPS; ver `docker/nginx/nginx.prod.conf`).
- Pendiente de Fase 8 del roadmap: TLS/HTTPS real en el VPS, firewall, backups de MySQL + MinIO con restauración probada, y exponer MinIO tras un proxy para que las URLs firmadas funcionen fuera de dev (documentado en `.env.example`).

## En planeación

- **Fases 6-9 del roadmap general** (PWA completa con HTTPS, seguridad/QA final, producción en el VPS, escalabilidad) — ver `project_state.md`.
- Los tres puntos de UX de cliente/cobrador/landing ya implementados (cortes 15-17): fotos de documentos solo con cámara `getUserMedia`, cobrador con monto precargado y modales "+/-", y calculadora como landing pública con slider de $500, topes por color de score configurables y flujo "Aumentar mi crédito".
- `stitch/` conserva el diseño de referencia actual del cliente (`stitch/cliente/`); el resto de mocks antiguos ya se eliminó del repo.

## Pruebas

- API: `cd api && npm test` (unitarias) y `npx jest --config ./test/jest-e2e.json --runInBand` (e2e, requiere MySQL arriba — el script `npm run test:e2e` sin `--runInBand` corre en paralelo y puede fallar por una carrera en el bootstrap del admin)
- Web: `cd web && npm test` (unitarias, Vitest)
- Web e2e navegador real: `cd web && npm run test:e2e` (Playwright/Chromium) — requiere el stack de Docker arriba (`docker compose -f docker-compose.dev.yml up -d`) y `web/dist` compilado (`npm run build`), corre contra `http://localhost` (Nginx), no contra `vite dev`

## Documentación
- **Arquitectura técnica** (componentes, modelo de datos, flujos de negocio, decisiones): `docs/architecture.md`
- **Referencia de API** (todos los endpoints, auth, errores): `docs/api-reference.md`
- **Guía de usuario por rol** (cliente / cobrador / administrador): `docs/user-guide.md`
- Diseño y arquitectura original (spec): `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`
- Estado vivo del proyecto (qué está hecho, decisiones tomadas, próximos pasos): `project_state.md`
- Resumen narrativo del historial de desarrollo (portable entre máquinas, para claude-mem): `cmem.md`
- API interactiva: `http://localhost:3000/api/v1/docs` (Swagger, solo en dev)