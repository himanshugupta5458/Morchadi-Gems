import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  INTERNAL_ADMIN_PATH_HEADER,
  decideAdminRoute,
  firstForwardedValue,
  isAdminPath,
  resolveRequestHostname,
} from "@/lib/admin-routing";

/**
 * The one middleware this deployment may have — Next 14 runs exactly one, at the repository
 * root — and it exists for the admin panel alone. Every storefront request falls through it
 * untouched.
 *
 * It carries two responsibilities, both decided by `decideAdminRoute` so that the hostname is
 * classified once per request rather than twice:
 *
 * 1. **Hostname routing.** `admin.morchadigems.com/login` is rewritten to `/admin/login`
 *    inside this same deployment, so a subdomain is served without a second app, a second
 *    image or a second container. On the storefront's own domain `/admin/*` is not the admin
 *    panel and is sent home.
 * 2. **An unauthenticated-browser gate.** A request to a protected admin route with no
 *    session cookie is redirected to the login page before it reaches a page component.
 *
 * **The gate is not the authentication.** Middleware runs on the Edge runtime, which has no
 * database driver, so all it can see is whether a cookie is present — a forged one passes it.
 * `app/admin/(protected)/layout.tsx` runs on Node, resolves the cookie against Postgres and
 * is the check that decides who is logged in. Anything added here must keep that order:
 * cheap and fallible first, authoritative and stateful second.
 *
 * See [ADR-041](/docs/decisions/ADR-041-admin-subdomain-and-auth.md).
 */
export function middleware(request: NextRequest): NextResponse {
  const decision = decideAdminRoute({
    hostname: resolveRequestHostname((name) => request.headers.get(name)),
    pathname: request.nextUrl.pathname,
    hasSessionCookie: request.cookies.has(ADMIN_SESSION_COOKIE),
  });

  if (decision.kind === "rewrite") {
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = decision.internalPath;
    return NextResponse.rewrite(rewritten, {
      request: { headers: withInternalAdminPath(request, decision.internalPath) },
    });
  }

  if (decision.kind === "redirect") return temporaryRedirect(request, decision.location);

  if (isAdminPath(request.nextUrl.pathname)) {
    return NextResponse.next({
      request: { headers: withInternalAdminPath(request, request.nextUrl.pathname) },
    });
  }

  return NextResponse.next();
}

/**
 * The request's headers plus the `/admin/*` path it actually resolved to.
 *
 * The admin layout renders the panel's nav and has to know which section is current, and a
 * Server Component cannot ask for its own pathname. The alternative is `usePathname`, which
 * would make the nav a Client Component and put JavaScript on every page of a panel that
 * deliberately ships none for navigation — so the one fact it needs is passed down instead.
 *
 * Set on both branches on purpose. In production the admin subdomain is rewritten and the
 * internal path is the rewrite target; on a development machine `/admin/*` is served by path and
 * is already internal. A layout reading this header must work the same in both, or the nav is
 * right locally and wrong in production.
 */
function withInternalAdminPath(request: NextRequest, internalPath: string): Headers {
  const headers = new Headers(request.headers);
  headers.set(INTERNAL_ADMIN_PATH_HEADER, internalPath);
  return headers;
}

/**
 * The origin the browser actually asked for, which is not always the one this process is
 * listening on.
 *
 * `request.nextUrl` carries the address the Node server was reached at — behind Coolify's
 * proxy, an internal name and a plain-HTTP scheme. A `Location` built from it would send the
 * browser to a host it cannot resolve, or bounce it through an unnecessary HTTPS upgrade. The
 * forwarding headers are what the proxy sets to say what the browser asked for, so they win,
 * with the request's own URL as the fallback for a direct connection.
 *
 * The host keeps its port here, unlike the hostname the routing decision compares — a
 * redirect to `localhost` without `:3000` goes nowhere.
 */
function resolveRequestOrigin(request: NextRequest): string {
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const host =
    forwardedHost.length > 0
      ? forwardedHost
      : firstForwardedValue(request.headers.get("host")) || request.nextUrl.host;

  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const protocol =
    forwardedProtocol.length > 0
      ? forwardedProtocol
      : request.nextUrl.protocol.replace(/:$/, "");

  return `${protocol}://${host}`;
}

/**
 * A 307 to a path on the origin the request came in on.
 *
 * The `Location` has to be absolute — Next's middleware runtime parses it and rejects a
 * relative reference with `ERR_INVALID_URL` — so it is assembled from the forwarded origin
 * above rather than from `request.nextUrl`. A `Host` header malformed enough to fail `new
 * URL` falls back to the request's own URL rather than turning a redirect into a 500.
 */
function temporaryRedirect(request: NextRequest, location: string): NextResponse {
  try {
    return NextResponse.redirect(new URL(location, resolveRequestOrigin(request)), 307);
  } catch {
    const fallback = request.nextUrl.clone();
    fallback.pathname = location;
    fallback.search = "";
    return NextResponse.redirect(fallback, 307);
  }
}

/**
 * Everything except Next's own build output and static media.
 *
 * `.txt` and `.xml` are deliberately **not** excluded: `admin.morchadigems.com/robots.txt`
 * has to be rewritten to the admin panel's own deny-all `robots.txt`, and a crawler that got
 * the storefront's file on that hostname would be told the whole subdomain is crawlable.
 */
export const config = {
  matcher: [
    "/((?!_next/|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff|woff2|ttf|otf|mp4)$).*)",
  ],
};
