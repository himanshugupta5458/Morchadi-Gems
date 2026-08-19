/**
 * The response headers every route on this site is served with.
 *
 * Plain JavaScript rather than TypeScript because `next.config.mjs` is the only consumer that
 * matters and Next 14 cannot load a TypeScript config. It is a module rather than a literal
 * inside that config so `lib/security-headers.test.ts` can assert the policy without booting
 * Next.
 *
 * The whole file is a set of promises made to a browser, so each one says what it forbids and
 * what had to stay allowed for the site to keep working. See
 * [ADR-034](/docs/decisions/ADR-034-seo-audit-remediation.md).
 */

/**
 * Two years, subdomains included, and marked for the preload list. Long because the point of
 * HSTS is that a browser refuses plaintext before it has ever been told to; a short window
 * leaves the first request of every new visitor downgradeable.
 *
 * `preload` is a request to be hardcoded into browsers, and it is close to irreversible —
 * submit the domain at hstspreload.org only once every subdomain is genuinely on HTTPS.
 */
export const STRICT_TRANSPORT_SECURITY = "max-age=63072000; includeSubDomains; preload";

/**
 * What the checkout needs, and nothing wider.
 *
 * `@cashfreepayments/cashfree-js` does not bundle the payment logic: `load()` injects a
 * `<script>` pointing at `sdk.cashfree.com`, so that host has to be a script source or the pay
 * button silently fails. `checkout({ redirectTarget: "_self" })` then navigates the tab to
 * `payments.cashfree.com`, which is a navigation rather than a fetch — hence `form-action`,
 * which governs where a page may send the shopper. The sandbox and production API origins are
 * listed for `connect-src` because the SDK talks to whichever of them matches its mode.
 *
 * `frame-src` is here for the modes of the SDK that render Cashfree in an iframe. This
 * integration redirects instead, so nothing uses it today; it is listed because switching to
 * a drop-in checkout would otherwise fail in production with a console error nobody sees
 * until an order is lost.
 */
const CASHFREE_HOSTS = [
  "https://sdk.cashfree.com",
  "https://payments.cashfree.com",
  "https://payments-test.cashfree.com",
  "https://api.cashfree.com",
  "https://sandbox.cashfree.com",
];

/**
 * Both inline allowances are Next's, not ours.
 *
 * `script-src 'unsafe-inline'`: Next serves an inline bootstrap script on every page that
 * hands the App Router its flight data. The supported way to allow it precisely is a per
 * request nonce, and a nonce has to be generated per response — which turns every one of the
 * 49 statically prerendered product pages into a dynamic render. That trade is not worth it
 * on a site with no user-generated content and no third-party script surface beyond Cashfree.
 *
 * `style-src 'unsafe-inline'`: Next inlines critical CSS, and `next/font` writes a `<style>`
 * block with the font-face declarations.
 *
 * Neither weakens the header's real job here, which is bounding *where* code and connections
 * may come from — the origins above and nowhere else.
 */
const SELF = "'self'";
const NONE = "'none'";
const UNSAFE_INLINE = "'unsafe-inline'";

/**
 * `'unsafe-eval'` in development only. The Next dev server's React Refresh runtime evaluates
 * code at runtime; the production bundle does not, and shipping the allowance to production
 * would hand an injected string a way to execute.
 */
function scriptSources(isDevelopment) {
  return [
    SELF,
    UNSAFE_INLINE,
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ...CASHFREE_HOSTS,
  ];
}

/**
 * `img-src` carries `data:` and `blob:` for `next/image`, which emits inlined blur
 * placeholders and can hand the browser object URLs. Every photograph this site renders is
 * local, so no remote image host is listed.
 *
 * `font-src` needs no Google host: `next/font/google` downloads the faces at build time and
 * serves them from this origin.
 */
export function buildContentSecurityPolicy(isDevelopment = false) {
  const directives = [
    ["default-src", [SELF]],
    ["base-uri", [SELF]],
    ["object-src", [NONE]],
    ["frame-ancestors", [SELF]],
    ["form-action", [SELF, ...CASHFREE_HOSTS]],
    ["script-src", scriptSources(isDevelopment)],
    ["style-src", [SELF, UNSAFE_INLINE]],
    ["img-src", [SELF, "data:", "blob:"]],
    ["font-src", [SELF, "data:"]],
    ["connect-src", [SELF, ...CASHFREE_HOSTS]],
    ["frame-src", [SELF, ...CASHFREE_HOSTS]],
    ["worker-src", [SELF, "blob:"]],
    ["manifest-src", [SELF]],
    ["upgrade-insecure-requests", []],
  ];

  return directives
    .map(([directive, sources]) =>
      sources.length === 0 ? directive : `${directive} ${sources.join(" ")}`,
    )
    .join("; ");
}

/**
 * The three capabilities a jewellery shop has no use for, switched off for this document and
 * for anything it embeds. An empty allowlist is the "deny everywhere" form.
 */
export const PERMISSIONS_POLICY = "camera=(), microphone=(), geolocation=()";

export function buildSecurityHeaders(isDevelopment = false) {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(isDevelopment),
    },
    { key: "Strict-Transport-Security", value: STRICT_TRANSPORT_SECURITY },
    { key: "X-Content-Type-Options", value: "nosniff" },
    /**
     * `SAMEORIGIN` rather than `DENY`, matching `frame-ancestors 'self'`. The two headers say
     * the same thing to different generations of browser, and saying different things is how
     * a page ends up framed by whichever one a client happens to honour.
     */
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    /**
     * A cross-origin request carries the origin but not the path, so Cashfree learns a
     * shopper came from this store and not which piece they were looking at. Same-origin
     * navigation keeps the full referrer, which is what analytics on our own pages would
     * need.
     */
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
}
