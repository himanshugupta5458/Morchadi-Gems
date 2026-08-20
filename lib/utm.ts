import type { UtmParams } from "@/types/utm";

/**
 * One key, holding one JSON record. Namespaced like every other key this site writes so a
 * shared origin could never collide with it, and underscored rather than hyphenated to match
 * the `utm_` vocabulary it holds rather than the cart's `morchadi-cart-v1`.
 */
export const UTM_STORAGE_KEY = "morchadi_utm_first_touch";

/**
 * How long a first touch keeps the credit. Ninety days is the window most ad platforms use
 * for a conversion, and it is the point past which "she arrived from that Instagram post" has
 * stopped being a useful thing to say about a purchase.
 *
 * Expiry does two jobs, not one: a stale record is not returned, **and** it no longer blocks a
 * fresh capture. Without the second half the first campaign a device ever saw would own it
 * forever, which is not first-touch attribution but a permanent one.
 */
export const UTM_ATTRIBUTION_WINDOW_DAYS = 90;

/**
 * Longer than any honest campaign name and far inside Cashfree's 255-character cap on an
 * `order_tags` value. A campaign URL is written by whoever links to the site, so this is also
 * the bound on what a crafted link can push into a payment record or a WhatsApp message.
 */
export const UTM_VALUE_MAX_LENGTH = 120;

const MILLISECONDS_PER_DAY = 86_400_000;

interface UtmFieldBinding {
  field: keyof UtmParams;
  queryParam: string;
}

const UTM_FIELDS: readonly UtmFieldBinding[] = [
  { field: "source", queryParam: "utm_source" },
  { field: "medium", queryParam: "utm_medium" },
  { field: "campaign", queryParam: "utm_campaign" },
  { field: "term", queryParam: "utm_term" },
  { field: "content", queryParam: "utm_content" },
];

/**
 * The three that identify a campaign rather than describe it, in the order a person reads
 * them. These are the ones written onto the order and into the owner's WhatsApp; `term` and
 * `content` are kept in storage and left to GA4, which reports on them natively.
 */
const ORDER_TAGGED_FIELDS: readonly UtmFieldBinding[] = UTM_FIELDS.slice(0, 3);

interface StoredUtmRecord extends UtmParams {
  capturedAt: string;
}

/** The record as the rest of the app wants it: the campaign, without the bookkeeping. */
function withoutTimestamp(record: StoredUtmRecord): UtmParams {
  const params: UtmParams = {};

  for (const { field } of UTM_FIELDS) {
    const value = record[field];
    if (value !== undefined) params[field] = value;
  }

  return params;
}

/**
 * Control characters become spaces before whitespace is collapsed, so a value carrying a
 * newline cannot forge an extra line in the WhatsApp message it will end up in.
 */
function normaliseValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const collapsed = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return collapsed.length === 0
    ? undefined
    : collapsed.slice(0, UTM_VALUE_MAX_LENGTH);
}

function buildParams(read: (queryParam: string) => unknown): UtmParams | null {
  const params: UtmParams = {};

  for (const { field, queryParam } of UTM_FIELDS) {
    const value = normaliseValue(read(queryParam));
    if (value !== undefined) params[field] = value;
  }

  return Object.keys(params).length === 0 ? null : params;
}

/**
 * Shape validation for a `utm` object arriving from a browser, on the same terms as every
 * other client-supplied value in this project: it is trusted to describe and never to decide.
 * Anything that is not a usable string is dropped, and an object with nothing usable in it is
 * null rather than an empty object, so a caller cannot accidentally record "came from
 * nowhere" as if it were a source.
 *
 * The keys it reads are the `UtmParams` field names, not the `utm_` query names — this parses
 * what `getStoredUtmParams` produced, not a URL.
 */
export function parseUtmParams(value: unknown): UtmParams | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Record<string, unknown>;

  return buildParams((queryParam) => {
    const field = UTM_FIELDS.find((binding) => binding.queryParam === queryParam)?.field;
    return field === undefined ? undefined : candidate[field];
  });
}

/** The five `utm_*` parameters of a URL, normalised, or null when it carries none of them. */
export function readUtmFromSearchParams(
  searchParams: URLSearchParams,
): UtmParams | null {
  return buildParams((queryParam) => searchParams.get(queryParam) ?? undefined);
}

function readStoredRecord(): StoredUtmRecord | null {
  if (typeof window === "undefined") return null;

  let rawValue: string | null;
  try {
    rawValue = window.localStorage.getItem(UTM_STORAGE_KEY);
  } catch {
    return null;
  }

  if (rawValue === null) return null;

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return null;
  }

  if (typeof parsedValue !== "object" || parsedValue === null) return null;

  const capturedAt = (parsedValue as Record<string, unknown>).capturedAt;
  if (typeof capturedAt !== "string") return null;

  const capturedTime = Date.parse(capturedAt);
  if (Number.isNaN(capturedTime)) return null;
  if (Date.now() - capturedTime > UTM_ATTRIBUTION_WINDOW_DAYS * MILLISECONDS_PER_DAY) {
    return null;
  }

  const params = parseUtmParams(parsedValue);
  return params === null ? null : { ...params, capturedAt };
}

/**
 * Records where this visitor came from, once, and returns the attribution now in force.
 *
 * **First touch, not last.** An existing unexpired record is never overwritten, so a shopper
 * who arrives from an ad, leaves, and comes back through a search result is still credited to
 * the ad. A record past `UTM_ATTRIBUTION_WINDOW_DAYS` counts as absent for this purpose and is
 * replaced, which is what lets the window roll rather than freeze.
 *
 * Safe to call during a server render and safe to call in a browser that refuses storage: both
 * return null and write nothing. A visit carrying no `utm_*` parameters at all writes nothing
 * either, so ordinary traffic leaves no record behind.
 */
export function captureUtmParams(): UtmParams | null {
  if (typeof window === "undefined") return null;

  const existing = readStoredRecord();
  if (existing !== null) return withoutTimestamp(existing);

  const params = readUtmFromSearchParams(
    new URLSearchParams(window.location.search),
  );
  if (params === null) return null;

  const record: StoredUtmRecord = {
    ...params,
    capturedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(record));
  } catch {
    return params;
  }

  return params;
}

/**
 * The stored first touch without its timestamp, or null when there is none, when it has
 * expired, when it cannot be read, or when there is no browser to read it from.
 *
 * A reader with no side effects: an expired record is reported as absent but left in place for
 * `captureUtmParams` to replace, so the two functions cannot disagree about what is current.
 */
export function getStoredUtmParams(): UtmParams | null {
  const record = readStoredRecord();
  return record === null ? null : withoutTimestamp(record);
}

/**
 * The campaign, as tags on the Cashfree order. It rides alongside the engraving choices already
 * written there by `toOrderOptionTags`, and like them it is never an amount.
 *
 * The same three values are now also columns on `orders`, and a new customer's first touch is
 * kept on `customers` ([ADR-042](/docs/decisions/ADR-042-order-capture-in-postgres.md)). The
 * tags stay because that database write may fail without failing the checkout, and because
 * attribution is worth reading from the payment record itself.
 *
 * An order with no attribution produces an empty map, which the route drops entirely: a
 * shopper who arrived with no campaign sends Cashfree exactly the request it always sent.
 */
export function toUtmOrderTags(utm: UtmParams | null): Record<string, string> {
  if (utm === null) return {};

  const tags: Record<string, string> = {};

  for (const { field, queryParam } of ORDER_TAGGED_FIELDS) {
    const value = utm[field];
    if (value !== undefined) tags[queryParam] = value;
  }

  return tags;
}
