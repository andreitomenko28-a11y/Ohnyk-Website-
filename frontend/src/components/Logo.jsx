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
        {/* side flames — smaller, set lower */}
        <path d="M80 165 C94 189 103 210 103 233 C103 254 92 267 80 275 C68 267 57 254 57 233 C57 210 66 189 80 165 Z" />
        <path d="M270 165 C284 189 293 210 293 233 C293 254 282 267 270 275 C258 267 247 254 247 233 C247 210 256 189 270 165 Z" />
        {/* center flame — taller, slender */}
        <path d="M175 2 C206 44 223 100 223 156 C223 214 201 262 175 292 C149 262 127 214 127 156 C127 100 144 44 175 2 Z" />
      </g>
      {/* cradle arc — thin, hugging the base */}
      <path
        d="M46 302 Q175 322 304 302"
        fill="none"
        stroke={`url(#${g})`}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}
