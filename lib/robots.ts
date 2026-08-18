import type { MetadataRoute } from "next";
import { NON_INDEXABLE_PATHS } from "@/lib/sitemap";
import { absoluteUrl } from "@/lib/site-url";

export const SITEMAP_PATH = "/sitemap.xml";

/**
 * The API routes. `/api/create-order` and `/api/verify-order` answer a browser mid-checkout
 * and have nothing a search result could show, so they are disallowed as a group rather than
 * one at a time.
 */
const API_PREFIX = "/api/";

/**
 * Everything is crawlable except the funnel, the QA surface and the API. The disallow list is
 * the same set of paths the sitemap refuses to publish, read from one constant so the two
 * files cannot disagree about what is indexable.
 */
export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...NON_INDEXABLE_PATHS, API_PREFIX],
    },
    sitemap: absoluteUrl(SITEMAP_PATH),
  };
}
