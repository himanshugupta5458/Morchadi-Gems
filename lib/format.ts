const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatRupees(amountInRupees: number): string {
  return rupeeFormatter.format(amountInRupees);
}

/**
 * Display-only. `mrp` is a compare-at price and must never reach an amount
 * calculation — the charged amount is always `price`.
 */
export function calculateDiscountPercent(mrp: number, price: number): number {
  if (mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function hasVisibleDiscount(mrp: number, price: number): boolean {
  return calculateDiscountPercent(mrp, price) > 0;
}

/** "Ananya Iyer" → "AI". Used for monogram avatars where no photo exists. */
export function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter((namePart) => namePart.length > 0)
    .slice(0, 2)
    .map((namePart) => namePart.charAt(0).toUpperCase())
    .join("");
}

/**
 * "2026-08-17" → "17 August 2026". Pinned to UTC so a policy's last-updated line reads the
 * same date wherever it is rendered.
 */
export function formatPolicyDate(isoDate: string): string {
  const parsedDate = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}
