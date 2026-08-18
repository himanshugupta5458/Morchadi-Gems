import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/sitemap";

/**
 * Next's native sitemap route. The list itself is built in `lib/sitemap.ts` so it can be
 * tested without rendering a route.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap();
}
