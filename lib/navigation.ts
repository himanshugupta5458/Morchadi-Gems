import {
  CATEGORIES,
  COLLECTIONS,
  type Category,
  type CategoryOption,
  type CollectionFilterSlug,
  type CollectionOption,
} from "@/types/product";

export interface NavLink {
  label: string;
  href: string;
}

/** One entry in a nav dropdown — the two groups share a shape so the menu renders once. */
export interface NavMenuItem extends NavLink {
  key: string;
}

export interface NavMenu {
  key: string;
  label: string;
  items: readonly NavMenuItem[];
}

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

/**
 * Every collection resolves through the same `?collection=` param, including the three
 * derived from flags and price. Routing `new-arrivals` to `?sort=newest` instead would put
 * the nav and the shop's Collections facet out of step — the shopper would arrive with the
 * box they just clicked left unchecked. See ADR-020.
 */
export function buildCollectionHref(slug: CollectionFilterSlug): string {
  return `/shop?collection=${slug}`;
}

/** Path convention is fixed by ADR-006 — see docs/design/IMAGES.md. */
export function buildCategoryImageSrc(slug: Category): string {
  return `/categories/${slug}.webp`;
}

function toCategoryMenuItem(category: CategoryOption): NavMenuItem {
  return {
    key: category.slug,
    label: category.label,
    href: buildCategoryHref(category.slug),
  };
}

function toCollectionMenuItem(collection: CollectionOption): NavMenuItem {
  return {
    key: collection.slug,
    label: collection.label,
    href: buildCollectionHref(collection.slug),
  };
}

export const CATEGORY_MENU: NavMenu = {
  key: "categories",
  label: "Shop by Category",
  items: CATEGORIES.map(toCategoryMenuItem),
};

export const COLLECTION_MENU: NavMenu = {
  key: "collections",
  label: "Collections",
  items: COLLECTIONS.map(toCollectionMenuItem),
};

/** The two dropdowns, in the order they appear in the header and the mobile drawer. */
export const NAV_MENUS: readonly NavMenu[] = [CATEGORY_MENU, COLLECTION_MENU];

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
