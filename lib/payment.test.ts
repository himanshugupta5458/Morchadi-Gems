import { describe, expect, it } from "vitest";
import { isCreateOrderSuccess } from "@/lib/payment";

const VALID = {
  cashfreeOrderId: "MG_1786968394909_v8j3wggq",
  trackingId: "W2ACEHACUU",
  paymentSessionId: "session_xxxxxxxxxxxxxxxxxxxxx",
  mode: "sandbox",
};

/**
 * The payment page acts on this body by leaving the site, so a shape it half-recognises is
 * worse than one it rejects: the fallback is an error the shopper can retry, and the
 * alternative is a redirect to Cashfree with a bundle stamped with the wrong order.
 */
describe("the create-order 200 body, as the browser validates it", () => {
  it("accepts a captured order", () => {
    expect(isCreateOrderSuccess(VALID)).toBe(true);
  });

  it("accepts a null order number, because the capture is allowed to fail", () => {
    expect(isCreateOrderSuccess({ ...VALID, trackingId: null })).toBe(true);
  });

  it("refuses a body with no order number key at all", () => {
    const withoutTrackingId: Record<string, unknown> = { ...VALID };
    delete withoutTrackingId.trackingId;

    expect(isCreateOrderSuccess(withoutTrackingId)).toBe(false);
  });

  it("refuses an empty order number, which is not one", () => {
    expect(isCreateOrderSuccess({ ...VALID, trackingId: "" })).toBe(false);
  });

  it("refuses the old shape, which called the Cashfree id `orderId`", () => {
    expect(
      isCreateOrderSuccess({
        orderId: VALID.cashfreeOrderId,
        paymentSessionId: VALID.paymentSessionId,
        mode: "sandbox",
      }),
    ).toBe(false);
  });

  it("refuses a missing or empty payment session, which is the one thing it is for", () => {
    expect(isCreateOrderSuccess({ ...VALID, paymentSessionId: "" })).toBe(false);
    expect(isCreateOrderSuccess({ ...VALID, paymentSessionId: undefined })).toBe(false);
  });

  it("refuses a mode the SDK could not be initialised against", () => {
    expect(isCreateOrderSuccess({ ...VALID, mode: "staging" })).toBe(false);
  });

  it("refuses anything that is not an object", () => {
    expect(isCreateOrderSuccess(null)).toBe(false);
    expect(isCreateOrderSuccess("ok")).toBe(false);
  });
});
