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
 * The admin panel's internal route space, disallowed as a group.
 *
 * Written without a trailing slash so it covers `/admin` itself as well as everything beneath
 * it — `Disallow: /admin/` would leave the bare path crawlable. On the storefront domain these
 * paths do not serve the panel at all; middleware sends them to the home page
 * ([ADR-041](/docs/decisions/ADR-041-admin-subdomain-and-auth.md)). This line is the belt to
 * that redirect's braces, and it is what keeps `/admin` out of an index that was built before
 * either existed.
 */
export const ADMIN_DISALLOW_PATH = "/admin";

/**
 * Everything is crawlable except the funnel, the QA surface, the API and the admin panel. The
 * first of those is the same set of paths the sitemap refuses to publish, read from one
 * constant so the two files cannot disagree about what is indexable.
 */
export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...NON_INDEXABLE_PATHS, API_PREFIX, ADMIN_DISALLOW_PATH],
    },
    sitemap: absoluteUrl(SITEMAP_PATH),
  };
}

/**
 * The `robots.txt` served on the admin hostname, where the answer is simply "none of this".
 *
 * A subdomain is a separate origin to a crawler and needs its own file; the storefront's would
 * be actively wrong there, because it opens with `Allow: /` and its `Disallow: /admin` names a
 * prefix that does not exist on that host — every admin page sits at the root of it. This is
 * plain text rather than a `MetadataRoute.Robots` because Next's metadata route is bound to
 * `/robots.txt` at the app root, and the admin host reaches this through
 * `app/admin/robots.txt/route.ts` after the middleware rewrite.
 *
 * No `Sitemap:` line: there is no admin sitemap, and pointing at the storefront's from here
 * would invite a crawler onto the very host this file is refusing.
 */
export function buildAdminRobotsTxt(): string {
  return ["User-agent: *", "Disallow: /", ""].join("\n");
}
