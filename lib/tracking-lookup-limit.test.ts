import { describe, expect, it } from "vitest";
import {
  MAX_TRACKED_LOOKUP_CLIENTS,
  MAX_TRACKING_LOOKUPS_PER_WINDOW,
  TRACKING_LOOKUP_WINDOW_MS,
  recordTrackingLookup,
  resolveTrackingClientKey,
  type TrackingLookupStore,
  type TrackingLookupVerdict,
} from "@/lib/tracking-lookup-limit";

const CLIENT = "203.0.113.7";
const OTHER_CLIENT = "203.0.113.8";

/**
 * A clock this file hands in rather than one it waits for. Every window boundary below is a
 * number, so the sliding window is tested at the millisecond either side of the edge instead of
 * being approximated by a `setTimeout` that would make the suite a minute longer and flaky.
 */
function lookupSequence(
  count: number,
  options: { store: TrackingLookupStore; startMs: number; stepMs?: number; client?: string },
): TrackingLookupVerdict[] {
  const { store, startMs, stepMs = 1, client = CLIENT } = options;

  return Array.from({ length: count }, (_unused, index) =>
    recordTrackingLookup(client, startMs + index * stepMs, store),
  );
}

function emptyStore(): TrackingLookupStore {
  return new Map();
}

describe("the configured threshold", () => {
  it("is eight lookups in a sixty-second window", () => {
    expect(MAX_TRACKING_LOOKUPS_PER_WINDOW).toBe(8);
    expect(TRACKING_LOOKUP_WINDOW_MS).toBe(60_000);
  });
});

describe("a client inside the window", () => {
  it("is allowed exactly the configured number of lookups and then throttled", () => {
    const store = emptyStore();
    const verdicts = lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW + 4, {
      store,
      startMs: 1_000,
    });

    expect(verdicts.slice(0, MAX_TRACKING_LOOKUPS_PER_WINDOW)).toEqual(
      Array(MAX_TRACKING_LOOKUPS_PER_WINDOW).fill("allowed"),
    );
    expect(verdicts.slice(MAX_TRACKING_LOOKUPS_PER_WINDOW)).toEqual(
      Array(4).fill("throttled"),
    );
  });

  it("throttles on the ninth attempt however slowly the eight were spent", () => {
    const store = emptyStore();
    const spentOverFiftySeconds = lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW, {
      store,
      startMs: 1_000,
      stepMs: 6_000,
    });

    expect(spentOverFiftySeconds).toEqual(
      Array(MAX_TRACKING_LOOKUPS_PER_WINDOW).fill("allowed"),
    );
    expect(recordTrackingLookup(CLIENT, 1_000 + 7 * 6_000 + 1, store)).toBe("throttled");
  });

  it("counts each client separately", () => {
    const store = emptyStore();
    lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW, { store, startMs: 1_000 });

    expect(recordTrackingLookup(CLIENT, 1_100, store)).toBe("throttled");
    expect(recordTrackingLookup(OTHER_CLIENT, 1_100, store)).toBe("allowed");
  });
});

describe("the window sliding forward", () => {
  it("keeps a lookup counted until its minute is fully up", () => {
    const store = emptyStore();
    lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW, { store, startMs: 1_000, stepMs: 0 });

    expect(recordTrackingLookup(CLIENT, 1_000 + TRACKING_LOOKUP_WINDOW_MS - 1, store)).toBe(
      "throttled",
    );
  });

  it("lets the client through on the millisecond that minute is up", () => {
    const store = emptyStore();
    lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW, { store, startMs: 1_000, stepMs: 0 });

    expect(recordTrackingLookup(CLIENT, 1_000 + TRACKING_LOOKUP_WINDOW_MS, store)).toBe(
      "allowed",
    );
  });

  it("releases the allowance one lookup at a time, not eight at once", () => {
    const store = emptyStore();
    lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW, {
      store,
      startMs: 1_000,
      stepMs: 5_000,
    });

    const justAfterTheFirstExpires = 1_000 + TRACKING_LOOKUP_WINDOW_MS + 1;

    expect(recordTrackingLookup(CLIENT, justAfterTheFirstExpires, store)).toBe("allowed");
    expect(recordTrackingLookup(CLIENT, justAfterTheFirstExpires, store)).toBe("throttled");
  });

  /**
   * The property the module's comment claims: a throttled attempt is not recorded, so hammering
   * the box does not push the window forward. Eight accepted lookups at t=1000 and then a
   * thousand refused ones at t=59_000 must still clear at t=61_001 — a minute after the eighth
   * *accepted* lookup, not a minute after the client gave up.
   */
  it("does not let a refused attempt extend the client's own window", () => {
    const store = emptyStore();
    lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW, { store, startMs: 1_000, stepMs: 0 });

    for (let attempt = 0; attempt < 1_000; attempt += 1) {
      expect(recordTrackingLookup(CLIENT, 59_000, store)).toBe("throttled");
    }

    expect(recordTrackingLookup(CLIENT, 1_000 + TRACKING_LOOKUP_WINDOW_MS + 1, store)).toBe(
      "allowed",
    );
  });
});

describe("the store's own bound", () => {
  it("forgets clients with nothing recent once the cap is passed", () => {
    const store = emptyStore();

    for (let client = 0; client <= MAX_TRACKED_LOOKUP_CLIENTS; client += 1) {
      recordTrackingLookup(`stale-${client}`, 1_000, store);
    }
    expect(store.size).toBe(MAX_TRACKED_LOOKUP_CLIENTS + 1);

    const wellAfterTheWindow = 1_000 + TRACKING_LOOKUP_WINDOW_MS * 2;

    expect(recordTrackingLookup(CLIENT, wellAfterTheWindow, store)).toBe("allowed");
    expect(store.size).toBe(1);
    expect(Array.from(store.keys())).toEqual([CLIENT]);
  });

  it("clears outright when every remembered client is still recent", () => {
    const store = emptyStore();

    for (let client = 0; client <= MAX_TRACKED_LOOKUP_CLIENTS; client += 1) {
      recordTrackingLookup(`busy-${client}`, 1_000, store);
    }

    expect(recordTrackingLookup(CLIENT, 1_001, store)).toBe("allowed");
    expect(store.size).toBe(1);
  });
});

/**
 * Everything above hands in its own store. This block does not: it exercises the module-level
 * counter that `/track` actually calls, because a limiter that only throttles the map a test
 * passed it is not a limiter.
 */
describe("the counter the page really uses", () => {
  it("throttles a client after the configured threshold with no store handed in", () => {
    const client = "198.51.100.201";
    const now = Date.now();

    const verdicts = Array.from({ length: MAX_TRACKING_LOOKUPS_PER_WINDOW + 1 }, () =>
      recordTrackingLookup(client, now),
    );

    expect(verdicts.slice(0, MAX_TRACKING_LOOKUPS_PER_WINDOW)).toEqual(
      Array(MAX_TRACKING_LOOKUPS_PER_WINDOW).fill("allowed"),
    );
    expect(verdicts[MAX_TRACKING_LOOKUPS_PER_WINDOW]).toBe("throttled");
    expect(recordTrackingLookup("198.51.100.202", now)).toBe("allowed");
  });
});

describe("who the counter thinks is asking", () => {
  it("reads the first entry of x-forwarded-for", () => {
    const key = resolveTrackingClientKey((name) =>
      name === "x-forwarded-for" ? "203.0.113.9, 70.41.3.18, 150.172.238.178" : null,
    );

    expect(key).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then to one shared bucket", () => {
    expect(
      resolveTrackingClientKey((name) => (name === "x-real-ip" ? "203.0.113.10" : null)),
    ).toBe("203.0.113.10");

    expect(resolveTrackingClientKey(() => null)).toBe("unattributed");
    expect(resolveTrackingClientKey(() => "")).toBe("unattributed");
    expect(resolveTrackingClientKey(() => undefined)).toBe("unattributed");
  });

  it("throttles the shared bucket too, so an unattributable flood is still bounded", () => {
    const store = emptyStore();
    const unattributed = resolveTrackingClientKey(() => null);
    const verdicts = lookupSequence(MAX_TRACKING_LOOKUPS_PER_WINDOW + 1, {
      store,
      startMs: 1_000,
      client: unattributed,
    });

    expect(verdicts[MAX_TRACKING_LOOKUPS_PER_WINDOW]).toBe("throttled");
  });
});
