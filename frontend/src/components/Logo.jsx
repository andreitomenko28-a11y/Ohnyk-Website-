import { useId } from 'react';

// Ohnyk emblem — three flames rising from a bowl/cradle arc.
// Scales with font-size or an explicit className (h-*/w-*). Gradient id is
// unique per instance so multiple logos on one page don't collide.
export function FlameMark({ className = 'h-8 w-8' }) {
  const uid = useId().replace(/:/g, '');
  const g = `ohnyk-flame-${uid}`;
  return (
    <svg viewBox="0 0 100 108" className={className} role="img" aria-label="Ohnyk">
      <defs>
        <linearGradient id={g} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#FAC24E" />
          <stop offset="45%" stopColor="#F0902A" />
          <stop offset="100%" stopColor="#DF6A14" />
        </linearGradient>
      </defs>
      <g fill={`url(#${g})`}>
        {/* side flames */}
        <path d="M30 46 Q41 63 30 84 Q19 63 30 46 Z" transform="rotate(-9 30 65)" />
        <path d="M70 46 Q81 63 70 84 Q59 63 70 46 Z" transform="rotate(9 70 65)" />
        {/* center flame */}
        <path d="M50 6 Q69 45 50 84 Q31 45 50 6 Z" />
      </g>
      {/* cradle arc */}
      <path
        d="M25 90 Q50 101 75 90"
        fill="none"
        stroke={`url(#${g})`}
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.92"
      />
    </svg>
  );
}
