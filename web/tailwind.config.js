/** @type {import('tailwindcss').Config} */
// Sistema de diseño stitch (Material 3) — aplicado fielmente a la app.
//
// Mapeo semántico vs el mock "LendWise":
//   - `primary`   = color principal (navy oscuro #031636): botones, sidebar, énfasis.
//   - `secondary` = se conserva como color de texto principal (on-surface #0B1C30)
//                   porque la app lo usa a gran escala para cuerpo de texto.
//   - `accent`    = el "secondary" del mock (#00629D): azul medio para links/KPI.
//   - `secondary-container` = azul brillante #00A2FD: barras de progreso, activo.
//   - `surface*` / `on-surface*` / `outline*` = superficies Material del mock.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#031636', dark: '#01111F', light: '#E6EEF8' },
        secondary: { DEFAULT: '#0B1C30', dark: '#071224' },
        accent: { DEFAULT: '#00629D', dark: '#004A75', light: '#CFE5FF' },
        'secondary-container': '#00A2FD',
        'on-secondary-container': '#031636',
        'secondary-fixed': '#CFE5FF',
        'on-secondary-fixed': '#001D33',
        surface: {
          DEFAULT: '#F8F9FF',
          'container-lowest': '#FFFFFF',
          'container-low': '#EFF4FF',
          container: '#E5EEFF',
          'container-high': '#DCE9FF',
          'container-highest': '#D3E4FE',
        },
        'on-surface': { DEFAULT: '#0B1C30', variant: '#44474E' },
        outline: { DEFAULT: '#75777F', variant: '#C5C6CF' },
        success: '#1A9E63',
        'success-container': 'rgba(26, 158, 99, 0.10)',
        warning: '#F5A623',
        'warning-container': 'rgba(245, 158, 11, 0.10)',
        danger: '#BA1A1A',
        error: '#BA1A1A',
        'error-container': '#FFDAD6',
        'on-error-container': '#410002',
        'on-secondary-fixed-variant': '#004A77',
        'inverse-surface': '#213145',
        score: { red: '#BA1A1A', orange: '#F2802A', yellow: '#F5A623', green: '#1A9E63' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '56px', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'data-lg': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        'body-md': ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        'label-md': ['14px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.05em' }],
      },
      spacing: {
        4.5: '1.125rem',
        base: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
        gutter: '16px',
        'margin-mobile': '16px',
        'margin-desktop': '32px',
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        'level-2': '0px 4px 20px rgba(26, 43, 76, 0.05)',
        'level-3': '0px 12px 32px rgba(26, 43, 76, 0.12)',
      },
    },
  },
  plugins: [],
}
