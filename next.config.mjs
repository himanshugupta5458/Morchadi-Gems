import { buildSecurityHeaders } from "./config/security-headers.mjs";

const isDevelopment = process.env.NODE_ENV === "development";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  /** The framework and its version are not a shopper's business, and not an attacker's either. */
  poweredByHeader: false,
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
