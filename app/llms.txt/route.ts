import { buildLlmsTxt } from "@/lib/llms-txt";

/**
 * `/llms.txt` — the site summary written for a language model rather than for a search engine,
 * on the same convention `robots.txt` and `sitemap.xml` follow: a fixed path at the site root,
 * served as plain text.
 *
 * A route handler rather than a file in `public/`, and the body built in `lib/llms-txt.ts`
 * rather than here, for the reason `app/robots.ts` gives: every fact in it — the policy
 * numbers, the category and collection lists, the number of pieces in the catalogue — is read
 * from the module that already owns it, so the file cannot go stale while the shop changes
 * around it. A static copy in `public/` would be a second set of those values with nothing
 * holding it to the first.
 *
 * `force-static` because the catalogue ships as code ([ADR-001](/docs/decisions/ADR-001-tech-stack.md)):
 * nothing this file states can change without a deploy, which is the same reason
 * `/sitemap.xml` and `/robots.txt` prerender.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
