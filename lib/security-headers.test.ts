import { describe, expect, it } from "vitest";
import {
  PERMISSIONS_POLICY,
  STRICT_TRANSPORT_SECURITY,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/config/security-headers.mjs";

function headerValue(key: string, isDevelopment = false): string {
  const header = buildSecurityHeaders(isDevelopment).find(
    (candidate) => candidate.key === key,
  );
  if (header === undefined) throw new Error(`No ${key} header is sent`);
  return header.value;
}

function directive(name: string, isDevelopment = false): string {
  const match = buildContentSecurityPolicy(isDevelopment)
    .split("; ")
    .find((candidate) => candidate === name || candidate.startsWith(`${name} `));
  if (match === undefined) throw new Error(`The policy has no ${name} directive`);
  return match;
}

describe("the security headers", () => {
  it("sends every header the audit asked for, on every route", () => {
    expect(buildSecurityHeaders().map((header) => header.key)).toEqual([
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ]);
  });

  it("commits to HTTPS for two years, subdomains included", () => {
    expect(STRICT_TRANSPORT_SECURITY).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headerValue("Strict-Transport-Security")).toBe(STRICT_TRANSPORT_SECURITY);
  });

  it("refuses content sniffing and cross-origin framing", () => {
    expect(headerValue("X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'self'");
  });

  it("leaks the origin but never the path to a third party", () => {
    expect(headerValue("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("turns off the three capabilities a jewellery shop never uses", () => {
    expect(PERMISSIONS_POLICY).toContain("camera=()");
    expect(PERMISSIONS_POLICY).toContain("microphone=()");
    expect(PERMISSIONS_POLICY).toContain("geolocation=()");
  });
});

describe("the content security policy", () => {
  it("defaults to this origin and forbids plugins outright", () => {
    expect(directive("default-src")).toBe("default-src 'self'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
  });

  it("lets the Cashfree SDK load, which is what makes the pay button work", () => {
    expect(directive("script-src")).toContain("https://sdk.cashfree.com");
  });

  it("lets the browser be handed to Cashfree's hosted checkout", () => {
    expect(directive("form-action")).toContain("https://payments.cashfree.com");
    expect(directive("form-action")).toContain("https://payments-test.cashfree.com");
    expect(directive("frame-src")).toContain("https://payments.cashfree.com");
  });

  it("lets the SDK reach both the sandbox and the production API", () => {
    expect(directive("connect-src")).toContain("https://sandbox.cashfree.com");
    expect(directive("connect-src")).toContain("https://api.cashfree.com");
  });

  it("lets the GA4 tag load, which is what makes analytics report anything", () => {
    expect(directive("script-src")).toContain("https://www.googletagmanager.com");
  });

  it("lets GA4 send its measurement beacons, including from the EU endpoint", () => {
    expect(directive("connect-src")).toContain("https://www.google-analytics.com");
    expect(directive("connect-src")).toContain("https://region1.google-analytics.com");
  });

  it("keeps the Google hosts out of every directive that does not need them", () => {
    for (const name of ["form-action", "frame-src", "img-src", "default-src"]) {
      expect(directive(name)).not.toContain("google");
    }
  });

  it("allows the inline forms next/image and next/font need, and no remote asset host", () => {
    expect(directive("img-src")).toBe("img-src 'self' data: blob:");
    expect(directive("font-src")).toBe("font-src 'self' data:");
    expect(directive("style-src")).toContain("'unsafe-inline'");
  });

  it("allows eval in development only, never in what ships", () => {
    expect(directive("script-src", true)).toContain("'unsafe-eval'");
    expect(directive("script-src", false)).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy()).not.toContain("'unsafe-eval'");
  });

  it("names no wildcard host anywhere, in either mode", () => {
    for (const policy of [
      buildContentSecurityPolicy(false),
      buildContentSecurityPolicy(true),
    ]) {
      expect(policy).not.toContain("*");
      expect(policy).not.toContain("http://");
    }
  });

  it("upgrades any stray plaintext subresource", () => {
    expect(buildContentSecurityPolicy()).toContain("upgrade-insecure-requests");
  });
});
