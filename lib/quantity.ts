export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

/**
 * The one place a quantity is bounded. The stepper cannot produce an out-of-range value
 * through its buttons, its input, or a pasted number, so nothing downstream has to defend
 * against one.
 */
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return MIN_QUANTITY;

  const whole = Math.floor(value);
  if (whole < MIN_QUANTITY) return MIN_QUANTITY;
  if (whole > MAX_QUANTITY) return MAX_QUANTITY;
  return whole;
}
