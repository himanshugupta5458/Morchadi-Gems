import { buildAdminRobotsTxt } from "@/lib/robots";

/**
 * `admin.morchadigems.com/robots.txt`, reached through the middleware rewrite that turns every
 * path on the admin hostname into `/admin/*`.
 *
 * Without this route that request would rewrite to a path with no handler and 404, and a
 * crawler that gets a 404 for `robots.txt` treats the entire host as crawlable. The file it
 * serves refuses everything. See
 * [ADR-041](/docs/decisions/ADR-041-admin-subdomain-and-auth.md).
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildAdminRobotsTxt(), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
