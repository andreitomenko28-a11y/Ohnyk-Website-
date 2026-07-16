import { Star } from './icons.jsx';

// Star rating. Read-only by default; pass `onChange` to make it an input.
export default function StarRating({ value = 0, onChange, size = 'h-5 w-5' }) {
  const interactive = typeof onChange === 'function';
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        const star = <Star className={`${size} ${filled ? 'text-star' : 'text-[color:var(--line)]'}`} />;
        return interactive ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n}`}
            className="transition-transform hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </div>
  );
}
