# GET /api/search

Product suggestions for what a shopper is typing into the home page's search box.

The one route on this site that exists purely to serve the storefront's own interface. It reads
`data/products.json` — the same catalogue, through the same `getAllProducts` accessor that
filters drafts — and touches no database, no gateway and no session.

It exists rather than a client-side index because the suggestion fields for all 449 products come
to roughly 50KB of JSON, which every visitor would download on the chance that some of them
search. See [ADR-070](../decisions/ADR-070-home-page-composition.md).

## Request

| | |
| --- | --- |
| Method | `GET` |
| Runtime | `nodejs` |
| Caching | `public, s-maxage=60, stale-while-revalidate=3600` |
| Auth | **None.** It answers with catalogue data that is already public on `/shop` |

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `q` | string | No | The typed term. Absent, empty, or shorter than two characters returns an empty result. |

`/api/` is disallowed in `robots.txt` along with every other route handler.

Cacheable because the catalogue only changes when somebody ships a commit, and the same handful
of terms are typed over and over. A stale suggestion for sixty seconds is a product that was
already on the site.

## Server-side validation

There is no money and no write here, so validation is about what the route refuses to spend
effort on rather than about trust.

- **A term under `MIN_SEARCH_TERM_LENGTH` (2) returns `{ hits: [], total: 0 }` with a 200**, not
  a 400. There is nothing wrong with typing one letter, and the box asks on every keystroke; a
  single character matches most of the catalogue, which is a dropdown that says nothing and a
  response that costs something to produce.
- **The term is treated as text throughout.** `searchProducts` compares with `String.includes`
  and escapes the one place it builds a `RegExp`, so `ring (` is a term that matches nothing
  rather than a pattern that throws.
- **Drafts are unreachable.** `getAllProducts` returns only active records
  ([ADR-052](../decisions/ADR-052-product-status-field.md)), so an unpublished piece cannot be
  found by guessing its name.
- **No price is accepted and none is trusted.** The response quotes `pricing.price` and
  `pricing.mrp` for display; nothing here reaches an order total, which is computed server-side
  from the catalogue at checkout ([ADR-011](../decisions/ADR-011-checkout-address-step.md)).

## What is matched

The product's **name** and its **category's display label**, joined and lower-cased. Every
whitespace-separated word in the term must appear somewhere in that string — AND, not OR, so a
second word narrows rather than widens.

Not the description, and not the SEO keywords. A description is 200 words of prose and would
match nearly any term, turning the dropdown into a list of everything; `seo.primaryKeyword` is
internal targeting copy no shopper has ever seen, so a result it explained would look like a
mistake.

Ranking, best first: a name that **starts with** the first word, then a name with a **word
starting** with it, then a name **containing** it, then a category-only match. Ties break on name
then id, so the order is total and stable.

## Response

Always 200 with this body.

```ts
interface ProductSearchResults {
  /** At most SEARCH_SUGGESTION_LIMIT (8) hits, best first. */
  hits: ProductSearchHit[];
  /** How many products matched in total — what "see all N results" counts. */
  total: number;
}

interface ProductSearchHit {
  id: string;
  name: string;
  categoryLabel: string;
  /** The amount actually charged, in whole rupees. Display only. */
  price: number;
  /** Compare-at price. Display only, never used in any calculation. */
  mrp: number;
  /** media.images[0], or null for a product with no photograph. */
  image: string | null;
}
```

```json
{
  "total": 4,
  "hits": [
    {
      "id": "P045",
      "name": "Black Evil Eye Spiral Charm Anklet",
      "categoryLabel": "Anklets",
      "price": 120,
      "mrp": 199,
      "image": "/products/P045.webp"
    }
  ]
}
```

`total` counts every match while `hits` is the clipped head of the same ranked list, so the caller
can say "8 of 34" without running the search twice.

There is no error response. A term that matches nothing is `{ hits: [], total: 0 }`, which is an
answer rather than a failure.

## Its relationship to `/shop?q=`

`SEARCH_QUERY_PARAM` is one constant in `lib/product-search.ts`, read by this route, by the search
box, and by `ShopSearchParams.q`. `matchesSearchTerm` — the predicate `/shop` filters with — is
the same predicate `searchProducts` ranks over, so the listing behind "see all results" contains
exactly the set the suggestions were drawn from. `lib/product-search.test.ts` asserts that
equivalence over the real catalogue rather than trusting it.

A searched listing on `/shop` is `noindex, follow`; see
[ADR-070](../decisions/ADR-070-home-page-composition.md).
