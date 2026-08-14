/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0F8B5F', dark: '#0A6B49', light: '#E6F4EE' },
        secondary: { DEFAULT: '#1B2A4A', dark: '#121D35' },
        success: '#1A9E63',
        warning: '#F5A623',
        danger: '#D64545',
        score: { red: '#D64545', orange: '#F2802A', yellow: '#F5A623', green: '#1A9E63' },
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
