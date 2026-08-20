import { afterEach, beforeEach, describe, expect, it } from "vitest";
import nextRobots from "@/app/robots";
import { GET as adminRobotsRoute } from "@/app/admin/robots.txt/route";
import { ADMIN_DISALLOW_PATH, SITEMAP_PATH, buildAdminRobotsTxt, buildRobots } from "@/lib/robots";
import { NON_INDEXABLE_PATHS } from "@/lib/sitemap";

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

function disallowList(): string[] {
  const { disallow } = buildRobots().rules as { disallow: string[] };
  return disallow;
}

describe("robots.txt", () => {
  it("is what the route returns", () => {
    expect(nextRobots()).toEqual(buildRobots());
  });

  it("allows every crawler at the site root", () => {
    const rules = buildRobots().rules as { userAgent: string; allow: string };

    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
  });

  it("disallows the cart, all three checkout steps and the QA surface", () => {
    const disallow = disallowList();

    for (const path of [
      "/cart",
      "/address",
      "/payment",
      "/order-confirmation",
      "/style-guide",
    ]) {
      expect(disallow).toContain(path);
    }
  });

  it("disallows the API as a group", () => {
    expect(disallowList()).toContain("/api/");
  });

  it("disallows the admin panel, without a trailing slash so /admin itself is covered", () => {
    expect(disallowList()).toContain("/admin");
    expect(ADMIN_DISALLOW_PATH).toBe("/admin");
    expect(disallowList()).not.toContain("/admin/");
  });

  it("disallows exactly what the sitemap refuses to publish, plus the API and the panel", () => {
    expect(disallowList()).toEqual([...NON_INDEXABLE_PATHS, "/api/", ADMIN_DISALLOW_PATH]);
  });

  it("does not disallow anything a shopper is meant to find", () => {
    const disallow = disallowList();

    for (const path of ["/", "/shop", "/about", "/contact", "/refund", "/shipping"]) {
      expect(disallow).not.toContain(path);
    }
  });

  it("points at the sitemap by absolute url", () => {
    expect(buildRobots().sitemap).toBe(`${PRODUCTION_ORIGIN}${SITEMAP_PATH}`);
  });
});

describe("robots.txt on the admin subdomain", () => {
  it("refuses the whole host rather than repeating the storefront's rules", () => {
    expect(buildAdminRobotsTxt()).toBe("User-agent: *\nDisallow: /\n");
  });

  it("names no sitemap, since pointing at one would invite a crawler onto that host", () => {
    expect(buildAdminRobotsTxt()).not.toContain("Sitemap");
    expect(buildAdminRobotsTxt()).not.toContain(PRODUCTION_ORIGIN);
  });

  it("allows nothing — the storefront's Allow: / must not leak onto the panel's host", () => {
    expect(buildAdminRobotsTxt()).not.toContain("Allow:");
  });

  it("is what the route serves, as plain text", async () => {
    const response = adminRobotsRoute();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    await expect(response.text()).resolves.toBe(buildAdminRobotsTxt());
  });
});
