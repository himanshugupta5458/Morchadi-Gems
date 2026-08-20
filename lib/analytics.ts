/**
 * The Google Tag host, named once. It is also listed in `script-src` in
 * `config/security-headers.mjs`, and the two have to agree: a tag loaded from a host the
 * policy does not allow is blocked by the browser while still looking installed in the page
 * source. See [ADR-039](/docs/decisions/ADR-039-analytics-and-utm-attribution.md).
 */
export const GOOGLE_TAG_MANAGER_ORIGIN = "https://www.googletagmanager.com";

/**
 * The GA4 measurement id, or an empty string when the deployment has not been given one.
 *
 * Optional by design, on the same terms as `NEXT_PUBLIC_WEB3FORMS_KEY` in `lib/contact.ts`
 * and the CallMeBot pair in `lib/notify.ts`: a deployment without it renders no tag, loads no
 * third-party script and sells exactly as well as one with it. Public by nature, since a
 * measurement id is visible in the page source of every site that uses one.
 */
export function getGoogleAnalyticsMeasurementId(): string {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
}

export function buildGtagScriptSrc(measurementId: string): string {
  return `${GOOGLE_TAG_MANAGER_ORIGIN}/gtag/js?id=${encodeURIComponent(measurementId)}`;
}

/**
 * The four lines Google's own snippet runs, with the id embedded as a JSON string literal
 * rather than pasted between quotes. The id comes from a deployment variable rather than from
 * a shopper, but a value that ends up inside a `<script>` block is escaped on principle.
 */
export function buildGtagInitScript(measurementId: string): string {
  return [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js', new Date());",
    `gtag('config', ${JSON.stringify(measurementId)});`,
  ].join("\n");
}
