export type Category =
  | "necklaces"
  | "earrings"
  | "rings"
  | "bracelets"
  | "bangles"
  | "pendants"
  | "anklets"
  | "nose-pins";

export interface CategoryOption {
  slug: Category;
  label: string;
}

export const CATEGORIES: readonly CategoryOption[] = [
  { slug: "necklaces", label: "Necklaces" },
  { slug: "earrings", label: "Earrings" },
  { slug: "rings", label: "Rings" },
  { slug: "bracelets", label: "Bracelets" },
  { slug: "bangles", label: "Bangles" },
  { slug: "pendants", label: "Pendants" },
  { slug: "anklets", label: "Anklets" },
  { slug: "nose-pins", label: "Nose Pins" },
] as const;

export const CATEGORY_SLUGS: readonly Category[] = CATEGORIES.map(
  (category) => category.slug,
);

export function getCategoryLabel(slug: Category): string {
  const match = CATEGORIES.find((category) => category.slug === slug);
  return match ? match.label : slug;
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((category) => category.slug === value);
}

export interface Review {
  name: string;
  rating: number;
  text: string;
}

export interface ProductDetails {
  material: string;
  /** Absent on the owner's own products, whose measured weights have not been supplied. */
  weight?: string;
  closure?: string;
  type?: string;
  stone?: string;
  size?: string;
}

/**
 * A choice the buyer makes without changing the price — an engraved letter, a shape, a
 * plating colour. Carried as catalogue data only; nothing reads it into a cart line yet.
 * See ADR-016.
 */
export interface ProductOption {
  name: string;
  values: string[];
}

/**
 * The projection of a product the browser is allowed to hold. It carries what a cart line
 * has to render and price and nothing else — no description, details, or reviews — so the
 * client cart can prune stale ids and read a trusted price without the full catalogue
 * crossing the server boundary. See ADR-010.
 */
export interface CatalogueEntry {
  id: string;
  name: string;
  /** The amount actually charged. The only field a cart total may read. */
  price: number;
  /** Display-only compare-at price. Never used in any amount calculation. */
  mrp: number;
  image: string | null;
  inStock: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  /** The amount actually charged. The only field a server-side total may read. */
  price: number;
  /** Display-only compare-at price. Never used in any amount calculation. */
  mrp: number;
  images: string[];
  shortDescription: string;
  details: ProductDetails;
  rating: number;
  reviewCount: number;
  reviews: Review[];
  featured: boolean;
  isNew: boolean;
  inStock: boolean;
  /** Absent or empty means the product is sold in exactly one configuration. */
  options?: ProductOption[];
}
