import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import nextConfig, { OPTIMISED_IMAGE_QUALITIES } from "@/next.config.mjs";

/**
 * Next's own `next/image` loader, imported rather than reimplemented.
 *
 * The whole claim under test is that restricting `images.qualities` changes no URL this site
 * emits and rejects every URL it does not. A local copy of Next's resolution rule would test the
 * copy; this tests the function that actually builds the `src` attributes in production.
 */
type ImageLoaderArgs = {
  config: Record<string, unknown>;
  src: string;
  width: number;
  quality?: number;
};

type ImageLoader = (args: ImageLoaderArgs) => string;

const loaderModule = createRequire(import.meta.url)(
  "next/dist/shared/lib/image-loader.js",
) as { default: ImageLoader | { default: ImageLoader } };

const defaultLoader: ImageLoader =
  typeof loaderModule.default === "function"
    ? loaderModule.default
    : loaderModule.default.default;

const NEXT_DEFAULT_QUALITY = 75;

const NEXT_DEFAULT_WIDTHS = {
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
};

function imageConfig(qualities: number[] | undefined): Record<string, unknown> {
  return {
    ...NEXT_DEFAULT_WIDTHS,
    path: "/_next/image",
    loader: "default",
    domains: [],
    remotePatterns: [],
    formats: ["image/webp"],
    qualities,
  };
}

function buildImageSrc(qualities: number[] | undefined, quality?: number): string {
  return defaultLoader({
    config: imageConfig(qualities),
    src: "/products/P043.webp",
    width: 1920,
    quality,
  });
}

const COMPONENTS_DIRECTORY = fileURLToPath(new URL("../components", import.meta.url));

function componentSources(): Array<{ file: string; source: string }> {
  return readdirSync(COMPONENTS_DIRECTORY)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => ({
      file,
      source: readFileSync(`${COMPONENTS_DIRECTORY}/${file}`, "utf8"),
    }));
}

describe("the image optimiser's accepted qualities", () => {
  it("is declared on the config Next actually ships, not only as a constant", () => {
    expect(nextConfig.images?.qualities).toEqual(OPTIMISED_IMAGE_QUALITIES);
  });

  it("names exactly the one quality this site asks for", () => {
    expect(OPTIMISED_IMAGE_QUALITIES).toEqual([NEXT_DEFAULT_QUALITY]);
  });

  it("is a short allowlist rather than the 1-100 range the endpoint would otherwise accept", () => {
    expect(OPTIMISED_IMAGE_QUALITIES.length).toBeLessThanOrEqual(3);
    expect(OPTIMISED_IMAGE_QUALITIES.every((quality) => Number.isInteger(quality))).toBe(
      true,
    );
    expect(
      OPTIMISED_IMAGE_QUALITIES.every((quality) => quality >= 1 && quality <= 100),
    ).toBe(true);
  });
});

describe("restricting the qualities", () => {
  it("leaves every URL this site emits byte-identical", () => {
    const before = buildImageSrc(undefined);
    const after = buildImageSrc(OPTIMISED_IMAGE_QUALITIES);

    expect(after).toBe(before);
    expect(after).toBe(`/_next/image?url=%2Fproducts%2FP043.webp&w=1920&q=${NEXT_DEFAULT_QUALITY}`);
  });

  it("resolves an absent quality prop to the configured value at every width", () => {
    const everyWidth = [
      ...NEXT_DEFAULT_WIDTHS.deviceSizes,
      ...NEXT_DEFAULT_WIDTHS.imageSizes,
    ];

    for (const width of everyWidth) {
      const src = defaultLoader({
        config: imageConfig(OPTIMISED_IMAGE_QUALITIES),
        src: "/products/P043.webp",
        width,
      });
      expect(src).toBe(`/_next/image?url=%2Fproducts%2FP043.webp&w=${width}&q=${NEXT_DEFAULT_QUALITY}`);
    }
  });

  it("rejects a quality outside the allowlist that the unrestricted endpoint would have served", () => {
    const disallowed = 90;

    expect(OPTIMISED_IMAGE_QUALITIES).not.toContain(disallowed);
    expect(buildImageSrc(undefined, disallowed)).toContain(`&q=${disallowed}`);
    expect(() => buildImageSrc(OPTIMISED_IMAGE_QUALITIES, disallowed)).toThrowError(
      /Invalid quality prop \(90\)/,
    );
  });

  it("rejects the ends of the range a disk-filling request would sweep", () => {
    for (const disallowed of [1, 50, 74, 76, 99, 100]) {
      expect(() => buildImageSrc(OPTIMISED_IMAGE_QUALITIES, disallowed)).toThrowError(
        /does not match `images.qualities`/,
      );
    }
  });
});

describe("what makes the single-value allowlist safe", () => {
  it("holds because no component passes a quality prop", () => {
    const offenders = componentSources()
      .filter(({ source }) => /<Image[^>]*\squality=/.test(source))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });

  it("holds because no component asks for a blur placeholder", () => {
    const offenders = componentSources()
      .filter(({ source }) => /placeholder=["{]?blur|blurDataURL/.test(source))
      .map(({ file }) => file);

    expect(offenders).toEqual([]);
  });
});
