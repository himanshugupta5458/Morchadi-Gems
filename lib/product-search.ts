import { getCategoryLabel, type Product } from "@/types/product";

/**
 * The query parameter a search travels under, on `/api/search` and on `/shop` alike.
 *
 * One name for both, so the dropdown's "see all results" link and the listing that answers it
 * cannot disagree — and so `ShopSearchParams.q` and the route handler are naming the same
 * thing rather than agreeing by coincidence. It lives here rather than beside the route because
 * a Next.js route file may only export the fields Next recognises.
 */
export const SEARCH_QUERY_PARAM = "q";

/**
 * How many results the home page's dropdown shows before it stops listing and offers the shop
 * instead. Eight is the most a dropdown can hold on a phone without becoming the page.
 */
export const SEARCH_SUGGESTION_LIMIT = 8;

/**
 * The shortest term worth searching. One character matches most of a 449-piece catalogue, which
 * is a dropdown that says nothing and a request that costs something to answer.
 */
export const MIN_SEARCH_TERM_LENGTH = 2;

/** One row of the dropdown. Deliberately not a `Product` — a suggestion needs six fields. */
export interface ProductSearchHit {
  id: string;
  name: string;
  categoryLabel: string;
  price: number;
  mrp: number;
  image: string | null;
}

export interface ProductSearchResults {
  /** At most `limit` hits, best first. */
  hits: ProductSearchHit[];
  /** How many products matched in total, which is what "see all N results" counts. */
  total: number;
}

/**
 * The term as everything downstream compares against it: trimmed, lower-cased, and split on
 * whitespace so "gold ring" is two requirements rather than one phrase nothing satisfies.
 */
export function toSearchTokens(term: string): string[] {
  return term.trim().toLowerCase().split(/\s+/).filter((token) => token.length > 0);
}

export function isSearchableTerm(term: string): boolean {
  return term.trim().length >= MIN_SEARCH_TERM_LENGTH;
}

/**
 * What a product is matched against: its name and its category's display label, joined.
 *
 * Not the description, and not the SEO keywords. A description is 200 words of prose and would
 * match nearly any term a shopper types, turning the dropdown into a list of everything;
 * `seo.primaryKeyword` is internal targeting copy that no shopper has ever seen, so a result it
 * explained would look like a mistake. Name and category are the two things on the card the
 * shopper is trying to find again.
 */
function haystackFor(product: Product): string {
  return `${product.name} ${getCategoryLabel(product.category)}`.toLowerCase();
}

/**
 * Every token must appear somewhere. AND rather than OR, because a two-word search that
 * returned everything matching either word would rank the whole catalogue.
 */
function matchesAllTokens(haystack: string, tokens: readonly string[]): boolean {
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Lower sorts first. A name that starts with what was typed beats one that merely contains it,
 * and a word starting with it beats a match inside a word — "Ring" should not be buried under
 * "Earrings" because both contain the letters.
 */
function rankOf(product: Product, tokens: readonly string[]): number {
  const name = product.name.toLowerCase();
  const [firstToken] = tokens;

  if (name.startsWith(firstToken)) return 0;
  if (new RegExp(`\\b${firstToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(name)) return 1;
  if (name.includes(firstToken)) return 2;
  return 3;
}

/**
 * Pure: it searches the products it is handed and reads nothing else, so a test drives it with
 * four fixtures rather than with the real catalogue and the ranking can be asserted exactly.
 *
 * `total` counts every match and `hits` is the clipped head of the same list, so the caller can
 * say "8 of 34" without running the search twice.
 */
export function searchProducts(
  products: readonly Product[],
  term: string,
  limit: number = SEARCH_SUGGESTION_LIMIT,
): ProductSearchResults {
  const tokens = toSearchTokens(term);
  if (!isSearchableTerm(term) || tokens.length === 0) return { hits: [], total: 0 };

  const matched = products
    .filter((product) => matchesAllTokens(haystackFor(product), tokens))
    .sort(
      (left, right) =>
        rankOf(left, tokens) - rankOf(right, tokens) ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    );

  return {
    total: matched.length,
    hits: matched.slice(0, limit).map((product) => ({
      id: product.id,
      name: product.name,
      categoryLabel: getCategoryLabel(product.category),
      price: product.pricing.price,
      mrp: product.pricing.mrp,
      image: product.media.images[0] ?? null,
    })),
  };
}

/**
 * Whether a product satisfies a free-text term — the shop listing's `?q=` filter, and the same
 * predicate the dropdown ranks over, so a shopper who follows "see all results" lands on
 * exactly the set the dropdown was drawn from.
 */
export function matchesSearchTerm(product: Product, term: string): boolean {
  const tokens = toSearchTokens(term);
  if (tokens.length === 0) return true;
  return matchesAllTokens(haystackFor(product), tokens);
}
