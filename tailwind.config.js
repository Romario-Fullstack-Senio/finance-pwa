/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          cyan: '#22d3ee',
          indigo: '#6366f1',
          rose: '#fb7185',
        },
        // Definidos en src/styles.css; los gráficos leen las mismas variables
        income: 'var(--color-income)',
        fixed: 'var(--color-fixed)',
        variable: 'var(--color-variable)',
        savings: 'var(--color-savings)',
        available: 'var(--color-available)',
        good: 'var(--color-good)',
        warning: 'var(--color-warning)',
        critical: 'var(--color-critical)',
      },
    },
  },
  plugins: [],
};
