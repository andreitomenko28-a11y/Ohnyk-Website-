/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Ohnyk design system — all colours are theme-driven CSS variables.
      colors: {
        // Semantic surfaces / text
        canvas: 'var(--bg)',
        surface: 'var(--surface)',
        elevated: 'var(--elevated)',
        fg: 'var(--fg)',
        line: 'var(--line)',
        star: 'var(--star)',
        'on-accent': 'var(--on-accent)',
        // Accent + legacy aliases (kept so existing classes stay themed)
        ember: 'var(--ember)',
        'ember-dark': 'var(--ember-dark)',
        glow: 'var(--glow)',
        soot: 'var(--fg)', // legacy alias → foreground
        linen: 'var(--bg)', // legacy alias → page background
      },
      fontFamily: {
        brand: ['Poiret One', 'sans-serif'],
        display: ['Comfortaa', 'sans-serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
      },
      boxShadow: {
        card: 'var(--card-shadow)',
        nav: 'var(--nav-shadow)',
      },
    },
  },
  plugins: [],
};
