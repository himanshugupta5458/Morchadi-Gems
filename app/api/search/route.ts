import { NextResponse } from "next/server";
import { getAllProducts } from "@/lib/products";
import {
  SEARCH_QUERY_PARAM,
  SEARCH_SUGGESTION_LIMIT,
  isSearchableTerm,
  searchProducts,
  type ProductSearchResults,
} from "@/lib/product-search";

/**
 * Node rather than Edge, for consistency with every other route here. Nothing in this one
 * needs it — it reads `data/products.json`, which is bundled — but a second runtime is a second
 * set of behaviours to know about, for a handler that would not get faster.
 */
export const runtime = "nodejs";

/**
 * Suggestions for what a shopper is typing.
 *
 * A route rather than a search index shipped to the browser. The catalogue is 449 records and
 * the fields a suggestion needs — name, category, price, thumbnail — come to roughly 50KB of
 * JSON, which is a real cost paid by every visitor on the chance that some of them search. The
 * answer is computed from the same `getAllProducts` the shop listing filters, so the dropdown
 * and the page behind "see all results" cannot disagree about what matches.
 *
 * Cached at the edge for a minute and revalidated for an hour after that: the catalogue only
 * changes when somebody ships a commit, and the same handful of terms are typed over and over.
 * A stale suggestion for sixty seconds is a product that was already on the site.
 *
 * A term shorter than the minimum is answered with an empty result and a 200, not a 400. There
 * is nothing wrong with typing one letter, and the box asks on every keystroke.
 */
export function GET(request: Request): NextResponse<ProductSearchResults> {
  const term = new URL(request.url).searchParams.get(SEARCH_QUERY_PARAM) ?? "";

  const results = isSearchableTerm(term)
    ? searchProducts(getAllProducts(), term, SEARCH_SUGGESTION_LIMIT)
    : { hits: [], total: 0 };

  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=3600" },
  });
}
