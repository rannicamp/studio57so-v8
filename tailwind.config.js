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
        blue: {
          500: '#3b82f6',
          600: '#2563eb', // Adicionado um tom mais escuro para o hover do botão
          700: '#1d4ed8',
        },
        gray: {
          50: '#f9fafb',
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
        // Fonte padrão continua sendo a do sistema
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif'],
        // Nova família de fontes 'Khand' adicionada
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