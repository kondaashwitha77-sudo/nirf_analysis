/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F8FAFC',
        ink: '#0F172A',
        muted: '#64748B',
        line: '#E2E8F0',
        navy: '#172554',
        deep: '#1E3A8A',
        accent: { DEFAULT: '#2563EB', light: '#3B82F6' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
        pop: '0 8px 24px rgba(15, 23, 42, 0.12)',
      },
      borderRadius: { card: '10px' },
    },
  },
  plugins: [],
}
