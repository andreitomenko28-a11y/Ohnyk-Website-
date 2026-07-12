import { FlameMark } from './Logo.jsx';
import Wordmark from './Wordmark.jsx';

// Ohnyk brand lockup: flame emblem + wordmark (custom open-O + Poiret One).
// `stacked` renders the emblem above the wordmark (used on the auth screen).
export default function BrandMark({
  className = '',
  mark = true,
  stacked = false,
  markClassName = '',
}) {
  if (stacked) {
    return (
      <span className={`inline-flex flex-col items-center gap-3 ${className}`}>
        {mark && <FlameMark className={markClassName || 'h-16 w-16'} />}
        <Wordmark />
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {mark && <FlameMark className={markClassName || 'h-[1.35em] w-[1.35em]'} />}
      <Wordmark />
    </span>
  );
}
