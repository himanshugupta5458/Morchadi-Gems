import { describe, expect, it } from "vitest";
import type { Address, CheckoutData } from "@/types/cart";
import { SITE_CONFIG } from "@/lib/config";
import {
  composeCodOrderConfirmationEmail,
  composePaidOrderConfirmationEmail,
} from "@/lib/customer-email-message";
import { formatTrackingDate } from "@/lib/order-tracking-copy";
import type { CodOrderMessageInput } from "@/lib/notify-message";

const TRACKING_ID = "K7M2QPX9RJ";
const COD_REFERENCE = "COD_1786968394909_v8j3wggq";
const CASHFREE_ORDER_ID = "MG_1786968394909_v8j3wggq";
const TRACKING_URL = "https://morchadigems.com/track?order_id=K7M2QPX9RJ";
const CREATED_AT = new Date("2026-08-25T10:00:00Z");

const ADDRESS: Address = {
  name: "Ananya Iyer",
  phone: "9876543210",
  email: "ananya@example.com",
  line1: "12 Rani Bagh",
  line2: "Near Amber Fort Road",
  city: "Jaipur",
  state: "Rajasthan",
  pincode: "302001",
};

function makeCodOrder(overrides: Partial<CodOrderMessageInput> = {}): CodOrderMessageInput {
  return {
    trackingId: TRACKING_ID,
    codOrderReference: COD_REFERENCE,
    amountDue: 746,
    subtotal: 647,
    shipping: 99,
    total: 746,
    items: [
      { name: "Wave Band Initial Ring", qty: 2, selectedOptions: { Letter: "A" } },
      { name: "Pearl Drop Earrings", qty: 1 },
    ],
    address: ADDRESS,
    ...overrides,
  };
}

function makeBundle(overrides: Partial<CheckoutData> = {}): CheckoutData {
  return {
    cart: [
      {
        productId: "P001",
        name: "Wave Band Initial Ring",
        price: 199,
        image: "/products/P001.webp",
        qty: 2,
        selectedOptions: { Letter: "A" },
      },
    ],
    address: ADDRESS,
    subtotal: 647,
    shipping: 99,
    total: 746,
    ...overrides,
  };
}

/**
 * The journey graphic marks each of its four step circles with `data-step="…"`. Extracting
 * exactly those markers, in order, lets a test assert on the highlighted state without caring
 * about the surrounding table markup — and without confusing the graphic's own gold circle
 * with the header band or the tracking button, which use the same brand colours elsewhere in
 * the email.
 */
function extractJourneyStepFills(html: string): { step: string; fill: string }[] {
  const journeyBlock = html.slice(html.indexOf("<!-- journey-start -->"), html.indexOf("<!-- journey-end -->"));
  const matches = [...journeyBlock.matchAll(/data-step="([a-z]+)"\s+bgcolor="(#[0-9A-Fa-f]{6})"/g)];
  return matches.map(([, step, fill]) => ({ step, fill }));
}

function expectOnlyOrderPlacedHighlighted(html: string): void {
  const fills = extractJourneyStepFills(html);
  expect(fills.map((entry) => entry.step)).toEqual(["placed", "packed", "shipped", "delivered"]);

  const distinctFills = new Set(fills.map((entry) => entry.fill));
  expect(distinctFills.size).toBe(2);

  const [placed, ...rest] = fills;
  expect(rest.every((entry) => entry.fill === rest[0].fill)).toBe(true);
  expect(placed.fill).not.toBe(rest[0].fill);
}

describe("the cash-on-delivery customer email", () => {
  it("has an honest, specific subject that never claims a confirmed payment", () => {
    const { subject } = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(subject).toBe(`Your ${SITE_CONFIG.brandName} cash-on-delivery order is placed`);
    expect(subject.toLowerCase()).not.toContain("confirmed");
  });

  it("says plainly that nothing has been paid, and never claims otherwise", () => {
    const { html } = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).toContain("Nothing has been paid yet");
    expect(html).not.toContain("Payment received");
    expect(html).not.toContain("payment received");
  });

  it("gives the amount due at the door, the order number and the items", () => {
    const { html } = composeCodOrderConfirmationEmail({
      order: makeCodOrder({ amountDue: 1299, total: 1299 }),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).toContain("₹1,299");
    expect(html).toContain(TRACKING_ID);
    expect(html).toContain("Wave Band Initial Ring");
    expect(html).toContain("Letter: A");
    expect(html).toContain("Pearl Drop Earrings");
  });

  it("shows when the order was placed", () => {
    const { html } = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).toContain(formatTrackingDate(CREATED_AT));

    const withoutDate = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: null,
    });
    expect(withoutDate.html).not.toContain("Placed on");
  });

  it("gives the full delivery address", () => {
    const { html } = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).toContain("Ananya Iyer");
    expect(html).toContain("12 Rani Bagh");
    expect(html).toContain("Near Amber Fort Road");
    expect(html).toContain("Jaipur, Rajasthan 302001");
  });

  it("includes the tracking link prominently, and omits it when there is none", () => {
    const withLink = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });
    expect(withLink.html).toContain(`href="${TRACKING_URL}"`);
    expect(withLink.html).toContain("Track your order");

    const withoutLink = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: null,
      createdAt: CREATED_AT,
    });
    expect(withoutLink.html).not.toContain("Track your order");
    expect(withoutLink.html).not.toContain(TRACKING_URL);
  });

  it("shows the order journey with only Order Placed highlighted", () => {
    const { html } = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expectOnlyOrderPlacedHighlighted(html);
    expect(html).toContain("Order Placed");
    expect(html).toContain("Packed");
    expect(html).toContain("Shipped");
    expect(html).toContain("Delivered");
  });

  it("escapes address and item text rather than trusting it as markup", () => {
    const { html } = composeCodOrderConfirmationEmail({
      order: makeCodOrder({
        address: { ...ADDRESS, name: "<script>alert(1)</script>" },
      }),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("never mentions cost or margin data, which this channel has no business carrying", () => {
    const { html, subject } = composeCodOrderConfirmationEmail({
      order: makeCodOrder(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html.toLowerCase()).not.toContain("cost");
    expect(subject.toLowerCase()).not.toContain("cost");
  });
});

describe("the paid and partial-payment customer email", () => {
  it("has an honest subject and body for a fully prepaid order", () => {
    const { subject, html } = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: makeBundle(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(subject).toBe(`Your ${SITE_CONFIG.brandName} order is confirmed`);
    expect(html).toContain("Nothing more is needed");
    expect(html).not.toContain("Due on delivery");
  });

  it("states the balance still due, for a partial-payment order", () => {
    const { subject, html } = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 300,
      amountDue: 446,
      bundle: makeBundle({ total: 746 }),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(subject).toBe(`Your ${SITE_CONFIG.brandName} order is confirmed: balance due at delivery`);
    expect(html).toContain("₹300");
    expect(html).toContain("₹446");
    expect(html).toContain("Due on delivery");
    expect(html).not.toContain("Nothing more is needed");
  });

  it("treats an unreadable balance the same way the confirmation page does: as nothing owing", () => {
    const { subject, html } = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: null,
      bundle: makeBundle(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(subject).toBe(`Your ${SITE_CONFIG.brandName} order is confirmed`);
    expect(html).toContain("Nothing more is needed");
  });

  it("prints Cashfree's own amount, never the bundle's total", () => {
    const { html } = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 999,
      amountDue: 0,
      bundle: makeBundle({ total: 1 }),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).toContain("₹999");
  });

  it("falls back to the Cashfree reference when there is no order number", () => {
    const { html } = composePaidOrderConfirmationEmail({
      trackingId: null,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: makeBundle(),
      trackingUrl: null,
      createdAt: null,
    });

    expect(html).toContain(CASHFREE_ORDER_ID);
  });

  it("degrades gracefully to a message with no items when the summary did not survive", () => {
    const { html } = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: null,
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).toContain(TRACKING_ID);
    expect(html).not.toContain("Deliver to");
  });

  it("shows when the order was placed, and omits the line when it could not be read", () => {
    const withDate = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: makeBundle(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });
    expect(withDate.html).toContain(formatTrackingDate(CREATED_AT));

    const withoutDate = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: makeBundle(),
      trackingUrl: TRACKING_URL,
      createdAt: null,
    });
    expect(withoutDate.html).not.toContain("Placed on");
  });

  it("includes the tracking link prominently", () => {
    const { html } = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: makeBundle(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });

    expect(html).toContain(`href="${TRACKING_URL}"`);
    expect(html).toContain("Track your order");
  });

  it("shows the order journey with only Order Placed highlighted, for a full payment, a partial payment, and a degraded bundle", () => {
    const full = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: makeBundle(),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });
    expectOnlyOrderPlacedHighlighted(full.html);

    const partial = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 300,
      amountDue: 446,
      bundle: makeBundle({ total: 746 }),
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });
    expectOnlyOrderPlacedHighlighted(partial.html);

    const noBundle = composePaidOrderConfirmationEmail({
      trackingId: TRACKING_ID,
      cashfreeOrderId: CASHFREE_ORDER_ID,
      amountPaid: 746,
      amountDue: 0,
      bundle: null,
      trackingUrl: TRACKING_URL,
      createdAt: CREATED_AT,
    });
    expectOnlyOrderPlacedHighlighted(noBundle.html);
  });

  it("never mentions cost or margin data", () => {
    for (const amountDue of [0, 446, null]) {
      const { html } = composePaidOrderConfirmationEmail({
        trackingId: TRACKING_ID,
        cashfreeOrderId: CASHFREE_ORDER_ID,
        amountPaid: 746,
        amountDue,
        bundle: makeBundle(),
        trackingUrl: TRACKING_URL,
        createdAt: CREATED_AT,
      });

      expect(html.toLowerCase()).not.toContain("cost");
    }
  });
});
