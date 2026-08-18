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
