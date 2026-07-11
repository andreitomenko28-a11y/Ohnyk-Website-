/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Ohnyk design system.
      colors: {
        soot: '#241E1B',
        linen: '#FAF3EA',
        ember: '#D46A3B',
        'ember-dark': '#B8532A',
        glow: '#F2A65A',
      },
      fontFamily: {
        display: ['Comfortaa', 'sans-serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        card: '18px',
      },
      boxShadow: {
        card: '0 20px 50px -30px rgba(36,30,27,0.35)',
        nav: '0 -10px 30px -20px rgba(36,30,27,0.3)',
      },
    },
  },
  plugins: [],
};
