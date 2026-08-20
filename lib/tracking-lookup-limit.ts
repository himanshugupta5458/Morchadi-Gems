import { firstForwardedValue } from "@/lib/admin-routing";

/**
 * The window a client's lookups are counted over, and how many are allowed inside it.
 *
 * Eight a minute is far more than a person tracking their own parcel will ever need — the
 * realistic figure is one, or three with a typo — and it is nowhere near enough to walk an
 * id space of 31^10. It is a speed bump against a script pointed at the box, in the same
 * spirit and with the same honesty as `FAILED_LOGIN_FLOOR_MS` in `lib/admin-auth.ts`: it is
 * not rate limiting as a security control and does not pretend to be. See
 * [ADR-045](/docs/decisions/ADR-045-public-order-tracking.md).
 */
export const TRACKING_LOOKUP_WINDOW_MS = 60_000;
export const MAX_TRACKING_LOOKUPS_PER_WINDOW = 8;

/**
 * How many clients the counter will remember at once. A solo-operator shop sees nothing near
 * this; the cap exists so that a spray of requests from many addresses cannot grow the map
 * without bound in a long-lived Node process.
 */
export const MAX_TRACKED_LOOKUP_CLIENTS = 1_000;

export type TrackingLookupVerdict = "allowed" | "throttled";

/** Recent lookup instants per client. Exported as a type so a test can hand in its own. */
export type TrackingLookupStore = Map<string, number[]>;

/**
 * The counter for this process.
 *
 * In-memory on purpose. This deployment is one Node container (ADR-032), so one process holds
 * the whole count; a Redis or a database table would be a new dependency, a new failure mode
 * on a public page, and a new thing to operate, all to slow down an attack that the id space
 * already makes pointless. If the site is ever run as more than one replica this becomes a
 * per-replica count, which is a weaker bound rather than a broken one.
 */
const processLookupStore: TrackingLookupStore = new Map();

function dropClientsWithNoRecentLookups(store: TrackingLookupStore, windowStart: number): void {
  for (const [clientKey, instants] of Array.from(store.entries())) {
    if (instants.every((instant) => instant <= windowStart)) store.delete(clientKey);
  }
}

/**
 * Records one lookup and says whether it may proceed.
 *
 * A sliding window rather than a fixed one: a fixed window lets a client spend its whole
 * allowance in the last second of one minute and again in the first second of the next.
 *
 * A throttled attempt is **not** recorded, so a client that keeps hammering does not push its
 * own window forward forever — it becomes allowed again a minute after its eighth accepted
 * lookup, not a minute after it stops trying.
 */
export function recordTrackingLookup(
  clientKey: string,
  nowMs: number,
  store: TrackingLookupStore = processLookupStore,
): TrackingLookupVerdict {
  const windowStart = nowMs - TRACKING_LOOKUP_WINDOW_MS;

  if (store.size > MAX_TRACKED_LOOKUP_CLIENTS) {
    dropClientsWithNoRecentLookups(store, windowStart);
    if (store.size > MAX_TRACKED_LOOKUP_CLIENTS) store.clear();
  }

  const recentLookups = (store.get(clientKey) ?? []).filter(
    (instant) => instant > windowStart,
  );

  if (recentLookups.length >= MAX_TRACKING_LOOKUPS_PER_WINDOW) {
    store.set(clientKey, recentLookups);
    return "throttled";
  }

  store.set(clientKey, [...recentLookups, nowMs]);
  return "allowed";
}

/**
 * Who is asking, as well as this can be known behind a proxy.
 *
 * `x-forwarded-for` is set by Coolify's proxy and its first entry is the client. It is also
 * trivially forged by a client that reaches the process directly, which is the reason the
 * limit above is described as friction rather than a control — anyone willing to spoof a
 * header per request is not slowed down by it at all. Everything falls back to one shared
 * bucket rather than to no bucket, so an unattributable flood is still bounded.
 */
export function resolveTrackingClientKey(
  readHeader: (name: string) => string | null | undefined,
): string {
  const forwardedFor = firstForwardedValue(readHeader("x-forwarded-for"));
  if (forwardedFor.length > 0) return forwardedFor;

  const realIp = firstForwardedValue(readHeader("x-real-ip"));
  return realIp.length > 0 ? realIp : "unattributed";
}
