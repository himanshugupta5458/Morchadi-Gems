import { CATEGORIES, type Category, type CategoryOption } from "@/types/product";

export interface NavLink {
  label: string;
  href: string;
}

export interface CategoryQuickFilter extends NavLink {
  key: string;
}

export interface NavCategory extends CategoryOption {
  quickFilters: readonly CategoryQuickFilter[];
}

const PRICE_BANDS = [
  { key: "under-999", label: "Under ₹999" },
  { key: "1000-4999", label: "₹1,000 – ₹4,999" },
  { key: "5000-plus", label: "₹5,000 & above" },
] as const;

export const CART_PATH = "/cart";

/** The first step of checkout. Buy now and Proceed to checkout both land here. */
export const CHECKOUT_ADDRESS_PATH = "/address";

/** Step two — reached only from `/address` with a validated address in hand. */
export const CHECKOUT_PAYMENT_PATH = "/payment";

/** Step three — where Cashfree returns the shopper, with `?order_id=` appended. */
export const CHECKOUT_CONFIRMATION_PATH = "/order-confirmation";

/** The only endpoint the payment page talks to. It never calls Cashfree directly. */
export const CREATE_ORDER_API_PATH = "/api/create-order";

/**
 * The only endpoint the confirmation page talks to. Like `/payment`, it never calls Cashfree
 * directly — the browser cannot be trusted with a credential, and could not be trusted with
 * the answer either.
 */
export const VERIFY_ORDER_API_PATH = "/api/verify-order";

export function buildVerifyOrderPath(orderId: string): string {
  return `${VERIFY_ORDER_API_PATH}?order_id=${encodeURIComponent(orderId)}`;
}

export function buildCategoryHref(slug: Category): string {
  return `/shop?category=${slug}`;
}

/** Path convention is fixed by ADR-006 — see docs/design/IMAGES.md. */
export function buildCategoryImageSrc(slug: Category): string {
  return `/categories/${slug}.webp`;
}

export function buildCategoryQuickFilters(
  category: CategoryOption,
): CategoryQuickFilter[] {
  const allOfCategory: CategoryQuickFilter = {
    key: "all",
    label: `All ${category.label}`,
    href: buildCategoryHref(category.slug),
  };

  const byPriceBand = PRICE_BANDS.map((band) => ({
    key: band.key,
    label: band.label,
    href: `${buildCategoryHref(category.slug)}&price=${band.key}`,
  }));

  return [allOfCategory, ...byPriceBand];
}

export const NAV_CATEGORIES: readonly NavCategory[] = CATEGORIES.map((category) => ({
  ...category,
  quickFilters: buildCategoryQuickFilters(category),
}));

export const COMPANY_LINKS: readonly NavLink[] = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/**
 * The four policy pages, in the order a shopper is most likely to want them. The footer and
 * every policy page's cross-links read this list, so a new policy is added once.
 */
export const POLICY_LINKS: readonly NavLink[] = [
  { label: "Shipping", href: "/shipping" },
  { label: "Refund & Cancellation", href: "/refund" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
];
