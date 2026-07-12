// Ohnyk wordmark — custom open "O" (with a bottom cut) + "hnyk" in Poiret One
// + an orange accent on the "y". Scales with font-size; cream parts inherit
// currentColor so it adapts to the theme. Styles live in styles/index.css.
export default function Wordmark({ className = '' }) {
  return (
    <span className={`brand-lockup ${className}`} role="img" aria-label="Ohnyk">
      <svg className="brand-o" viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="M37.02 89.94 A42 42 0 1 1 62.98 89.94"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </svg>
      <span className="brand-hnyk" aria-hidden="true">
        hnyk
      </span>
      <span className="brand-yacc" aria-hidden="true" />
    </span>
  );
}
