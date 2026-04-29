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
      },
    },
  },
  plugins: [],
};
