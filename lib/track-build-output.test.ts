import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NON_INDEXABLE_PATHS } from "@/lib/sitemap";
import { TRACK_ORDER_PATH } from "@/lib/navigation";

/**
 * This file reads what `next build` emitted, not what the source says it will emit.
 *
 * `lib/sitemap.test.ts` and `lib/robots.test.ts` already prove that `buildSitemap()` omits
 * `/track` and that `buildRobots()` disallows it. Neither proves that the two files a crawler
 * actually fetches say so — a route segment config, a stray `generateSitemaps`, or a second
 * robots source would change the shipped bytes without changing either function. It is the same
 * method the catalogue's `pricing.cost` is held to, where the assertion that margin data never
 * reaches the browser is a grep over `.next/static` and not a reading of the module that
 * narrows it (docs/testing/RESULT-2026-08-20-order-capture.md, TC-31).
 */
const BUILD_HINT =
  "run `npm run build` first, and after any `next lint` — this file reads real build output";

const SITEMAP_BODY = ".next/server/app/sitemap.xml.body";
const ROBOTS_BODY = ".next/server/app/robots.txt.body";

/**
 * The compiled `/track` route. Its presence is what makes the two absences below mean
 * something: a build that predates the tracking page would leave `/track` out of the sitemap
 * for the uninteresting reason that the page did not exist when it ran.
 */
const TRACK_PAGE_CHUNK = ".next/server/app/(storefront)/track/page.js";

/**
 * `next build` writes this last, so its presence is what separates a finished production build
 * from a directory that merely has files in it. That distinction is not hypothetical: `next
 * lint` rewrites some of `.next`'s manifests in place and leaves the rest of a previous build
 * half-standing, which is exactly the state a gate of the shape
 * `lint && test:run && build` hands these assertions.
 */
const BUILD_ID = ".next/BUILD_ID";

const REQUIRED_BUILD_ARTEFACTS: readonly string[] = [
  BUILD_ID,
  SITEMAP_BODY,
  ROBOTS_BODY,
  TRACK_PAGE_CHUNK,
];

const missingArtefact = REQUIRED_BUILD_ARTEFACTS.find((path) => !existsSync(path)) ?? null;

const unavailableReason =
  missingArtefact === null ? null : `${missingArtefact} is not there — ${BUILD_HINT}`;

function buildOutput(path: string): string {
  return readFileSync(path, "utf8");
}

describe("the build these assertions read", () => {
  it("contains the compiled /track route", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    expect(existsSync(TRACK_PAGE_CHUNK)).toBe(true);
    expect(buildOutput(TRACK_PAGE_CHUNK)).toContain("Track Your Order");
  });

  it("emitted a sitemap that is a sitemap and a robots.txt that is a robots.txt", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    expect(buildOutput(SITEMAP_BODY)).toContain("<urlset");
    expect(buildOutput(ROBOTS_BODY)).toContain("User-Agent: *");
  });
});

describe("the sitemap.xml a crawler downloads", () => {
  it("does not mention /track anywhere in it", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const sitemap = buildOutput(SITEMAP_BODY);

    expect(sitemap).not.toContain(TRACK_ORDER_PATH);
    expect(sitemap.toLowerCase()).not.toContain("track");
  });

  it("does not mention any of the other non-indexable paths either", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const sitemap = buildOutput(SITEMAP_BODY);

    for (const path of NON_INDEXABLE_PATHS) {
      expect(sitemap, `${path} was published in the sitemap`).not.toMatch(
        new RegExp(`<loc>[^<]*${path}</loc>`),
      );
    }
  });

  /**
   * The control. A grep that finds nothing proves nothing until the same grep, over the same
   * file, finds the things that are supposed to be there.
   */
  it("does list the pages a shopper is meant to find", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const sitemap = buildOutput(SITEMAP_BODY);

    for (const path of ["/shop", "/about", "/contact", "/refund", "/shipping"]) {
      expect(sitemap, `${path} is missing from the built sitemap`).toMatch(
        new RegExp(`<loc>[^<]*${path}</loc>`),
      );
    }

    expect(sitemap).toMatch(/<loc>[^<]*\/product\/P010<\/loc>/);
  });
});

describe("the robots.txt a crawler downloads", () => {
  it("disallows /track by name", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const robots = buildOutput(ROBOTS_BODY);
    const disallowed = Array.from(robots.matchAll(/^Disallow:\s*(\S+)$/gm)).map(
      (match) => match[1],
    );

    expect(disallowed).toContain(TRACK_ORDER_PATH);
  });

  it("disallows every non-indexable path, plus the API and the panel", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const robots = buildOutput(ROBOTS_BODY);
    const disallowed = Array.from(robots.matchAll(/^Disallow:\s*(\S+)$/gm)).map(
      (match) => match[1],
    );

    expect(disallowed).toEqual([...NON_INDEXABLE_PATHS, "/api/", "/admin"]);
  });

  /**
   * The control, again: the same parse over the same file must not disallow the shop.
   */
  it("does not disallow the pages the sitemap publishes", (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const robots = buildOutput(ROBOTS_BODY);
    const disallowed = Array.from(robots.matchAll(/^Disallow:\s*(\S+)$/gm)).map(
      (match) => match[1],
    );

    expect(disallowed.length).toBeGreaterThan(0);
    for (const path of ["/", "/shop", "/about", "/contact", "/refund", "/shipping"]) {
      expect(disallowed, `${path} was disallowed in the built robots.txt`).not.toContain(path);
    }

    expect(robots).toContain("Allow: /");
  });
});

/**
 * The standalone tree is what the Docker image runs (ADR-032). It is built from the same
 * routes, but it is a separate copy, and it is the copy production serves.
 */
describe("the standalone copy the container ships", () => {
  const STANDALONE_SITEMAP = ".next/standalone/.next/server/app/sitemap.xml.body";
  const STANDALONE_ROBOTS = ".next/standalone/.next/server/app/robots.txt.body";

  const standaloneMissing =
    [STANDALONE_SITEMAP, STANDALONE_ROBOTS].find((path) => !existsSync(path)) ?? null;

  const standaloneReason =
    standaloneMissing === null ? null : `${standaloneMissing} is not there — ${BUILD_HINT}`;

  it("says the same thing about /track as the build it was copied from", (ctx) => {
    ctx.skip(standaloneReason !== null, standaloneReason ?? undefined);

    expect(buildOutput(STANDALONE_SITEMAP)).not.toContain(TRACK_ORDER_PATH);
    expect(buildOutput(STANDALONE_ROBOTS)).toContain(`Disallow: ${TRACK_ORDER_PATH}`);
  });
});
