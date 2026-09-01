import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as llmsTxtRoute } from "@/app/llms.txt/route";
import { BUSINESS } from "@/config/business";
import { ONLINE_PAYMENT_DISCOUNT_RATE } from "@/lib/cod";
import {
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  LEGAL_CONFIG,
  PRODUCT_DESCRIPTOR,
  RETURN_WINDOW_DAYS,
} from "@/lib/config";
import { formatRupees } from "@/lib/format";
import { LLMS_TXT_PATH, buildLlmsTxt } from "@/lib/llms-txt";
import { getAllProducts } from "@/lib/products";
import { NON_INDEXABLE_PATHS } from "@/lib/sitemap";
import { COLLECTIONS, SURFACED_CATEGORIES } from "@/types/product";

const PRODUCTION_ORIGIN = "https://www.morchadigems.com";

const previousAppBaseUrl = process.env.APP_BASE_URL;
const previousPublicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

beforeEach(() => {
  process.env.APP_BASE_URL = PRODUCTION_ORIGIN;
  delete process.env.NEXT_PUBLIC_BASE_URL;
});

afterEach(() => {
  if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = previousAppBaseUrl;

  if (previousPublicBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
  else process.env.NEXT_PUBLIC_BASE_URL = previousPublicBaseUrl;
});

/**
 * The counts are written out as numbers on purpose, unlike the policy values below.
 *
 * Eleven categories and four collections are the catalogue's information architecture
 * ([ADR-020](/docs/decisions/ADR-020-two-tier-catalogue-ia.md)), not a configured business
 * value, and `lib/sitemap.test.ts` and `lib/category-vocabulary.test.ts` already pin them the
 * same way. Deriving the expectation from the same list the file was built from would assert
 * nothing: it would pass just as happily on a list that had lost a category.
 *
 * The shipping and return numbers are the opposite case. They live in `config/site-facts.mjs`
 * and `lib/site-identity.test.ts` is the one file allowed to state them as literals, so what is
 * asserted here is that `/llms.txt` renders *whatever those constants say* — which is the
 * failure that matters, a file that has quietly stopped naming the number the shop charges.
 */
const EXPECTED_CATEGORY_COUNT = 11;
const EXPECTED_COLLECTION_COUNT = 4;
/**
 * `PRECIOUS_METAL_CLAIM` from `scripts/product-record-rules.mjs`, copied rather than imported
 * because that gate is plain Node with no path aliases and exports nothing this side can reach.
 * It is a rule about a class of claim rather than a business value, so the two copies cannot
 * drift the way a duplicated price would; `lib/product-validation.test.ts` owns the original.
 */
const PRECIOUS_METAL_CLAIM =
  /\b(?:9|10|14|18|22|24)\s?[Kk]\b|\b916\b|hallmark|sterling silver/i;

const EXPECTED_COLLECTION_LABELS: readonly string[] = [
  "Gifting",
  "Anti-Tarnish",
  "Best Sellers",
  "New Arrivals",
];

describe("the lists /llms.txt is built from", () => {
  it("still holds the eleven categories and four collections the file claims", () => {
    expect(SURFACED_CATEGORIES).toHaveLength(EXPECTED_CATEGORY_COUNT);
    expect(COLLECTIONS).toHaveLength(EXPECTED_COLLECTION_COUNT);
    expect(COLLECTIONS.map((collection) => collection.label)).toEqual(
      EXPECTED_COLLECTION_LABELS,
    );
  });
});

describe("llms.txt", () => {
  it("opens with the brand name as its heading and a one-line summary", () => {
    const [heading, blank, summary] = buildLlmsTxt().split("\n");

    expect(heading).toBe(`# ${BUSINESS.brandName}`);
    expect(blank).toBe("");
    expect(summary).toContain(PRODUCT_DESCRIPTOR);
    expect(summary).toContain("guest checkout");
    expect(summary).toContain(LEGAL_CONFIG.shippingScope);
  });

  it("names the operating entity", () => {
    expect(buildLlmsTxt()).toContain(BUSINESS.legalEntityName);
  });

  it("states the shipping and return numbers the shop actually promises", () => {
    const content = buildLlmsTxt();

    expect(content).toContain(formatRupees(FREE_SHIPPING_THRESHOLD));
    expect(content).toContain(formatRupees(FLAT_SHIPPING_RATE));
    expect(content).toContain(`${RETURN_WINDOW_DAYS} days`);
  });

  it("states both payment paths and the online-payment discount", () => {
    const content = buildLlmsTxt();

    expect(content).toContain("cash on delivery");
    expect(content).toContain(LEGAL_CONFIG.paymentProvider);
    expect(content).toContain(`${Math.round(ONLINE_PAYMENT_DISCOUNT_RATE * 100)}%`);
  });

  it("says there are no shopper accounts", () => {
    expect(buildLlmsTxt()).toContain("Guest checkout only");
  });

  it("counts the catalogue at request time rather than stating a number", () => {
    expect(buildLlmsTxt()).toContain(`${getAllProducts().length} pieces`);
  });

  it("lists every surfaced category by its real label, linked to its shop filter", () => {
    const content = buildLlmsTxt();

    expect(SURFACED_CATEGORIES).toHaveLength(EXPECTED_CATEGORY_COUNT);
    for (const category of SURFACED_CATEGORIES) {
      expect(content).toContain(
        `- [${category.label}](${PRODUCTION_ORIGIN}/shop?category=${category.slug})`,
      );
    }
  });

  it("lists every collection by its real label, linked to its shop filter", () => {
    const content = buildLlmsTxt();

    for (const collection of COLLECTIONS) {
      expect(content).toContain(
        `- [${collection.label}](${PRODUCTION_ORIGIN}/shop?collection=${collection.slug})`,
      );
    }
  });

  it("links the six public sections by absolute url", () => {
    const content = buildLlmsTxt();

    for (const path of ["/shop", "/contact", "/shipping", "/refund", "/terms", "/privacy"]) {
      expect(content).toContain(`](${PRODUCTION_ORIGIN}${path})`);
    }
  });

  it("says what the pieces are and are not, in the words /terms already uses", () => {
    const content = buildLlmsTxt();

    expect(content).toContain("artificial jewellery");
    expect(content).toContain("not precious metal or precious stone jewellery");
    expect(content).toContain("not sold as an investment");
  });

  /**
   * The catalogue gate's own rule, run over this file rather than over a product record.
   *
   * It is not a claim about the file's honesty — the paragraph above is what says the pieces
   * are not precious metal. It is a claim about what survives a paraphrase: this file exists to
   * be quoted by something that will rewrite it, and a barred term written down here even in a
   * denial is a term that can be quoted back with the denial dropped.
   */
  it("writes down none of the vocabulary the catalogue gate bars, not even to deny it", () => {
    expect(buildLlmsTxt()).not.toMatch(PRECIOUS_METAL_CLAIM);
  });

  it("names no path the sitemap refuses to publish, and no admin path", () => {
    const content = buildLlmsTxt();

    for (const path of NON_INDEXABLE_PATHS) {
      expect(content).not.toContain(`${PRODUCTION_ORIGIN}${path}`);
    }
    expect(content).not.toContain("/admin");
  });

  /**
   * The order-lookup page, guarded the way the honesty paragraph is: over the whole rendered
   * body, and against the idea rather than only the URL.
   *
   * `/track` is `noindex` and disallowed in `robots.txt` because with an order number in the
   * query string it renders the state of one person's order. Dropping the link while keeping a
   * sentence about looking orders up would defeat the point — an agent holding an order number
   * and told this shop looks orders up by one will find the page without being given it. So the
   * words go too, and the assertion is that the body offers no route to anybody's order at all.
   */
  it("offers no way to reach an order, by url or by description", () => {
    const content = buildLlmsTxt();

    expect(content).not.toContain("/track");
    expect(content).not.toMatch(/\btrack(?:ing|ed|s)?\b/i);
    expect(content).not.toMatch(/order (?:status|number|lookup)/i);
    expect(content).not.toMatch(/look(?:ing|s|ed)?\s+(?:up\s+)?(?:an?|your|their|the)?\s*orders?\b/i);
  });

  it("quotes no product price", () => {
    const content = buildLlmsTxt();
    const quotedAmounts = content.match(/₹[\d,]+/g) ?? [];

    expect(quotedAmounts).toEqual([
      formatRupees(FREE_SHIPPING_THRESHOLD),
      formatRupees(FLAT_SHIPPING_RATE),
    ]);
  });

  it("is served at the site root as plain text", async () => {
    expect(LLMS_TXT_PATH).toBe("/llms.txt");

    const response = llmsTxtRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toBe(buildLlmsTxt());
  });
});
