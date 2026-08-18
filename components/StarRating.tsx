export type StarRatingSize = "sm" | "md";

export interface StarRatingProps {
  value: number;
  count?: number;
  size?: StarRatingSize;
}

const TOTAL_STARS = 5;

const starPixelSize: Record<StarRatingSize, string> = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
};

const STAR_PATH =
  "M12 2.5l2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 17.56l-5.91 3.1 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z";

function Star({
  fillPercent,
  sizeClass,
}: {
  fillPercent: number;
  sizeClass: string;
}): JSX.Element {
  return (
    <span className={`relative inline-block ${sizeClass}`}>
      <svg viewBox="0 0 24 24" className={`${sizeClass} fill-line`} aria-hidden>
        <path d={STAR_PATH} />
      </svg>
      <span
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width: `${fillPercent}%` }}
      >
        <svg viewBox="0 0 24 24" className={`${sizeClass} fill-amber`} aria-hidden>
          <path d={STAR_PATH} />
        </svg>
      </span>
    </span>
  );
}

function clampToStarRange(value: number): number {
  return Math.min(Math.max(value, 0), TOTAL_STARS);
}

function fillPercentForStar(clampedValue: number, starIndex: number): number {
  const fraction = Math.min(Math.max(clampedValue - starIndex, 0), 1);
  return Math.round(fraction * 1000) / 10;
}

export function StarRating({
  value,
  count,
  size = "sm",
}: StarRatingProps): JSX.Element {
  const clampedValue = clampToStarRange(value);
  const sizeClass = starPixelSize[size];
  const label =
    count === undefined
      ? `Rated ${clampedValue} out of 5`
      : `Rated ${clampedValue} out of 5 from ${count} reviews`;

  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={label}>
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: TOTAL_STARS }, (_unused, index) => (
          <Star
            key={index}
            sizeClass={sizeClass}
            fillPercent={fillPercentForStar(clampedValue, index)}
          />
        ))}
      </span>
      {count === undefined ? null : (
        <span className="font-sans text-body-sm text-muted">({count})</span>
      )}
    </span>
  );
}
