import { buildSecurityHeaders } from "./config/security-headers.mjs";

const isDevelopment = process.env.NODE_ENV === "development";

/**
 * The one quality `/_next/image` will optimise at, which is the one quality this site asks for.
 *
 * `next/image` defaults to `q=75` and no component here passes a `quality` prop, so 75 is not a
 * preference — it is the entire set of values the ten render sites can produce. Left
 * unconfigured, the endpoint nevertheless accepts every integer from 1 to 100, and each one is a
 * distinct file written to `.next/cache/images`. Multiplied by the 16 widths Next allows and the
 * 68 images under `public/`, that is 108,800 cache entries an unauthenticated `GET` can mint, on
 * a container that declares no volume — so the disk it fills is the VPS disk carrying the
 * Postgres volume. Naming the single value collapses that to 1,088 and changes no URL: with one
 * entry in this array Next resolves an absent `quality` prop to the member nearest its own
 * default of 75, which is 75.
 *
 * Adding a `quality` prop anywhere means adding its value here, or `next dev` throws
 * `Invalid quality prop … does not match images.qualities`. That error is the point — the
 * alternative is a production 400 on an image that renders fine locally.
 *
 * Next 16 makes `[75]` its own default, so this line is the upgrade's behaviour brought forward
 * rather than a divergence from it. See
 * [ADR-049](/docs/decisions/ADR-049-next-14-advisory-triage-and-upgrade-scope.md).
 */
export const OPTIMISED_IMAGE_QUALITIES = [75];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  /** The framework and its version are not a shopper's business, and not an attacker's either. */
  poweredByHeader: false,
  images: {
    qualities: OPTIMISED_IMAGE_QUALITIES,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(isDevelopment),
      },
    ];
  },
};

export default nextConfig;
