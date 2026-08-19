import type { Metadata } from "next";
import { SITE_CONFIG } from "@/lib/config";

export interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
}

/**
 * A page's `openGraph` and `twitter` blocks each **replace** the layout's rather than merging
 * into them, so a page that sets one field silently loses `type`, `siteName`, `locale`, `card`
 * and `images`
 * ([ADR-007](/docs/decisions/ADR-007-home-composition.md)). This restates the whole block
 * once so no page has to remember to.
 *
 * Pages written before this helper existed still hand-roll the block; they are correct, just
 * repetitive. Anything new should come through here.
 */
export function buildPageMetadata({
  title,
  description,
  path,
}: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_CONFIG.brandName,
      locale: "en_IN",
      url: path,
      title: `${title} · ${SITE_CONFIG.brandName}`,
      description,
      images: [SITE_CONFIG.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${SITE_CONFIG.brandName}`,
      description,
      images: [SITE_CONFIG.ogImage.url],
    },
  };
}

/**
 * The Open Graph type a product page declares. `product` is a valid Open Graph object type
 * and is what a share card for a purchasable item should say, but it is outside the union
 * Next's typed `openGraph.type` accepts — passing it there throws at render time rather than
 * failing to compile.
 *
 * So the page omits `openGraph.type` and states it here instead, through `metadata.other`.
 * The one cost is the attribute: Next writes `other` entries as `name="og:type"` where the
 * Open Graph specification asks for `property="og:type"`. Lenient parsers read it either way;
 * strict ones read no `og:type` at all, which is the same position the page was in before,
 * rather than a worse one. The correct attribute needs either a Next release whose union
 * includes `product` or an escape hatch for raw head tags. See
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
 *
 * Nothing a search engine needs rides on this tag: what tells Google a page sells a thing is
 * the `Product` JSON-LD, which is emitted in full.
 */
export const PRODUCT_OPEN_GRAPH_TYPE = "product";

export function buildProductOpenGraphTypeMeta(): NonNullable<Metadata["other"]> {
  return { "og:type": PRODUCT_OPEN_GRAPH_TYPE };
}
