/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UTM_ATTRIBUTION_WINDOW_DAYS,
  UTM_STORAGE_KEY,
  UTM_VALUE_MAX_LENGTH,
  captureUtmParams,
  getStoredUtmParams,
  parseUtmParams,
  readUtmFromSearchParams,
  toUtmOrderTags,
} from "@/lib/utm";

const MILLISECONDS_PER_DAY = 86_400_000;
const ARRIVAL_TIME = new Date("2026-08-19T09:00:00.000Z");

function arriveOn(search: string): void {
  window.history.replaceState({}, "", search.length === 0 ? "/" : `/?${search}`);
}

function storedRecord(): Record<string, unknown> | null {
  const rawValue = window.localStorage.getItem(UTM_STORAGE_KEY);
  return rawValue === null
    ? null
    : (JSON.parse(rawValue) as Record<string, unknown>);
}

function daysLater(days: number): Date {
  return new Date(ARRIVAL_TIME.getTime() + days * MILLISECONDS_PER_DAY);
}

beforeEach(() => {
  window.localStorage.clear();
  arriveOn("");
  vi.useFakeTimers();
  vi.setSystemTime(ARRIVAL_TIME);
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("reading a campaign off a URL", () => {
  it("takes all five parameters when a link carries all five", () => {
    const params = readUtmFromSearchParams(
      new URLSearchParams(
        "utm_source=instagram&utm_medium=paid_social&utm_campaign=rakhi_2026&utm_term=anti+tarnish+rings&utm_content=carousel_2",
      ),
    );

    expect(params).toEqual({
      source: "instagram",
      medium: "paid_social",
      campaign: "rakhi_2026",
      term: "anti tarnish rings",
      content: "carousel_2",
    });
  });

  it("takes the ones that are there and leaves the rest absent", () => {
    expect(
      readUtmFromSearchParams(new URLSearchParams("utm_source=whatsapp")),
    ).toEqual({ source: "whatsapp" });
  });

  it("is null for a URL with no campaign on it, and for empty values", () => {
    expect(readUtmFromSearchParams(new URLSearchParams(""))).toBeNull();
    expect(
      readUtmFromSearchParams(new URLSearchParams("q=rings&page=2")),
    ).toBeNull();
    expect(
      readUtmFromSearchParams(new URLSearchParams("utm_source=&utm_medium=%20%20")),
    ).toBeNull();
  });

  it("bounds what a crafted link can put into a payment record", () => {
    const params = readUtmFromSearchParams(
      new URLSearchParams(`utm_campaign=${"x".repeat(500)}`),
    );

    expect(params?.campaign).toHaveLength(UTM_VALUE_MAX_LENGTH);
  });

  it("flattens a value carrying newlines so it cannot forge a message line", () => {
    const params = readUtmFromSearchParams(
      new URLSearchParams({ utm_source: "insta\ngram\tpost" }),
    );

    expect(params).toEqual({ source: "insta gram post" });
  });
});

describe("parsing a campaign that arrived from a browser", () => {
  it("keeps the usable fields and drops everything else", () => {
    expect(
      parseUtmParams({
        source: "instagram",
        medium: 42,
        campaign: null,
        term: "  ",
        content: "story_1",
        total: 1,
      }),
    ).toEqual({ source: "instagram", content: "story_1" });
  });

  it("is null for anything that is not an object with a usable field in it", () => {
    expect(parseUtmParams(undefined)).toBeNull();
    expect(parseUtmParams(null)).toBeNull();
    expect(parseUtmParams("utm_source=instagram")).toBeNull();
    expect(parseUtmParams({})).toBeNull();
    expect(parseUtmParams({ price: 1, total: 999 })).toBeNull();
  });
});

describe("capturing the first touch", () => {
  it("writes the campaign and the moment it was captured", () => {
    arriveOn("utm_source=instagram&utm_medium=paid_social&utm_campaign=rakhi_2026");

    expect(captureUtmParams()).toEqual({
      source: "instagram",
      medium: "paid_social",
      campaign: "rakhi_2026",
    });
    expect(storedRecord()).toEqual({
      source: "instagram",
      medium: "paid_social",
      campaign: "rakhi_2026",
      capturedAt: ARRIVAL_TIME.toISOString(),
    });
  });

  it("writes nothing at all for a visit carrying no campaign", () => {
    arriveOn("");
    expect(captureUtmParams()).toBeNull();

    arriveOn("q=rings");
    expect(captureUtmParams()).toBeNull();

    expect(storedRecord()).toBeNull();
    expect(getStoredUtmParams()).toBeNull();
  });

  it("keeps the first campaign when a later visit brings a different one", () => {
    arriveOn("utm_source=instagram&utm_campaign=rakhi_2026");
    captureUtmParams();

    vi.setSystemTime(daysLater(3));
    arriveOn("utm_source=google&utm_medium=cpc&utm_campaign=brand");

    expect(captureUtmParams()).toEqual({
      source: "instagram",
      campaign: "rakhi_2026",
    });
    expect(getStoredUtmParams()).toEqual({
      source: "instagram",
      campaign: "rakhi_2026",
    });
    expect(storedRecord()?.capturedAt).toBe(ARRIVAL_TIME.toISOString());
  });

  it("does not let an uncampaigned visit erase the campaign that is stored", () => {
    arriveOn("utm_source=instagram");
    captureUtmParams();

    arriveOn("");
    expect(captureUtmParams()).toEqual({ source: "instagram" });
    expect(getStoredUtmParams()).toEqual({ source: "instagram" });
  });

  it("survives a browser that refuses to store anything", () => {
    arriveOn("utm_source=instagram");
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(() => captureUtmParams()).not.toThrow();
    expect(captureUtmParams()).toEqual({ source: "instagram" });

    setItem.mockRestore();
  });
});

describe("the ninety day window", () => {
  it("still reports the campaign on the last day of the window", () => {
    arriveOn("utm_source=instagram");
    captureUtmParams();

    vi.setSystemTime(daysLater(UTM_ATTRIBUTION_WINDOW_DAYS));

    expect(getStoredUtmParams()).toEqual({ source: "instagram" });
  });

  it("reports nothing once the window has passed", () => {
    arriveOn("utm_source=instagram");
    captureUtmParams();

    vi.setSystemTime(daysLater(UTM_ATTRIBUTION_WINDOW_DAYS + 1));

    expect(getStoredUtmParams()).toBeNull();
  });

  it("lets a new campaign take an expired record's place, so the window rolls", () => {
    arriveOn("utm_source=instagram&utm_campaign=rakhi_2026");
    captureUtmParams();

    vi.setSystemTime(daysLater(UTM_ATTRIBUTION_WINDOW_DAYS + 1));
    arriveOn("utm_source=google&utm_medium=cpc");

    expect(captureUtmParams()).toEqual({ source: "google", medium: "cpc" });
    expect(getStoredUtmParams()).toEqual({ source: "google", medium: "cpc" });
  });

  it("treats an unreadable or undated record as no record at all", () => {
    for (const rawValue of [
      "not json",
      "null",
      '"instagram"',
      JSON.stringify({ source: "instagram" }),
      JSON.stringify({ source: "instagram", capturedAt: "whenever" }),
      JSON.stringify({ capturedAt: ARRIVAL_TIME.toISOString() }),
    ]) {
      window.localStorage.setItem(UTM_STORAGE_KEY, rawValue);
      expect(getStoredUtmParams(), rawValue).toBeNull();
    }
  });
});

describe("what travels onto the Cashfree order", () => {
  it("tags the three fields that name a campaign, and only those", () => {
    expect(
      toUtmOrderTags({
        source: "instagram",
        medium: "paid_social",
        campaign: "rakhi_2026",
        term: "anti tarnish rings",
        content: "carousel_2",
      }),
    ).toEqual({
      utm_source: "instagram",
      utm_medium: "paid_social",
      utm_campaign: "rakhi_2026",
    });
  });

  it("tags only what is present, and nothing at all without a campaign", () => {
    expect(toUtmOrderTags({ source: "whatsapp" })).toEqual({
      utm_source: "whatsapp",
    });
    expect(toUtmOrderTags({ term: "rings" })).toEqual({});
    expect(toUtmOrderTags(null)).toEqual({});
  });

  it("never produces a tag value Cashfree would reject as too long", () => {
    const tags = toUtmOrderTags({ campaign: "x".repeat(UTM_VALUE_MAX_LENGTH) });

    for (const value of Object.values(tags)) {
      expect(value.length).toBeLessThanOrEqual(255);
    }
  });
});
