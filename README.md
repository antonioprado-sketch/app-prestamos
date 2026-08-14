# AppPrestamitos

Plataforma web de préstamos (cliente / cobrador / administrador). Mobile-first, PWA.

## Entornos
- **dev**: `docker compose -f docker-compose.dev.yml up`
- **prod**: `docker compose -f docker-compose.prod.yml up`

## Configuración
Copiar `.env.example` a `.env` y completar credenciales (MySQL, JWT, Gmail SMTP).

## Documentación
- Diseño y arquitectura: `docs/superpowers/specs/2026-08-13-app-prestamos-design.md`
- API: `http://localhost:3000/api/v1/docs` (Swagger, solo en dev)