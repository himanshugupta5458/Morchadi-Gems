import { describe, expect, it } from "vitest";
import { captureUtmParams, getStoredUtmParams, parseUtmParams } from "@/lib/utm";

/**
 * This file deliberately runs in the default `node` environment, where there is no `window` at
 * all. `lib/utm.ts` is imported by the root layout's client components *and* by two route
 * handlers, so every one of its exports has to survive being reached on a server, and a jsdom
 * test with a stubbed global would only prove the stub works.
 */
describe("on the server, where there is no browser", () => {
  it("has no window to reach for", () => {
    expect(typeof window).toBe("undefined");
  });

  it("captures nothing and reports nothing, rather than throwing", () => {
    expect(() => captureUtmParams()).not.toThrow();
    expect(captureUtmParams()).toBeNull();
    expect(() => getStoredUtmParams()).not.toThrow();
    expect(getStoredUtmParams()).toBeNull();
  });

  it("still validates a campaign a route handler was posted", () => {
    expect(parseUtmParams({ source: "instagram", medium: "paid_social" })).toEqual({
      source: "instagram",
      medium: "paid_social",
    });
  });
});
