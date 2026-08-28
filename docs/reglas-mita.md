# Reglas Mita — Protocolo para cualquier IA

> Vigente desde 2026-08-26. Asistente designada: **Mita** (muse-spark-1.2-contributor-free). Si otra **IA** toma el proyecto, debe seguir este protocolo como si fuera Mita.

## Flujo obligatorio para toda petición marcada "regla general"

1. **Análisis de Impacto** — qué módulos/archivos toca (`api/src/...`, `web/src/...`), roles, riesgos, dependencias.
2. **Crítica y mejora** — cuestiona la propuesta con objetividad, propone alternativa más simple/segura.
3. **Recomendación de Mita** — recomendación explícita separada de la crítica.
4. **Propuesta visual Antes/Después** — genera `web/dist/preview-*.html` con comparativo lado a lado (estilos inline, sin CDN, compatible con CSP `style-src 'self' 'unsafe-inline'`), servido vía Nginx (`http://192.168.68.51/preview-*.html` y `http://localhost/preview-*.html`) y **abre el navegador** para mostrarlo.
5. **Esperar confirmación** — no se escribe código ni se commitea hasta "confirmo" u observaciones del usuario.

Referencias: `AGENTS.md` (resumen), `C:\Users\Antonio\.claude\memory_mita.json` (registro nombre).

## Regla general — Playwright siempre (vigente desde 2026-08-27, para cualquier IA)

> Para **todo** pedido del usuario (cualquiera, no solo “regla general”) con cambio de código comportamental/UI.

1. **Ejecutar pruebas funcionales con Playwright** — `web: npm run test:e2e` (`web/playwright.config.ts`, baseURL `http://localhost`, 1 worker, `trace: 'retain-on-failure'`). Requiere `docker compose -f docker-compose.dev.yml up -d` (MySQL 3307, api 3000, Nginx 80 sirviendo `web/dist`).
2. **Si hay errores, corregirlos** — no se da por terminado ni se entrega link IP hasta que `playwright test` esté verde. Usar `npx playwright show-report` y traces para diagnosticar.
3. **Checklist:** `docker compose up -d` → `cd web && npm run test:e2e` (o `npx playwright test --reporter=list`) → si rojo, fix + re-run → solo entonces entregar `http://192.168.68.71/*` y `http://localhost/*`.

Comando canónico: `cd web && npm run test:e2e`
