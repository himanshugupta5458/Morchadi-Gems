import type { MetadataRoute } from "next";
import { CATEGORIES, COLLECTIONS } from "@/types/product";
import { LEGAL_CONFIG } from "@/lib/config";
import { buildCategoryHref, buildCollectionHref } from "@/lib/navigation";
import { getAllProducts } from "@/lib/products";
import { isProductInCollection } from "@/lib/shop";
import { absoluteUrl } from "@/lib/site-url";

type SitemapEntry = MetadataRoute.Sitemap[number];
type ChangeFrequency = NonNullable<SitemapEntry["changeFrequency"]>;

/**
 * When the indexable content last changed. The catalogue ships as code and carries no
 * timestamp of its own (the same absence that makes `sort=newest` a flag rather than a date,
 * see ADR-008), so this is written down and bumped when the catalogue or the page set moves.
 * A value derived from the build clock would tell a crawler every page changed on every
 * deploy, which is a worse lie than a slightly stale date.
 */
export const CONTENT_LAST_MODIFIED_ISO = "2026-08-18";

/**
 * The routes that exist to move an order along rather than to be found. They are `noindex`
 * in their own metadata and disallowed in `robots.txt`; listing them here as well would ask a
 * crawler to fetch a page we have just told it to ignore.
 *
 * `/track` joins them for the same reason `/order-confirmation` is here and then some: with an
 * order number in the query string it renders the state of one person's order, and an indexed
 * copy of that is somebody else's order status sitting in a search result. Without one it is a
 * single empty input box, which is nothing to rank.
 */
export const NON_INDEXABLE_PATHS: readonly string[] = [
  "/cart",
  "/address",
  "/payment",
  "/order-confirmation",
  "/track",
  "/style-guide",
];

interface RouteSpec {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  lastModified: string;
}

const CONTENT_ROUTES: readonly RouteSpec[] = [
  {
    path: "/",
    changeFrequency: "weekly",
    priority: 1,
    lastModified: CONTENT_LAST_MODIFIED_ISO,
  },
  {
    path: "/shop",
    changeFrequency: "weekly",
    priority: 0.9,
    lastModified: CONTENT_LAST_MODIFIED_ISO,
  },
  {
    path: "/about",
    changeFrequency: "monthly",
    priority: 0.5,
    lastModified: CONTENT_LAST_MODIFIED_ISO,
  },
  {
    path: "/contact",
    changeFrequency: "monthly",
    priority: 0.5,
    lastModified: CONTENT_LAST_MODIFIED_ISO,
  },
];

const POLICY_PATHS: readonly string[] = ["/shipping", "/refund", "/terms", "/privacy"];

const PRODUCT_PRIORITY = 0.8;
const CATEGORY_PRIORITY = 0.8;
const COLLECTION_PRIORITY = 0.7;
const POLICY_PRIORITY = 0.3;

function toEntry({
  path,
  changeFrequency,
  priority,
  lastModified,
}: RouteSpec): SitemapEntry {
  return { url: absoluteUrl(path), lastModified, changeFrequency, priority };
}

/**
 * A collection only earns a URL once something is in it. `gifting` currently has no tagged
 * product, and a sitemap entry for a page that renders "Nothing matches those filters" asks a
 * crawler to index an empty result set.
 */
function getPopulatedCollectionPaths(): string[] {
  const products = getAllProducts();

  return COLLECTIONS.filter((collection) =>
    products.some((product) => isProductInCollection(product, collection.slug)),
  ).map((collection) => buildCollectionHref(collection.slug));
}

export function buildSitemap(): MetadataRoute.Sitemap {
  const staticEntries = [
    ...CONTENT_ROUTES,
    ...POLICY_PATHS.map((path) => ({
      path,
      changeFrequency: "yearly" as ChangeFrequency,
      priority: POLICY_PRIORITY,
      lastModified: LEGAL_CONFIG.policyLastUpdatedIso,
    })),
  ].map(toEntry);

  const categoryEntries = CATEGORIES.map((category) =>
    toEntry({
      path: buildCategoryHref(category.slug),
      changeFrequency: "weekly",
      priority: CATEGORY_PRIORITY,
      lastModified: CONTENT_LAST_MODIFIED_ISO,
    }),
  );

  const collectionEntries = getPopulatedCollectionPaths().map((path) =>
    toEntry({
      path,
      changeFrequency: "weekly",
      priority: COLLECTION_PRIORITY,
      lastModified: CONTENT_LAST_MODIFIED_ISO,
    }),
  );

  const productEntries = getAllProducts().map((product) =>
    toEntry({
      path: `/product/${product.id}`,
      changeFrequency: "weekly",
      priority: PRODUCT_PRIORITY,
      lastModified: CONTENT_LAST_MODIFIED_ISO,
    }),
  );

  return [
    ...staticEntries,
    ...categoryEntries,
    ...collectionEntries,
    ...productEntries,
  ];
}
