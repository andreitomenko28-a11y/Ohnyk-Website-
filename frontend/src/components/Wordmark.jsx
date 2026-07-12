import { useId } from 'react';

// Ohnyk wordmark — fully vector (no font): sharp open "O" (bottom cut),
// monoline h/n/y/k, short "y" tail with an orange accent. Cream parts use
// currentColor so the mark adapts to the theme; the accent stays ember.
const O_PATH =
  'M 39.8 88.3 L 37.8 88.1 L 35.9 87.8 L 33.9 87.4 L 32.0 86.9 L 30.1 86.3 L 28.2 85.6 L 26.3 84.8 L 24.5 83.9 L 22.6 82.9 L 20.8 81.8 L 19.1 80.6 L 17.4 79.4 L 15.9 77.8 L 14.6 76.2 L 13.4 74.4 L 12.3 72.7 L 11.2 70.8 L 10.3 68.9 L 9.4 67.0 L 8.7 65.0 L 8.0 63.0 L 7.4 61.0 L 6.9 59.0 L 6.5 56.9 L 6.3 54.8 L 6.1 52.7 L 6.0 50.6 L 6.0 48.5 L 6.2 46.4 L 6.4 44.3 L 6.7 42.2 L 7.1 40.1 L 7.7 38.1 L 8.3 36.0 L 9.0 34.1 L 9.8 32.1 L 10.7 30.2 L 11.7 28.3 L 12.8 26.5 L 14.0 24.8 L 15.2 23.1 L 16.5 21.4 L 18.0 19.9 L 19.4 18.3 L 21.0 16.9 L 22.6 15.6 L 24.3 14.3 L 26.0 13.1 L 27.8 12.0 L 29.7 11.0 L 31.6 10.0 L 33.5 9.2 L 35.5 8.5 L 37.5 7.8 L 39.5 7.3 L 41.6 6.8 L 43.7 6.5 L 45.8 6.2 L 47.9 6.1 L 50.0 6.0 L 52.1 6.1 L 54.2 6.2 L 56.3 6.5 L 58.4 6.8 L 60.5 7.3 L 62.5 7.8 L 64.5 8.5 L 66.5 9.2 L 68.4 10.0 L 70.3 11.0 L 72.2 12.0 L 74.0 13.1 L 75.7 14.3 L 77.4 15.6 L 79.0 16.9 L 80.6 18.3 L 82.0 19.9 L 83.5 21.4 L 84.8 23.1 L 86.0 24.8 L 87.2 26.5 L 88.3 28.3 L 89.3 30.2 L 90.2 32.1 L 91.0 34.1 L 91.7 36.0 L 92.3 38.1 L 92.9 40.1 L 93.3 42.2 L 93.6 44.3 L 93.8 46.4 L 94.0 48.5 L 94.0 50.6 L 93.9 52.7 L 93.7 54.8 L 93.5 56.9 L 93.1 59.0 L 92.6 61.0 L 92.0 63.0 L 91.3 65.0 L 90.6 67.0 L 89.7 68.9 L 88.8 70.8 L 87.7 72.7 L 86.6 74.4 L 85.4 76.2 L 84.1 77.8 L 82.6 79.4 L 80.9 80.6 L 79.2 81.8 L 77.4 82.9 L 75.5 83.9 L 73.7 84.8 L 71.8 85.6 L 69.9 86.3 L 68.0 86.9 L 66.1 87.4 L 64.1 87.8 L 62.2 88.1 L 60.2 88.3 L 60.2 88.3 L 62.0 87.4 L 63.6 86.4 L 65.2 85.4 L 66.7 84.3 L 68.2 83.2 L 69.6 81.9 L 70.9 80.7 L 72.1 79.4 L 73.3 78.0 L 74.3 76.6 L 75.3 75.1 L 76.3 73.6 L 77.3 72.3 L 78.3 70.9 L 79.3 69.6 L 80.2 68.1 L 81.0 66.7 L 81.8 65.2 L 82.5 63.6 L 83.1 62.0 L 83.6 60.4 L 84.1 58.8 L 84.5 57.2 L 84.8 55.5 L 85.0 53.8 L 85.1 52.1 L 85.2 50.5 L 85.2 48.8 L 85.1 47.1 L 84.9 45.4 L 84.6 43.7 L 84.3 42.1 L 83.9 40.4 L 83.4 38.8 L 82.8 37.2 L 82.2 35.7 L 81.4 34.2 L 80.6 32.7 L 79.8 31.2 L 78.8 29.8 L 77.8 28.4 L 76.8 27.1 L 75.6 25.9 L 74.5 24.7 L 73.2 23.5 L 71.9 22.5 L 70.6 21.4 L 69.2 20.5 L 67.7 19.6 L 66.3 18.8 L 64.7 18.0 L 63.2 17.4 L 61.6 16.8 L 60.0 16.2 L 58.4 15.8 L 56.7 15.4 L 55.1 15.2 L 53.4 15.0 L 51.7 14.8 L 50.0 14.8 L 48.3 14.8 L 46.6 15.0 L 44.9 15.2 L 43.3 15.4 L 41.6 15.8 L 40.0 16.2 L 38.4 16.8 L 36.8 17.4 L 35.3 18.0 L 33.7 18.8 L 32.3 19.6 L 30.8 20.5 L 29.4 21.4 L 28.1 22.5 L 26.8 23.5 L 25.5 24.7 L 24.4 25.9 L 23.2 27.1 L 22.2 28.4 L 21.2 29.8 L 20.2 31.2 L 19.4 32.7 L 18.6 34.2 L 17.8 35.7 L 17.2 37.2 L 16.6 38.8 L 16.1 40.4 L 15.7 42.1 L 15.4 43.7 L 15.1 45.4 L 14.9 47.1 L 14.8 48.8 L 14.8 50.5 L 14.9 52.1 L 15.0 53.8 L 15.2 55.5 L 15.5 57.2 L 15.9 58.8 L 16.4 60.4 L 16.9 62.0 L 17.5 63.6 L 18.2 65.2 L 19.0 66.7 L 19.8 68.1 L 20.7 69.6 L 21.7 70.9 L 22.7 72.3 L 23.7 73.6 L 24.7 75.1 L 25.7 76.6 L 26.7 78.0 L 27.9 79.4 L 29.1 80.7 L 30.4 81.9 L 31.8 83.2 L 33.3 84.3 L 34.8 85.4 L 36.4 86.4 L 38.0 87.4 L 39.8 88.3 Z';

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
