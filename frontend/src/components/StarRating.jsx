import { Star } from './icons.jsx';

// Star rating. Read-only by default (renders accurate fractional fill, so 4.7
// shows four full stars + a ~70% fifth). Pass `onChange` for a whole-star input.
export default function StarRating({ value = 0, onChange, size = 'h-5 w-5' }) {
  if (typeof onChange === 'function') {
    return (
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n}`}
            className="transition-transform hover:scale-110"
          >
            <Star className={`${size} ${n <= value ? 'text-star' : 'text-[color:var(--line)]'}`} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value}`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1))); // 0..1 for this star
        return (
          <span key={n} className="relative inline-block">
            <Star className={`${size} text-[color:var(--line)]`} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${size} text-star`} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
