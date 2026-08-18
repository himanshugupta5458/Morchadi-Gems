const LOCAL_BASE_URL = "http://localhost:3000";

function normaliseOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

/**
 * The origin every absolute URL this site emits is built from: canonical tags, share cards,
 * the sitemap, `robots.txt` and every `@id` in the structured data.
 *
 * `APP_BASE_URL` wins over `NEXT_PUBLIC_BASE_URL` for the same reason it does in
 * `lib/cashfree-config.ts` — these URLs are rendered on the server, and the server-only
 * variable is the one a deployment sets when the two can differ. The public variable is the
 * fallback so a project that only sets that one still resolves, and localhost is the last
 * resort so a developer without an env file gets working links rather than a crash.
 *
 * There is no request-origin fallback here on purpose. A canonical URL or a schema `@id` that
 * changes with the host it was fetched from is worse than one that is wrong in the same way
 * everywhere: preview deployments would each claim to be canonical for the same page.
 */
export function getSiteUrl(): string {
  const configuredBaseUrl =
    process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "";

  return normaliseOrigin(configuredBaseUrl) ?? LOCAL_BASE_URL;
}

/**
 * A site-relative path as an absolute URL. A value that is already absolute is returned
 * untouched, so a caller can pass either without checking which it has.
 */
export function absoluteUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
