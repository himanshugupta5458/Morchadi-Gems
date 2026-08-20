import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import {
  ADMIN_SESSION_COOKIE,
  DEFAULT_ADMIN_HOSTNAME,
  decideAdminRoute,
  isLocalDevelopmentHostname,
  normaliseHostname,
  resolveAdminHomeHref,
  resolveAdminHostname,
  resolveAdminLoginApiHref,
  resolveAdminLoginHref,
  resolveAdminLogoutHref,
  resolveAdminPublicPrefix,
  resolveRequestHostname,
  toInternalAdminPath,
} from "@/lib/admin-routing";

const STOREFRONT_HOSTNAME = "www.morchadigems.com";
const CODESPACE_HOSTNAME = "fluffy-space-guide-abc123-3000.app.github.dev";

function inProduction(): void {
  vi.stubEnv("NODE_ENV", "production");
}

function decide(
  hostname: string,
  pathname: string,
  hasSessionCookie = false,
): ReturnType<typeof decideAdminRoute> {
  return decideAdminRoute({ hostname, pathname, hasSessionCookie });
}

function requestFor(
  url: string,
  { hostname, token }: { hostname?: string; token?: string } = {},
): NextRequest {
  const headers = new Headers();
  headers.set("host", hostname ?? new URL(url).host);
  if (token !== undefined) headers.set("cookie", `${ADMIN_SESSION_COOKIE}=${token}`);

  return new NextRequest(url, { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the admin hostname", () => {
  it("defaults to the admin subdomain of the shop's own domain", () => {
    expect(resolveAdminHostname()).toBe(DEFAULT_ADMIN_HOSTNAME);
    expect(DEFAULT_ADMIN_HOSTNAME).toBe("admin.morchadigems.com");
  });

  it("is taken from ADMIN_HOSTNAME when a deployment sets one", () => {
    vi.stubEnv("ADMIN_HOSTNAME", "panel.example.test");

    expect(resolveAdminHostname()).toBe("panel.example.test");
  });

  it("lowercases and trims a configured value, since a Host header is compared to it", () => {
    vi.stubEnv("ADMIN_HOSTNAME", "  Panel.Example.Test  ");

    expect(resolveAdminHostname()).toBe("panel.example.test");
  });

  it("falls back to the default rather than to a hostname nothing can match", () => {
    vi.stubEnv("ADMIN_HOSTNAME", "   ");

    expect(resolveAdminHostname()).toBe(DEFAULT_ADMIN_HOSTNAME);
  });
});

describe("reading a hostname off a request", () => {
  it("strips the port and lowercases", () => {
    expect(normaliseHostname("LOCALHOST:3000")).toBe("localhost");
    expect(normaliseHostname(" Admin.Morchadigems.com ")).toBe("admin.morchadigems.com");
  });

  it("keeps an IPv6 literal intact while still removing its port", () => {
    expect(normaliseHostname("[::1]:3000")).toBe("[::1]");
  });

  it("is the empty string when there is no host header at all", () => {
    expect(normaliseHostname(null)).toBe("");
    expect(normaliseHostname(undefined)).toBe("");
  });

  it("prefers X-Forwarded-Host, which is what Coolify's proxy sets", () => {
    const headers: Record<string, string> = {
      host: "morchadi-gems-app:3000",
      "x-forwarded-host": "admin.morchadigems.com",
    };

    expect(resolveRequestHostname((name) => headers[name] ?? null)).toBe(
      "admin.morchadigems.com",
    );
  });

  it("falls back to Host when nothing forwarded one", () => {
    const headers: Record<string, string> = { host: "localhost:3000" };

    expect(resolveRequestHostname((name) => headers[name] ?? null)).toBe("localhost");
  });
});

describe("recognising a development machine", () => {
  it("knows the loopback names and forwarded-port hosts", () => {
    for (const hostname of [
      "localhost",
      "127.0.0.1",
      "[::1]",
      "morchadi.localhost",
      CODESPACE_HOSTNAME,
    ]) {
      expect(isLocalDevelopmentHostname(hostname)).toBe(true);
    }
  });

  it("does not mistake the shop's own domains for one", () => {
    for (const hostname of [STOREFRONT_HOSTNAME, "morchadigems.com", DEFAULT_ADMIN_HOSTNAME]) {
      expect(isLocalDevelopmentHostname(hostname)).toBe(false);
    }
  });
});

describe("the public URLs of the panel", () => {
  it("carry no /admin prefix on the admin subdomain", () => {
    expect(resolveAdminPublicPrefix(DEFAULT_ADMIN_HOSTNAME)).toBe("");
    expect(resolveAdminLoginHref(DEFAULT_ADMIN_HOSTNAME)).toBe("/login");
    expect(resolveAdminHomeHref(DEFAULT_ADMIN_HOSTNAME)).toBe("/");
    expect(resolveAdminLoginApiHref(DEFAULT_ADMIN_HOSTNAME)).toBe("/api/login");
    expect(resolveAdminLogoutHref(DEFAULT_ADMIN_HOSTNAME)).toBe("/api/logout");
  });

  it("carry it everywhere else, which is how the panel is reached in development", () => {
    expect(resolveAdminPublicPrefix("localhost")).toBe("/admin");
    expect(resolveAdminLoginHref("localhost")).toBe("/admin/login");
    expect(resolveAdminHomeHref("localhost")).toBe("/admin");
    expect(resolveAdminLoginApiHref("localhost")).toBe("/admin/api/login");
    expect(resolveAdminLogoutHref("localhost")).toBe("/admin/api/logout");
  });

  it("map onto the internal route space by adding the prefix back", () => {
    expect(toInternalAdminPath("/")).toBe("/admin");
    expect(toInternalAdminPath("/login")).toBe("/admin/login");
    expect(toInternalAdminPath("/api/login")).toBe("/admin/api/login");
    expect(toInternalAdminPath("/orders/M7K2QX9P4T")).toBe("/admin/orders/M7K2QX9P4T");
  });
});

describe("routing on the admin subdomain in production", () => {
  it("rewrites the login page, so it is served without a session", () => {
    inProduction();

    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/login")).toEqual({
      kind: "rewrite",
      internalPath: "/admin/login",
    });
  });

  it("rewrites the login endpoint too, or the form could not post anywhere", () => {
    inProduction();

    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/api/login")).toEqual({
      kind: "rewrite",
      internalPath: "/admin/api/login",
    });
  });

  it("serves the subdomain's own robots.txt rather than the storefront's", () => {
    inProduction();

    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/robots.txt")).toEqual({
      kind: "rewrite",
      internalPath: "/admin/robots.txt",
    });
  });

  it("sends an unauthenticated browser to the login page, in that host's own URL space", () => {
    inProduction();

    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/")).toEqual({
      kind: "redirect",
      location: "/login",
    });
    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/orders")).toEqual({
      kind: "redirect",
      location: "/login",
    });
  });

  it("rewrites any path once a session cookie is present", () => {
    inProduction();

    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/", true)).toEqual({
      kind: "rewrite",
      internalPath: "/admin",
    });
    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/orders/M7K2QX9P4T", true)).toEqual({
      kind: "rewrite",
      internalPath: "/admin/orders/M7K2QX9P4T",
    });
  });

  it("does not resolve the storefront's own API on the admin host", () => {
    inProduction();

    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/api/create-order", true)).toEqual({
      kind: "rewrite",
      internalPath: "/admin/api/create-order",
    });
  });

  it("follows ADMIN_HOSTNAME when a deployment moves the panel", () => {
    inProduction();
    vi.stubEnv("ADMIN_HOSTNAME", "panel.example.test");

    expect(decide("panel.example.test", "/login")).toEqual({
      kind: "rewrite",
      internalPath: "/admin/login",
    });
    expect(decide(DEFAULT_ADMIN_HOSTNAME, "/login")).toEqual({ kind: "continue" });
  });
});

describe("the storefront domain in production", () => {
  it("does not serve the admin panel at /admin", () => {
    inProduction();

    expect(decide(STOREFRONT_HOSTNAME, "/admin")).toEqual({ kind: "redirect", location: "/" });
  });

  it("does not serve the login page there either", () => {
    inProduction();

    expect(decide(STOREFRONT_HOSTNAME, "/admin/login")).toEqual({
      kind: "redirect",
      location: "/",
    });
  });

  it("refuses even with a valid-looking session cookie — the hostname is what decides", () => {
    inProduction();

    expect(decide(STOREFRONT_HOSTNAME, "/admin/orders", true)).toEqual({
      kind: "redirect",
      location: "/",
    });
  });

  it("leaves every shopper-facing route completely alone", () => {
    inProduction();

    for (const pathname of ["/", "/shop", "/product/P001", "/api/create-order", "/robots.txt"]) {
      expect(decide(STOREFRONT_HOSTNAME, pathname)).toEqual({ kind: "continue" });
    }
  });

  it("is not fooled by a path that merely starts with the same letters", () => {
    inProduction();

    expect(decide(STOREFRONT_HOSTNAME, "/administration")).toEqual({ kind: "continue" });
  });
});

describe("the local development fallback", () => {
  it("serves /admin by path, since there is no subdomain to point a browser at", () => {
    expect(decide("localhost", "/admin/login")).toEqual({ kind: "continue" });
    expect(decide("localhost", "/admin", true)).toEqual({ kind: "continue" });
  });

  it("still asks an unauthenticated browser to sign in first", () => {
    expect(decide("localhost", "/admin")).toEqual({
      kind: "redirect",
      location: "/admin/login",
    });
    expect(decide("localhost", "/admin/orders")).toEqual({
      kind: "redirect",
      location: "/admin/login",
    });
  });

  it("works the same way on a Codespaces forwarded port", () => {
    expect(decide(CODESPACE_HOSTNAME, "/admin/login")).toEqual({ kind: "continue" });
    expect(decide(CODESPACE_HOSTNAME, "/admin")).toEqual({
      kind: "redirect",
      location: "/admin/login",
    });
  });

  it("applies on localhost even to a production build, which sets NODE_ENV=production", () => {
    inProduction();

    expect(decide("localhost", "/admin/login")).toEqual({ kind: "continue" });
    expect(decide("localhost", "/admin")).toEqual({
      kind: "redirect",
      location: "/admin/login",
    });
  });

  it("does not rewrite the storefront on a development hostname", () => {
    expect(decide("localhost", "/")).toEqual({ kind: "continue" });
    expect(decide("localhost", "/shop")).toEqual({ kind: "continue" });
  });
});

describe("the middleware itself", () => {
  it("rewrites an authenticated admin-subdomain request into the /admin route space", () => {
    inProduction();

    const response = middleware(
      requestFor("https://admin.morchadigems.com/orders", { token: "a-session-token" }),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://admin.morchadigems.com/admin/orders",
    );
  });

  it("rewrites the login page without any cookie at all", () => {
    inProduction();

    const response = middleware(requestFor("https://admin.morchadigems.com/login"));

    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://admin.morchadigems.com/admin/login",
    );
  });

  it("redirects an unauthenticated admin-subdomain request to that host's login page", () => {
    inProduction();

    const response = middleware(requestFor("https://admin.morchadigems.com/orders"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://admin.morchadigems.com/login");
  });

  it("sends the storefront domain's /admin requests to the storefront home page", () => {
    inProduction();

    const response = middleware(requestFor("https://www.morchadigems.com/admin/orders"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://www.morchadigems.com/");
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("redirects to the origin the browser asked for, not the one this container listens on", () => {
    inProduction();

    const proxied = new NextRequest("http://10.0.0.5:3000/orders?status=packed", {
      headers: new Headers({
        host: "10.0.0.5:3000",
        "x-forwarded-host": "admin.morchadigems.com",
        "x-forwarded-proto": "https",
      }),
    });

    expect(middleware(proxied).headers.get("location")).toBe(
      "https://admin.morchadigems.com/login",
    );
  });

  it("takes the leftmost entry when a chain of proxies appended their own", () => {
    inProduction();

    const chained = new NextRequest("http://10.0.0.5:3000/orders", {
      headers: new Headers({
        host: "10.0.0.5:3000",
        "x-forwarded-host": "admin.morchadigems.com, inner.internal",
        "x-forwarded-proto": "https, http",
      }),
    });

    expect(middleware(chained).headers.get("location")).toBe(
      "https://admin.morchadigems.com/login",
    );
  });

  it("drops the query string rather than carrying it to the login page", () => {
    inProduction();

    const response = middleware(
      requestFor("https://admin.morchadigems.com/orders?status=packed"),
    );

    expect(response.headers.get("location")).toBe("https://admin.morchadigems.com/login");
  });

  it("passes a storefront request straight through", () => {
    inProduction();

    const response = middleware(requestFor("https://www.morchadigems.com/shop?page=2"));

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("honours X-Forwarded-Host, which is the only hostname a proxied request carries", () => {
    inProduction();

    const request = new NextRequest("https://internal-service:3000/login", {
      headers: new Headers({
        host: "internal-service:3000",
        "x-forwarded-host": "admin.morchadigems.com",
      }),
    });

    expect(middleware(request).headers.get("x-middleware-rewrite")).toBe(
      "https://internal-service:3000/admin/login",
    );
  });

  it("serves /admin by path in development without rewriting anything", () => {
    const response = middleware(
      requestFor("http://localhost:3000/admin", { token: "a-session-token" }),
    );

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects an unauthenticated /admin request in development to /admin/login", () => {
    const response = middleware(requestFor("http://localhost:3000/admin"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/admin/login");
  });
});
