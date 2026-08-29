/**
 * Where the admin panel lives, and who is allowed to reach it.
 *
 * This module is deliberately free of `server-only`, of Prisma and of every Node built-in:
 * `middleware.ts` imports it, and Next 14 runs middleware on the Edge runtime, which has
 * neither a database driver nor `node:crypto`'s bcrypt. Everything here is a pure function
 * over a hostname, a pathname and a boolean, which is also why it is testable without a
 * request, a server or a browser. See
 * [ADR-041](/docs/decisions/ADR-041-admin-subdomain-and-auth.md).
 */

/**
 * The internal route space the admin panel occupies. In production the shopper-facing URL of
 * every one of these pages has no `/admin` in it at all — `admin.morchadigems.com/login` is
 * rewritten to `/admin/login` inside the same deployment — so this prefix is an
 * implementation detail of the file system, not an address anyone types.
 */
export const ADMIN_PATH_PREFIX = "/admin";

export const ADMIN_LOGIN_PATH = "/admin/login";
export const ADMIN_LOGIN_API_PATH = "/admin/api/login";
export const ADMIN_LOGOUT_API_PATH = "/admin/api/logout";

/**
 * The admin host's own `robots.txt`. A subdomain is a separate origin to a crawler and needs
 * its own file; because both hostnames are served by one deployment, the rewrite is what
 * makes `admin.morchadigems.com/robots.txt` land here rather than on the storefront's.
 */
export const ADMIN_ROBOTS_PATH = "/admin/robots.txt";

/**
 * The session cookie's name, defined here rather than in `lib/admin-session.ts` because
 * middleware needs to read it and cannot import a `server-only` module. There is no
 * `__Host-` prefix: that prefix mandates `Secure`, and the cookie is deliberately not
 * `Secure` over plain HTTP in local development.
 */
export const ADMIN_SESSION_COOKIE = "morchadi_admin_session";

/** The production admin hostname when `ADMIN_HOSTNAME` is unset. */
export const DEFAULT_ADMIN_HOSTNAME = "admin.morchadigems.com";

const LOCAL_HOSTNAMES: readonly string[] = ["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"];

/**
 * Codespaces and Gitpod forward a port onto a generated HTTPS hostname. They are development
 * machines with production-looking names, so they are named here rather than inferred.
 */
const LOCAL_HOSTNAME_SUFFIXES: readonly string[] = [
  ".localhost",
  ".github.dev",
  ".gitpod.io",
  ".ngrok-free.app",
];

/**
 * The paths that must answer without a session. Login and its endpoint would be unreachable
 * otherwise; logout is here so a stale cookie can always be cleared rather than redirected
 * into the login page it is trying to leave; `robots.txt` is here because a crawler that gets
 * a redirect instead of a file learns nothing about what it may not index.
 */
const PUBLIC_ADMIN_PATHS: readonly string[] = [
  ADMIN_LOGIN_PATH,
  ADMIN_LOGIN_API_PATH,
  ADMIN_LOGOUT_API_PATH,
  ADMIN_ROBOTS_PATH,
];

/**
 * What middleware should do with one request.
 *
 * `continue` hands the request to the router untouched, `rewrite` serves a different internal
 * path under the same URL, and `redirect` sends the browser somewhere else.
 */
export type AdminRouteDecision =
  | { kind: "continue" }
  | { kind: "rewrite"; internalPath: string }
  | { kind: "redirect"; location: string };

export interface AdminRouteRequest {
  /** The `Host` header, already lowercased and stripped of its port. */
  hostname: string;
  pathname: string;
  hasSessionCookie: boolean;
}

/**
 * The hostname the admin panel answers on in production, from `ADMIN_HOSTNAME`.
 *
 * Read from the environment rather than written down for the same reason `APP_BASE_URL` is
 * (`lib/site-url.ts`): the domain is a deployment's property, not the code's, and a repository
 * that hardcodes one cannot be run on another. A blank or whitespace value falls back to the
 * default rather than producing a hostname no request can ever match.
 */
export function resolveAdminHostname(): string {
  const configured = process.env.ADMIN_HOSTNAME?.trim().toLowerCase();
  return configured === undefined || configured.length === 0
    ? DEFAULT_ADMIN_HOSTNAME
    : configured;
}

/**
 * The first value of a possibly comma-separated forwarding header. A request that passed
 * through two proxies arrives with `X-Forwarded-Host: real.example, inner.example`, and the
 * leftmost entry is the one the browser asked for.
 */
export function firstForwardedValue(headerValue: string | null | undefined): string {
  return headerValue?.split(",")[0]?.trim().toLowerCase() ?? "";
}

/**
 * A `Host` header reduced to the part worth comparing: lowercased, with any port removed, so
 * `localhost:3000` and `LOCALHOST` both answer to `localhost`. An IPv6 literal keeps its
 * brackets, which is what distinguishes its colons from a port separator.
 */
export function normaliseHostname(hostHeader: string | null | undefined): string {
  const trimmed = firstForwardedValue(hostHeader);
  if (trimmed.length === 0) return "";
  if (trimmed.startsWith("[")) return trimmed.replace(/\]:\d+$/, "]");
  return trimmed.replace(/:\d+$/, "");
}

/** True for the hostnames a developer's own machine answers to, and for forwarded-port hosts. */
export function isLocalDevelopmentHostname(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.includes(hostname)) return true;
  return LOCAL_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/**
 * Whether `/admin/*` may be reached by path on this hostname.
 *
 * There is no admin subdomain to point a browser at while developing, so the internal route
 * space is exposed directly instead — `localhost:3000/admin/login`. Two independent signals
 * have to agree that this is not production before that happens: a non-production `NODE_ENV`
 * **or** a hostname that is plainly a development machine. The `or` is deliberate. A
 * production build run locally (`npm run build && npm start`) sets `NODE_ENV=production` and
 * would otherwise be untestable, and a deployment that forgot to set `NODE_ENV` is still
 * serving a public hostname, where the redirect below applies.
 */
export function isLocalDevelopmentRequest(hostname: string): boolean {
  return process.env.NODE_ENV !== "production" || isLocalDevelopmentHostname(hostname);
}

/**
 * The prefix a browser on this hostname must put in front of an admin URL.
 *
 * Empty on the admin subdomain, where the rewrite adds `/admin` invisibly, and `/admin`
 * everywhere else. A page that renders an admin link or an admin form's action reads this,
 * so the one fact that differs between production and a laptop is stated in one place.
 */
export function resolveAdminPublicPrefix(hostname: string): string {
  return hostname === resolveAdminHostname() ? "" : ADMIN_PATH_PREFIX;
}

/** The public URL of the login page on this hostname — `/login` or `/admin/login`. */
export function resolveAdminLoginHref(hostname: string): string {
  return `${resolveAdminPublicPrefix(hostname)}/login`;
}

/** The public URL of the panel's home on this hostname — `/` or `/admin`. */
export function resolveAdminHomeHref(hostname: string): string {
  return resolveAdminPublicPrefix(hostname) || "/";
}

/**
 * The public URL of the order list on this hostname — `/orders` or `/admin/orders`.
 *
 * The list is the panel's landing page: signing in lands on the work, not on a menu. It is
 * still resolved through the same prefix as everything else rather than being written down,
 * because `/orders` and `/admin/orders` are one page reached from two domains.
 */
export function resolveAdminOrdersHref(hostname: string): string {
  return `${resolveAdminPublicPrefix(hostname)}/orders`;
}

/** The public URL of one order's detail page — `/orders/W2ACEHACUU` or `/admin/orders/…`. */
export function resolveAdminOrderHref(hostname: string, orderId: string): string {
  return `${resolveAdminOrdersHref(hostname)}/${encodeURIComponent(orderId)}`;
}

/**
 * The header middleware uses to tell the admin layout which `/admin/*` path a request resolved
 * to, so the nav can mark its current section without the layout becoming a Client Component.
 * Set on every admin request, on both the rewritten and the by-path route. See `middleware.ts`.
 */
export const INTERNAL_ADMIN_PATH_HEADER = "x-admin-internal-path";

/** The panel's sections — one nav entry each, and the two things this panel manages. */
export const ADMIN_SECTIONS = ["orders", "products"] as const;

export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/**
 * Which section an internal admin path belongs to, or null for the panel's home.
 *
 * Matched on the path's first segment after `/admin`, so `/admin/products/P001` is still the
 * Products section — a detail page is inside the section it was reached from, and a nav that
 * lost its highlight on the way into a record would be telling the operator they had left.
 */
export function resolveAdminSection(internalPath: string | null | undefined): AdminSection | null {
  if (internalPath === null || internalPath === undefined) return null;

  const segment = internalPath.replace(`${ADMIN_PATH_PREFIX}/`, "").split("/")[0];
  return ADMIN_SECTIONS.find((section) => section === segment) ?? null;
}

/**
 * The public URL of the product list on this hostname — `/products` or `/admin/products`.
 *
 * The catalogue's second reader, and the first one that can write to it. It resolves through the
 * same prefix as everything else rather than being written down, because `/products` and
 * `/admin/products` are one page reached from two domains. See
 * [ADR-064](/docs/decisions/ADR-064-admin-product-management.md).
 */
export function resolveAdminProductsHref(hostname: string): string {
  return `${resolveAdminPublicPrefix(hostname)}/products`;
}

/**
 * Every section the sidebar lists, in the order it lists them, resolved for one hostname.
 *
 * The sections are declared once — `ADMIN_SECTIONS` for the header-matching, a label here, and an
 * href resolver here — so a third section is three lines in this file and nothing at all in the
 * layout or the sidebar. The previous top nav built its two entries inline, which made "add
 * Customers" a change to a component that has no business knowing what a section is
 * ([ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md)).
 */
export const ADMIN_SECTION_LABELS: Record<AdminSection, string> = {
  orders: "Orders",
  products: "Products",
};

const ADMIN_SECTION_HREF_RESOLVERS: Record<AdminSection, (hostname: string) => string> = {
  orders: resolveAdminOrdersHref,
  products: resolveAdminProductsHref,
};

export interface AdminSectionLink {
  section: AdminSection;
  label: string;
  href: string;
}

export function resolveAdminSectionLinks(hostname: string): AdminSectionLink[] {
  return ADMIN_SECTIONS.map((section) => ({
    section,
    label: ADMIN_SECTION_LABELS[section],
    href: ADMIN_SECTION_HREF_RESOLVERS[section](hostname),
  }));
}


/**
 * The endpoint that hands back the product list as a spreadsheet — `/api/products/export` on the
 * admin subdomain, `/admin/api/products/export` on a development machine.
 *
 * A `GET`, so the button that reaches it is an ordinary link and the list page ships no JavaScript
 * to download a file. It is a static segment beside the dynamic `[id]` one, which Next resolves in
 * its favour, so no product may be given the id `export`.
 * See [ADR-065](/docs/decisions/ADR-065-admin-sidebar-export-and-variant-picker.md).
 */
export function resolveAdminProductExportHref(hostname: string): string {
  return `${resolveAdminPublicPrefix(hostname)}/api/products/export`;
}

/** The public URL of one product's detail page — `/products/P001` or `/admin/products/P001`. */
export function resolveAdminProductHref(hostname: string, productId: string): string {
  return `${resolveAdminProductsHref(hostname)}/${encodeURIComponent(productId)}`;
}

/**
 * The endpoint one product's edit is saved through — `/api/products/{id}` on the admin
 * subdomain, `/admin/api/products/{id}` on a development machine.
 *
 * One endpoint rather than the three the order actions have, and for the mirror of their reason:
 * an order's three actions validate different things and refuse for different reasons, whereas a
 * product edit is one record checked against one set of rules. Splitting it per tab would be
 * three handlers sharing a door, and would let a save land half-applied.
 */
export function resolveAdminProductActionHref(hostname: string, productId: string): string {
  return `${resolveAdminPublicPrefix(hostname)}/api/products/${encodeURIComponent(productId)}`;
}

/**
 * The three things an operator can change about one order, and the endpoint that does each.
 *
 * They are separate routes rather than one endpoint taking an `intent`, because they validate
 * different things and refuse for different reasons: a status change asks the lifecycle, an
 * address edit asks whether the parcel has left, and a receipt toggle asks what kind of order
 * this is. One handler switching on a discriminator would be three handlers sharing a door.
 */
export const ADMIN_ORDER_ACTIONS = ["status", "address", "receipt"] as const;

export type AdminOrderAction = (typeof ADMIN_ORDER_ACTIONS)[number];

/**
 * The public URL of one of those endpoints on this hostname — `/api/orders/{id}/status` on the
 * admin subdomain, `/admin/api/orders/{id}/status` on a development machine.
 *
 * Not listed in `PUBLIC_ADMIN_PATHS`: these change data, so a request without a session cookie
 * is turned away by middleware before it reaches the handler, and the handler resolves the
 * cookie against Postgres regardless.
 */
export function resolveAdminOrderActionHref(
  hostname: string,
  orderId: string,
  action: AdminOrderAction,
): string {
  return `${resolveAdminPublicPrefix(hostname)}/api/orders/${encodeURIComponent(orderId)}/${action}`;
}

/** The public URL of the logout endpoint on this hostname. */
export function resolveAdminLogoutHref(hostname: string): string {
  return `${resolveAdminPublicPrefix(hostname)}/api/logout`;
}

/** The public URL of the login endpoint on this hostname. */
export function resolveAdminLoginApiHref(hostname: string): string {
  return `${resolveAdminPublicPrefix(hostname)}/api/login`;
}

/**
 * The hostname the browser actually asked for, given something that can read a request
 * header. `X-Forwarded-Host` wins because in production this container sits behind Coolify's
 * proxy, which terminates TLS and sets it; the `Host` header there can be an internal service
 * name that no browser ever typed.
 *
 * That header is client-supplied on a direct connection, and the consequence of a forged one
 * is bounded on purpose: it can only change *which* set of routes is served, never whether a
 * session is required. Every protected page re-checks the session against the database no
 * matter how the request was routed.
 *
 * It takes a reader function rather than a `Headers` because its two callers hold different
 * things — middleware has a `NextRequest`, a Server Component has `headers()` — and neither
 * should have to convert to satisfy the other.
 */
export function resolveRequestHostname(
  readHeader: (name: string) => string | null | undefined,
): string {
  const forwardedHost = normaliseHostname(readHeader("x-forwarded-host"));
  if (forwardedHost.length > 0) return forwardedHost;
  return normaliseHostname(readHeader("host"));
}

export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`);
}

export function isPublicAdminPath(internalPath: string): boolean {
  return PUBLIC_ADMIN_PATHS.includes(internalPath);
}

/**
 * The internal route a public path on the admin subdomain resolves to: `/login` becomes
 * `/admin/login` and `/` becomes `/admin`. This is the whole of the subdomain trick — one
 * deployment, one file tree, and a hostname that decides which half of it a request sees.
 */
export function toInternalAdminPath(publicPathname: string): string {
  if (publicPathname === "/") return ADMIN_PATH_PREFIX;
  return `${ADMIN_PATH_PREFIX}${publicPathname}`;
}

/**
 * The two responsibilities of the admin middleware, resolved together because they are one
 * decision per request and separating them would mean deciding the hostname question twice.
 *
 * **Routing.** On the admin hostname every path is rewritten into `/admin/*`, so the panel
 * is served from a subdomain without becoming a second application. On a development
 * hostname `/admin/*` is served by path instead, because no such subdomain exists locally.
 * On any other hostname — the storefront's own domain, or anything pointed at this
 * deployment — `/admin/*` is not the admin panel and is sent to the storefront home.
 *
 * **Authentication.** The gate here is the *presence* of a session cookie, not its validity:
 * middleware runs on the Edge runtime and cannot open a database connection to check one.
 * That check is authoritative in `app/admin/(protected)/layout.tsx`, which runs on Node and
 * asks Postgres. This is the cheap gate that keeps an unauthenticated browser off the panel;
 * it is not the one that decides who is logged in, and nothing downstream may treat a
 * request that passed it as authenticated.
 */
export function decideAdminRoute({
  hostname,
  pathname,
  hasSessionCookie,
}: AdminRouteRequest): AdminRouteDecision {
  if (hostname === resolveAdminHostname()) {
    const internalPath = toInternalAdminPath(pathname);

    if (isPublicAdminPath(internalPath) || hasSessionCookie) {
      return { kind: "rewrite", internalPath };
    }

    return { kind: "redirect", location: resolveAdminLoginHref(hostname) };
  }

  if (!isAdminPath(pathname)) return { kind: "continue" };

  if (!isLocalDevelopmentRequest(hostname)) return { kind: "redirect", location: "/" };

  if (isPublicAdminPath(pathname) || hasSessionCookie) return { kind: "continue" };

  return { kind: "redirect", location: resolveAdminLoginHref(hostname) };
}
