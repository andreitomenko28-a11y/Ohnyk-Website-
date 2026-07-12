// Small inline SVG icons — inherit color via `currentColor`.
// The app is emoji-free: everything decorative uses these line icons.

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function VerifiedBadge({ className = 'h-4 w-4', title = 'Перевірений' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={title}>
      <circle cx="12" cy="12" r="11" fill="var(--ember)" />
      <path
        d="M7 12.5l3 3 7-7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Star({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.9l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95L12 2.5z" />
    </svg>
  );
}

// --- Bottom navigation -------------------------------------------------------

export function HomeIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V9.5" />
    </svg>
  );
}

export function SearchIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

export function CartIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M3 4h2l2.2 11.2a1.5 1.5 0 001.5 1.2h8.4a1.5 1.5 0 001.5-1.2L20.5 8H6" />
      <circle cx="9.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ProfileIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

// --- General UI --------------------------------------------------------------

export function SlidersIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="8" cy="17" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HeartIcon({ className = 'h-5 w-5', filled = false }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.5S3.5 15 3.5 8.9A4.9 4.9 0 0112 6a4.9 4.9 0 018.5 2.9C20.5 15 12 20.5 12 20.5z" />
    </svg>
  );
}

export function EditIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M14.06 6.19l3.75 3.75M4 20l1-4L16 5a2.12 2.12 0 013 3L8 19l-4 1z" />
    </svg>
  );
}

export function MapPinIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function LogoutIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M15 12H4M8 8l-4 4 4 4" />
      <path d="M12 4h7a1 1 0 011 1v14a1 1 0 01-1 1h-7" />
    </svg>
  );
}

export function TrashIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </svg>
  );
}

export function ChevronDownIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Theme / appearance
export function ThemeIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 010 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SunIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
    </svg>
  );
}

export function MoonIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M20.5 14.8A8.2 8.2 0 019.2 3.5a8 8 0 1011.3 11.3z" />
    </svg>
  );
}

// Role icons
export function BagIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M5.5 8h13l-1 12H6.5l-1-12z" />
      <path d="M9 8V6.5a3 3 0 016 0V8" />
    </svg>
  );
}

export function ChefHatIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M7 20h10M6.5 20v-5.5A4 4 0 016 6.6 4.6 4.6 0 0112 4a4.6 4.6 0 016 2.6 4 4 0 01-.5 7.9V20" />
    </svg>
  );
}

// Neutral food placeholder (serving dome) for dish/cook tiles without a photo.
export function FoodIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...stroke}>
      <path d="M4 18h16" />
      <path d="M5 18a7 7 0 0114 0" />
      <path d="M12 8V6" />
    </svg>
  );
}
