// Ohnyk wordmark — the "y" is highlighted in ember.
export default function BrandMark({ className = '' }) {
  return (
    <span className={`font-display font-bold tracking-wide text-fg ${className}`}>
      Ohn<span className="text-ember">y</span>k
    </span>
  );
}
