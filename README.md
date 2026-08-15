# AppPrestamitos

Plataforma web de préstamos (cliente / cobrador / administrador). Mobile-first, PWA.

## Entornos
- **dev**: `docker compose -f docker-compose.dev.yml up`
- **prod**: `docker compose -f docker-compose.prod.yml up`

## Configuración
Copiar `.env.example` a `.env` y completar credenciales (MySQL, JWT, Gmail SMTP).

## Ejecución (dev)

1. Copiar `.env.example` → `.env` en la raíz y en `api/`, completar credenciales (MySQL, JWT).
2. Compilar el frontend (Nginx sirve `web/dist` como archivos estáticos, no lo construye el compose):
   ```bash
   cd web && npm ci && npm run build
   ```
3. Levantar el stack:
   ```bash
   docker compose -f docker-compose.dev.yml up -d --build
   ```
4. Aplicar las migraciones de Prisma contra la base del compose (una sola vez, o tras cambios de schema):
   ```bash
   cd api && npx prisma migrate deploy
   ```
5. Verificar:
   - Frontend: http://localhost
   - API: http://localhost/api/v1/health y http://localhost/api/v1/health/ready
   - Swagger (solo dev): http://localhost:3000/api/v1/docs
6. Admin inicial: `admin` / `admin` (el sistema obliga a cambiarla en el primer login).

> Nota: el servicio `worker` está definido en el compose desde Fase 1 pero su código (`main-worker.ts`) todavía no existe (multas se calculan en vivo sin cron, ver `project_state.md`). El contenedor se deja **detenido** (`docker compose stop worker`) en vez de reiniciarse en bucle.

## Pruebas

- API: `cd api && npm test` (unitarias) y `npm run test:e2e` (requiere MySQL arriba)
- Web: `cd web && npm test`

## Documentación
- Diseño y arquitectura: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`
- Estado vivo del proyecto (qué está hecho, decisiones tomadas, próximos pasos): `project_state.md`
- API: `http://localhost:3000/api/v1/docs` (Swagger, solo en dev)