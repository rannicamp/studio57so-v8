/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#45301f',
        blue: {
          500: '#3b82f6',
          600: '#2563eb', 
          700: '#1d4ed8',
        },
        gray: {
          // 👇 AQUI ESTÁ A MÁGICA! 
          // Substituímos o cinza clarinho (#f9fafb) por BRANCO PURO (#ffffff).
          // Agora todo 'bg-gray-50' será visualmente branco.
          50: '#ffffff', 
          
          // Mantemos os outros tons para bordas e textos
          100: '#f3f4f6', // (Opcional: mantive o padrão, ou mude para #ffffff se quiser matar o 100 também)
          200: '#e5e7eb',
          300: '#d1d5db',
          500: '#6b7280',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        red: {
          500: '#ef4444',
          600: '#dc2626',
        },
        green: {
          500: '#22c55e',
          600: '#16a34a',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif'],
        khand: ['Khand', 'sans-serif'],
      },
      borderRadius: {
        md: '0.375rem',
        lg: '0.5rem',
      },
    },
  },
  plugins: [],
};