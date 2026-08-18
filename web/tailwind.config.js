/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // primary y danger ajustados desde el tono original de marca (#0F8B5F /
        // #D64545) — ese tono daba ~4.3:1 contra blanco, insuficiente para
        // WCAG AA (4.5:1) en texto/botones. Este tono pasa 4.5:1 en todos los
        // contextos donde se usa como texto (blanco, primary-light, bg-red-50).
        primary: { DEFAULT: '#0B7550', dark: '#0A6B49', light: '#E6F4EE' },
        secondary: { DEFAULT: '#1B2A4A', dark: '#121D35' },
        success: '#1A9E63',
        warning: '#F5A623',
        danger: '#C63A3A',
        score: { red: '#C63A3A', orange: '#F2802A', yellow: '#F5A623', green: '#1A9E63' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: { 4.5: '1.125rem' },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
}
