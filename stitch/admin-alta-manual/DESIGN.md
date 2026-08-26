---
name: Admin Alta Manual Prestamitos
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474e'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#75777f'
  outline-variant: '#c5c6cf'
  surface-tint: '#4e5e82'
  primary: '#031636'
  on-primary: '#ffffff'
  primary-container: '#1a2b4c'
  on-primary-container: '#8293ba'
  inverse-primary: '#b6c6f0'
  secondary: '#00629d'
  on-secondary: '#ffffff'
  secondary-container: '#00a2fd'
  on-secondary-container: '#003558'
  tertiary: '#141819'
  on-tertiary: '#ffffff'
  tertiary-container: '#292c2e'
  on-tertiary-container: '#909395'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#b6c6f0'
  on-primary-fixed: '#071b3b'
  on-primary-fixed-variant: '#364669'
  secondary-fixed: '#cfe5ff'
  secondary-fixed-dim: '#98cbff'
  on-secondary-fixed: '#001d33'
  on-secondary-fixed-variant: '#004a77'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
---

## Brand & Style — Admin Alta Manual

Mismo sistema que `stitch/cliente` (Modern Minimalist, alta confianza fintech) pero para **admin en desktop** dentro de `AdminShell` (sidebar azul navy `#031636`, contenido `bg-surface`). Reutiliza tokens Tailwind de `tailwind.config.js` (`primary #031636`, `secondary-container #00A2FD`, `accent #00629D`, `surface-container-lowest #FFFFFF`, sombras `level-2 0px 4px 20px rgba(26,43,76,0.05)`). Mobile-first pero optimizado a `max-w-2xl` centrado.

Objetivo: admin da de alta préstamo manual para clientes de papel — **respeta automatización existente** (40% plano, semanal 20 abonos, quincenal 10 abonos día 15/último, último abono absorbe centavos, fechas con `timeZone America/Mexico_City`). Solo captura `monto + modelo + fecha apertura pasada`; el resto se calcula solo.

## Pantallas a diseñar (3 vistas, mismo flujo)

### 1) Admin / Nuevo préstamo manual (`/admin/prestamos/nuevo`)

**Header dentro de AdminShell:** título `headline-lg-mobile` "Nuevo préstamo manual" + subtítulo `body-sm` "Da de alta un préstamo de papel. El cálculo respeta tus reglas (40% / semanal 20 / quincenal 10)."

**Sección 1 — Cliente (Card `surface-container-lowest` p-md rounded-xl shadow-level-2):**
- Input búsqueda teléfono/nombre con ícono `search` (placeholder "5512345678 o nombre"), botón `ghost` "Buscar"
- Resultado: avatar inicial + nombre + teléfono + `isNewCustomer` pill
- Si no existe: CTA inline "Alta rápida" → expande mini-form (tel + nombre) que crea `Customer` y lo selecciona

**Sección 2 — Préstamo (Card):**
- **Monto solicitado:** label + `data-lg` `$12,500`, slider `type=range` `min 500 max 20000 step 500` (track `surface-container-high`, thumb `secondary-container 22px`), "Mín $500 / Máx $20k", hint `body-sm` "Múltiplo de $500"
- **Modelo:** tabs segmentados `Semanal (20)` / `Quincenal (10)` como `radiogroup` (activo `bg-secondary-container text-on-secondary-container`)
- **Fecha de apertura:** botón `outline` que abre **Modal Calendario** (ver punto 2), muestra `vie 15/Ago/2025` seleccionado, hint "Puede ser pasada (préstamo de papel)"
- **Preview en vivo:** Card `border outline-variant` con `label-md` "Resumen calculado" + grid 3 cols: `Total $17,500`, `Intereses $5,000`, `Abono $875`, y tabla calendario `ScheduleSummary` (seq | fecha `vie 15/Ago/2025` | abono `$875` | saldo pendiente) — scroll max-h 280px

**CTA fijo bottom (como `CalculatorPage`):** `fixed bottom-0` con gradiente `surface`, botón `primary` full-width `Crear préstamo (DRAFT)` + spinner `loading` + error `Alert` si valida

### 2) Modal — Fecha de apertura

Overlay `bg-black/60`, Card `max-w-sm`-centered, `level-3` shadow.
- Header `headline-md` "Fecha de apertura" + `×` cerrar
- `<input type=date>` nativo + chips rápidos "Hoy" / "Hace 7 días" / "Hace 30 días"
- Footer 2 botones: `ghost` Cancelar, `primary` Confirmar
- Validación inline `Alert error` si fecha futura muy lejana o < 2020

### 3) Admin / Detalle préstamo — Cargar historial papel (`/admin/prestamos/:id` o tab en `/admin/solicitudes` expandido)

Solo visible si `status APPROVED/ACTIVE` y `openingDate` en pasado. Card `border outline-variant` dentro del detalle expandido:
- Header `label-md` "Historial papel — abonos ya dados" + badge `APPROVED`/`ACTIVE`
- Tabla abonos con `seq | fecha vencimiento | abono | pagado | estado (PENDIENTE/VENCIDO/PAGADO con dot `score.green/yellow/orange`)`
- Lista pagos históricos ya cargados: `fecha pago | monto | nota "migración papel" | creador`
- Botón `primary` "Añadir abono histórico" → **Modal Abono** (ver siguiente)
- Empty state si 0 pagos: `body-sm` "Sin abonos históricos. Cárgalos uno por uno en orden cronológico."

**Modal — Añadir abono histórico**
- Inputs: fecha pago `type=date` (max hoy, min openingDate), monto `number` prellenado con remanente siguiente cuota no PAGADO (ej `$875`), nota `text` opcional
- Validación: fecha debe ser cronológica (≥ último pago), monto >0
- Footer: Cancelar + `primary` "Registrar abono" con `loading`

## Componentes y tokens

- Reusar `Button` (`primary #031636` / `ghost`), `Input`, `Card`, `Alert`, `Spinner`, `Icon` (`material-symbols-outlined`)
- Slider: `appearance:none`, thumb `00A2FD` 22px borde blanco 2px, track `DCE9FF` 6px, `hide-scrollbar` para chips
- Tabla: `text-secondary`, `font-mono` para montos, `border-gray-100`
- Estados: `success #1A9E63` / `warning #F5A623` / `danger #BA1A1A` para dots y pills

## Interacciones

- Monto/modelo/fecha con debounce 300ms recalcula preview (usa `calculateQuote` del backend para fechas exactas — mock puede usar JS local para preview)
- Crear préstamo: POST, si éxito muestra `Alert success` + link "Ver préstamo"
- Añadir abono: POST histórico 1x1, si éxito recarga tabla y actualiza `saldo pendiente`/`progreso %`
- Bypass tope: si monto supera tope por score, no bloquear — mostrar `Alert warning` "Supera tope de $3,000 pero se creará porque ya lo aprobaste"

## Archivos esperados de stitch

- `stitch/admin-alta-manual/DESIGN.md` (este archivo)
- `stitch/admin-alta-manual/code.html` — mock HTML de las 3 vistas (puede ser single file con tabs o 3 sections)
- `stitch/admin-alta-manual/screen.png` — captura 390x844 + 1280x800

Genera el HTML con Tailwind via CDN y usa los tokens hex de arriba tal cual. No uses imágenes externas fuera de `material-symbols-outlined` + Inter (Google Fonts).
