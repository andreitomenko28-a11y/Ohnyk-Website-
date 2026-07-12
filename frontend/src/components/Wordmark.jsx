import { useId } from 'react';

// Ohnyk wordmark — fully vector (no font): sharp open "O" (bottom cut),
// monoline h/n/y/k, short "y" tail with an orange accent. Cream parts use
// currentColor so the mark adapts to the theme; the accent stays ember.
const O_PATH =
  'M 46.0 87.8 L 45.3 94.3 L 40.4 93.5 L 35.6 92.1 L 31.0 90.2 L 26.6 87.8 L 22.5 85.0 L 18.7 81.6 L 15.4 77.9 L 12.4 73.9 L 10.0 69.5 L 8.1 64.9 L 6.7 60.1 L 5.8 55.2 L 5.5 50.2 L 5.8 45.2 L 6.6 40.2 L 8.0 35.4 L 9.9 30.8 L 12.3 26.4 L 15.1 22.3 L 18.5 18.6 L 22.2 15.3 L 26.3 12.4 L 30.6 9.9 L 35.3 8.0 L 40.1 6.6 L 45.0 5.8 L 50.0 5.5 L 55.0 5.8 L 59.9 6.6 L 64.7 8.0 L 69.4 9.9 L 73.7 12.4 L 77.8 15.3 L 81.5 18.6 L 84.9 22.3 L 87.7 26.4 L 90.1 30.8 L 92.0 35.4 L 93.4 40.2 L 94.2 45.2 L 94.5 50.2 L 94.2 55.2 L 93.3 60.1 L 91.9 64.9 L 90.0 69.5 L 87.6 73.9 L 84.6 77.9 L 81.3 81.6 L 77.5 85.0 L 73.4 87.8 L 69.0 90.2 L 64.4 92.1 L 59.6 93.5 L 54.7 94.3 L 54.0 87.8 L 53.3 81.3 L 56.8 80.8 L 60.2 79.8 L 63.5 78.5 L 66.6 76.8 L 69.5 74.7 L 72.1 72.4 L 74.5 69.8 L 76.6 66.9 L 78.3 63.8 L 79.7 60.5 L 80.7 57.1 L 81.3 53.7 L 81.5 50.1 L 81.3 46.6 L 80.7 43.1 L 79.8 39.7 L 78.4 36.4 L 76.7 33.3 L 74.7 30.4 L 72.3 27.8 L 69.7 25.4 L 66.8 23.4 L 63.7 21.6 L 60.4 20.3 L 57.0 19.3 L 53.5 18.7 L 50.0 18.5 L 46.5 18.7 L 43.0 19.3 L 39.6 20.3 L 36.3 21.6 L 33.2 23.4 L 30.3 25.4 L 27.7 27.8 L 25.3 30.4 L 23.3 33.3 L 21.6 36.4 L 20.2 39.7 L 19.3 43.1 L 18.7 46.6 L 18.5 50.1 L 18.7 53.7 L 19.3 57.1 L 20.3 60.5 L 21.7 63.8 L 23.4 66.9 L 25.5 69.8 L 27.9 72.4 L 30.5 74.7 L 33.4 76.8 L 36.5 78.5 L 39.8 79.8 L 43.2 80.8 L 46.7 81.3 Z';

export default function Wordmark({ className = '' }) {
  const uid = useId().replace(/:/g, '');
  const acc = `ohnyk-acc-${uid}`;
  return (
    <svg
      viewBox="0 0 620 210"
      className={className}
      role="img"
      aria-label="Ohnyk"
      style={{ height: '1.12em', width: 'auto', display: 'inline-block', color: 'var(--brand-ink)' }}
    >
      <defs>
        <linearGradient id={acc} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F5A11F" />
          <stop offset="42%" stopColor="#F6A82E" />
          <stop offset="100%" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <path transform="translate(12 3) scale(1.66)" d={O_PATH} fill="currentColor" />
      <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
        {/* h — a hair thinner, smoother shoulder */}
        <path d="M178 12 L178 150" strokeWidth="12" />
        <path d="M178 86 C180 66 196 57 216 57 C236 57 246 70 246 90 L246 150" strokeWidth="12" />
        {/* n — narrower, tucked in closer */}
        <path d="M280 57 L280 150" />
        <path d="M280 80 C282 64 296 57 313 57 C331 57 341 68 341 88 L341 150" />
        {/* y — longer, more calligraphic descender */}
        <path d="M374 57 L410 128" />
        <path d="M446 57 C443 92 435 122 423 143 C414 160 403 169 392 173" />
        {/* k — thinner arm, longer softer leg */}
        <path d="M478 12 L478 150" />
        <path d="M536 57 L486 104" strokeWidth="11" />
        <path d="M492 100 L546 152" />
      </g>
      <path d="M446 57 C444 78 441 92 439 101" fill="none" stroke={`url(#${acc})`} strokeWidth="12" strokeLinecap="round" />
    </svg>
  );
}
