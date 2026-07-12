import { FlameMark } from './Logo.jsx';

// Ohnyk brand lockup: flame emblem + elegant wordmark (Josefin Sans).
// `stacked` renders the emblem above the wordmark (used on the auth screen).
export default function BrandMark({
  className = '',
  mark = true,
  stacked = false,
  markClassName = '',
}) {
  const word = <span className="font-brand tracking-[0.01em]">Ohnyk</span>;

  if (stacked) {
    return (
      <span className={`inline-flex flex-col items-center gap-3 ${className}`}>
        {mark && <FlameMark className={markClassName || 'h-16 w-16'} />}
        {word}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {mark && <FlameMark className={markClassName || 'h-[1.35em] w-[1.35em]'} />}
      {word}
    </span>
  );
}
