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
          <stop offset="0%" stopColor="#F6B24E" />
          <stop offset="46%" stopColor="#EF9236" />
          <stop offset="100%" stopColor="#E37B1E" />
        </linearGradient>
      </defs>
      <g fill={`url(#${g})`}>
        {/* side flames — fuller leaves, hugging the centre */}
        <path d="M88 150 C105 178 116 202 116 228 C116 251 103 266 88 275 C73 266 60 251 60 228 C60 202 71 178 88 150 Z" />
        <path d="M262 150 C279 178 290 202 290 228 C290 251 277 266 262 275 C247 266 234 251 234 228 C234 202 245 178 262 150 Z" />
        {/* center flame — a broad, plump petal */}
        <path d="M175 10 C210 48 232 102 232 156 C232 212 205 258 175 286 C145 258 118 212 118 156 C118 102 140 48 175 10 Z" />
      </g>
      {/* cradle arc — a delicate warm smile beneath the flames */}
      <path
        d="M48 286 Q175 312 302 286"
        fill="none"
        stroke={`url(#${g})`}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.92"
      />
    </svg>
  );
}
