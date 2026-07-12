import { useId } from 'react';

// Ohnyk emblem — three flames rising from a bowl/cradle arc.
// Scales with font-size or an explicit className (h-*/w-*). Gradient id is
// unique per instance so multiple logos on one page don't collide.
export function FlameMark({ className = 'h-8 w-8' }) {
  const uid = useId().replace(/:/g, '');
  const g = `ohnyk-flame-${uid}`;
  return (
    <svg viewBox="0 0 350 340" className={className} role="img" aria-label="Ohnyk">
      <defs>
        <linearGradient id={g} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FAC24E" />
          <stop offset="45%" stopColor="#F0902A" />
          <stop offset="100%" stopColor="#DF6A14" />
        </linearGradient>
      </defs>
      <g fill={`url(#${g})`}>
        {/* side flames */}
        <path d="M76 145 C95 175 106 200 106 230 C106 255 93 270 76 280 C59 270 46 255 46 230 C46 200 57 175 76 145 Z" />
        <path d="M274 145 C293 175 304 200 304 230 C304 255 291 270 274 280 C257 270 244 255 244 230 C244 200 255 175 274 145 Z" />
        {/* center flame */}
        <path d="M175 0 C210 40 228 95 228 150 C228 205 205 250 175 275 C145 250 122 205 122 150 C122 95 140 40 175 0 Z" />
      </g>
      {/* cradle arc */}
      <path
        d="M8 316 Q175 342 342 316"
        fill="none"
        stroke={`url(#${g})`}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.92"
      />
    </svg>
  );
}
