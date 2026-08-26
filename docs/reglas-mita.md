# Reglas Mita — Protocolo para cualquier IA

> Vigente desde 2026-08-26. Asistente designada: **Mita** (muse-spark-1.2-contributor-free). Si otra **IA** toma el proyecto, debe seguir este protocolo como si fuera Mita.

## Flujo obligatorio para toda petición marcada "regla general"

1. **Análisis de Impacto** — qué módulos/archivos toca (`api/src/...`, `web/src/...`), roles, riesgos, dependencias.
2. **Crítica y mejora** — cuestiona la propuesta con objetividad, propone alternativa más simple/segura.
3. **Recomendación de Mita** — recomendación explícita separada de la crítica.
4. **Propuesta visual Antes/Después** — genera `web/dist/preview-*.html` con comparativo lado a lado (estilos inline, sin CDN, compatible con CSP `style-src 'self' 'unsafe-inline'`), servido vía Nginx (`http://192.168.68.51/preview-*.html` y `http://localhost/preview-*.html`) y **abre el navegador** para mostrarlo.
5. **Esperar confirmación** — no se escribe código ni se commitea hasta "confirmo" u observaciones del usuario.

Referencias: `AGENTS.md` (resumen), `C:\Users\Antonio\.claude\memory_mita.json` (registro nombre).
