import { useId } from 'react';

// Ohnyk wordmark — fully vector (no font): sharp open "O" (bottom cut),
// monoline h/n/y/k, short "y" tail with an orange accent. Cream parts use
// currentColor so the mark adapts to the theme; the accent stays ember.
const O_PATH =
  'M 44.1 89.2 L 42.1 89.2 L 40.1 89.1 L 38.0 88.9 L 36.0 88.6 L 33.9 88.2 L 31.9 87.7 L 29.9 87.1 L 27.8 86.3 L 25.9 85.5 L 23.9 84.5 L 22.0 83.5 L 20.1 82.3 L 18.5 80.8 L 17.0 79.1 L 15.6 77.5 L 14.3 75.7 L 13.1 73.9 L 11.9 72.0 L 10.9 70.1 L 9.9 68.1 L 9.1 66.1 L 8.3 64.0 L 7.7 61.9 L 7.1 59.8 L 6.7 57.7 L 6.3 55.5 L 6.1 53.3 L 6.0 51.1 L 6.0 48.9 L 6.1 46.7 L 6.3 44.6 L 6.7 42.4 L 7.1 40.2 L 7.6 38.1 L 8.3 36.0 L 9.0 33.9 L 9.9 31.9 L 10.8 29.9 L 11.9 28.0 L 13.0 26.1 L 14.3 24.3 L 15.6 22.6 L 17.0 20.9 L 18.5 19.3 L 20.1 17.8 L 21.7 16.3 L 23.4 14.9 L 25.2 13.7 L 27.0 12.5 L 28.9 11.4 L 30.9 10.4 L 32.9 9.5 L 34.9 8.7 L 37.0 8.0 L 39.1 7.4 L 41.3 6.9 L 43.4 6.5 L 45.6 6.2 L 47.8 6.1 L 50.0 6.0 L 52.2 6.1 L 54.4 6.2 L 56.6 6.5 L 58.7 6.9 L 60.9 7.4 L 63.0 8.0 L 65.1 8.7 L 67.1 9.5 L 69.1 10.4 L 71.1 11.4 L 73.0 12.5 L 74.8 13.7 L 76.6 14.9 L 78.3 16.3 L 79.9 17.8 L 81.5 19.3 L 83.0 20.9 L 84.4 22.6 L 85.7 24.3 L 87.0 26.1 L 88.1 28.0 L 89.2 29.9 L 90.1 31.9 L 91.0 33.9 L 91.7 36.0 L 92.4 38.1 L 92.9 40.2 L 93.3 42.4 L 93.7 44.6 L 93.9 46.7 L 94.0 48.9 L 94.0 51.1 L 93.9 53.3 L 93.7 55.5 L 93.3 57.7 L 92.9 59.8 L 92.3 61.9 L 91.7 64.0 L 90.9 66.1 L 90.1 68.1 L 89.1 70.1 L 88.1 72.0 L 86.9 73.9 L 85.7 75.7 L 84.4 77.5 L 83.0 79.1 L 81.5 80.8 L 79.9 82.3 L 78.0 83.5 L 76.1 84.5 L 74.1 85.5 L 72.2 86.3 L 70.1 87.1 L 68.1 87.7 L 66.1 88.2 L 64.0 88.6 L 62.0 88.9 L 59.9 89.1 L 57.9 89.2 L 55.9 89.2 L 55.9 89.2 L 57.7 88.5 L 59.5 87.7 L 61.3 86.8 L 63.0 85.8 L 64.6 84.8 L 66.2 83.7 L 67.7 82.5 L 69.1 81.3 L 70.4 80.0 L 71.6 78.6 L 72.8 77.2 L 73.9 75.8 L 75.2 74.6 L 76.4 73.3 L 77.5 72.0 L 78.6 70.6 L 79.6 69.1 L 80.5 67.6 L 81.3 66.1 L 82.1 64.5 L 82.8 62.9 L 83.4 61.2 L 83.9 59.6 L 84.3 57.9 L 84.7 56.1 L 84.9 54.4 L 85.1 52.7 L 85.2 50.9 L 85.2 49.1 L 85.1 47.4 L 84.9 45.6 L 84.7 43.9 L 84.3 42.2 L 83.9 40.5 L 83.4 38.8 L 82.8 37.2 L 82.1 35.5 L 81.3 34.0 L 80.5 32.4 L 79.6 30.9 L 78.6 29.5 L 77.5 28.1 L 76.4 26.7 L 75.2 25.4 L 74.0 24.2 L 72.6 23.0 L 71.3 21.9 L 69.8 20.9 L 68.4 20.0 L 66.8 19.1 L 65.3 18.3 L 63.7 17.6 L 62.0 16.9 L 60.4 16.4 L 58.7 15.9 L 57.0 15.5 L 55.2 15.2 L 53.5 15.0 L 51.8 14.8 L 50.0 14.8 L 48.2 14.8 L 46.5 15.0 L 44.8 15.2 L 43.0 15.5 L 41.3 15.9 L 39.6 16.4 L 38.0 16.9 L 36.3 17.6 L 34.7 18.3 L 33.2 19.1 L 31.6 20.0 L 30.2 20.9 L 28.7 21.9 L 27.4 23.0 L 26.0 24.2 L 24.8 25.4 L 23.6 26.7 L 22.5 28.1 L 21.4 29.5 L 20.4 30.9 L 19.5 32.4 L 18.7 34.0 L 17.9 35.5 L 17.2 37.2 L 16.6 38.8 L 16.1 40.5 L 15.7 42.2 L 15.3 43.9 L 15.1 45.6 L 14.9 47.4 L 14.8 49.1 L 14.8 50.9 L 14.9 52.7 L 15.1 54.4 L 15.3 56.1 L 15.7 57.9 L 16.1 59.6 L 16.6 61.2 L 17.2 62.9 L 17.9 64.5 L 18.7 66.1 L 19.5 67.6 L 20.4 69.1 L 21.4 70.6 L 22.5 72.0 L 23.6 73.3 L 24.8 74.6 L 26.1 75.8 L 27.2 77.2 L 28.4 78.6 L 29.6 80.0 L 30.9 81.3 L 32.3 82.5 L 33.8 83.7 L 35.4 84.8 L 37.0 85.8 L 38.7 86.8 L 40.5 87.7 L 42.3 88.5 L 44.1 89.2 Z';

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
        <path d="M202 12 L202 150" strokeWidth="12" />
        <path d="M202 86 C204 66 220 57 240 57 C260 57 270 70 270 90 L270 150" strokeWidth="12" />
        {/* n — narrower, tucked in closer */}
        <path d="M310 57 L310 150" />
        <path d="M310 80 C312 64 326 57 343 57 C361 57 371 68 371 88 L371 150" />
        {/* y — longer, more calligraphic descender */}
        <path d="M412 57 L448 128" />
        <path d="M484 57 C481 92 473 122 461 143 C452 160 441 169 430 173" />
        {/* k — thinner arm, longer softer leg */}
        <path d="M525 12 L525 150" />
        <path d="M583 57 L533 104" strokeWidth="11" />
        <path d="M539 100 L593 152" />
      </g>
      <path d="M484 57 C482 78 479 92 477 101" fill="none" stroke={`url(#${acc})`} strokeWidth="12" strokeLinecap="round" />
    </svg>
  );
}
