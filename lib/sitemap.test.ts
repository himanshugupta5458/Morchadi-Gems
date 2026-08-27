import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CATEGORIES, COLLECTIONS, SURFACED_CATEGORIES } from "@/types/product";
import nextSitemap from "@/app/sitemap";
import { LEGAL_CONFIG } from "@/lib/config";
import { getAllProducts } from "@/lib/products";
import { isProductInCollection } from "@/lib/shop";
import { CONTENT_LAST_MODIFIED_ISO, NON_INDEXABLE_PATHS, buildSitemap } from "@/lib/sitemap";

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

function urlsOf(): string[] {
  return buildSitemap().map((entry) => entry.url);
}

describe("the sitemap", () => {
  it("is what the route returns", () => {
    expect(nextSitemap()).toEqual(buildSitemap());
  });

  it("lists the eight indexable static routes", () => {
    const urls = urlsOf();

    for (const path of [
      "/",
      "/shop",
      "/about",
      "/contact",
      "/terms",
      "/privacy",
      "/refund",
      "/shipping",
    ]) {
      expect(urls).toContain(`${PRODUCTION_ORIGIN}${path}`);
    }
  });

  it("lists every product, one entry each", () => {
    const products = getAllProducts();
    expect(products.length).toBeGreaterThan(0);

    const productUrls = urlsOf().filter((url) => url.includes("/product/"));
    expect(productUrls).toHaveLength(products.length);

    for (const product of products) {
      expect(productUrls).toContain(`${PRODUCTION_ORIGIN}/product/${product.id}`);
    }
  });

  it("lists every surfaced category, and no pending one", () => {
    const urls = urlsOf();
    expect(SURFACED_CATEGORIES).toHaveLength(11);

    for (const category of SURFACED_CATEGORIES) {
      expect(urls).toContain(`${PRODUCTION_ORIGIN}/shop?category=${category.slug}`);
    }
    for (const category of CATEGORIES.filter((entry) => entry.status === "pending")) {
      expect(urls).not.toContain(`${PRODUCTION_ORIGIN}/shop?category=${category.slug}`);
    }
  });

  it("lists only the collections that currently hold something", () => {
    const urls = urlsOf();
    const products = getAllProducts();

    for (const collection of COLLECTIONS) {
      const isPopulated = products.some((product) =>
        isProductInCollection(product, collection.slug),
      );

      expect(
        urls.includes(`${PRODUCTION_ORIGIN}/shop?collection=${collection.slug}`),
        collection.slug,
      ).toBe(isPopulated);
    }
  });

  it("excludes the cart, every checkout step and the QA surface", () => {
    const urls = urlsOf();

    for (const path of NON_INDEXABLE_PATHS) {
      expect(urls).not.toContain(`${PRODUCTION_ORIGIN}${path}`);
      expect(urls.some((url) => url.includes(path))).toBe(false);
    }
  });

  it("excludes the API routes", () => {
    expect(urlsOf().some((url) => url.includes("/api/"))).toBe(false);
  });

  it("excludes the admin panel, on any hostname", () => {
    expect(urlsOf().some((url) => url.includes("/admin"))).toBe(false);
  });

  it("gives every url absolutely, against the configured origin", () => {
    for (const url of urlsOf()) {
      expect(url.startsWith(`${PRODUCTION_ORIGIN}/`)).toBe(true);
    }
  });

  it("repeats no url", () => {
    const urls = urlsOf();
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("ranks home highest, then shop, then products, with policies lowest", () => {
    const byUrl = new Map(buildSitemap().map((entry) => [entry.url, entry]));
    const priorityOf = (path: string): number =>
      byUrl.get(`${PRODUCTION_ORIGIN}${path}`)?.priority ?? -1;

    expect(priorityOf("/")).toBe(1);
    expect(priorityOf("/shop")).toBeLessThan(priorityOf("/"));
    expect(priorityOf("/product/P001")).toBeGreaterThan(priorityOf("/about"));
    expect(priorityOf("/refund")).toBeLessThan(priorityOf("/about"));
    expect(priorityOf("/terms")).toBe(0.3);
  });

  it("gives every entry a valid priority, change frequency and last-modified date", () => {
    const validFrequencies = [
      "always",
      "hourly",
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "never",
    ];

    for (const entry of buildSitemap()) {
      expect(entry.priority).toBeGreaterThan(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
      expect(validFrequencies).toContain(entry.changeFrequency);
      expect(entry.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("dates the policies from the policy config and everything else from the content date", () => {
    const byUrl = new Map(buildSitemap().map((entry) => [entry.url, entry]));

    expect(byUrl.get(`${PRODUCTION_ORIGIN}/refund`)?.lastModified).toBe(
      LEGAL_CONFIG.policyLastUpdatedIso,
    );
    expect(byUrl.get(`${PRODUCTION_ORIGIN}/product/P001`)?.lastModified).toBe(
      CONTENT_LAST_MODIFIED_ISO,
    );
  });
});
