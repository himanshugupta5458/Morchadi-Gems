import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Prisma } from "@prisma/client";
import { TRACK_ORDER_QUERY_PARAM } from "@/lib/navigation";
import { findPublicOrderTracking } from "@/lib/order-tracking";
import { ORDER_NOT_FOUND_MESSAGE } from "@/lib/order-tracking-copy";
import { prisma } from "@/lib/prisma";

const requestHeaderState = vi.hoisted(() => ({ forwardedFor: "203.0.113.1" }));

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) =>
      name.toLowerCase() === "x-forwarded-for" ? requestHeaderState.forwardedFor : null,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const START_POSTGRES_HINT = "start it with `docker compose up -d` — see docs/DEV-DATABASE.md";

let unavailableReason: string | null = null;

function firstLineOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "unknown error";
}

/**
 * This file commits its fixture rather than rolling it back, unlike the admin read tests. The
 * page under test reaches the database through the module-level `prisma` client rather than
 * through a client this file could hand it, so a row living inside an open transaction is a row
 * `/track` cannot see. `afterAll` deletes it by explicit id, the way
 * `lib/checkout-capture-route.test.ts` does for the same reason.
 */
const FIXTURE_ORDER_ID = "TRACKPRV23";
const FIXTURE_CUSTOMER_PHONE = "9812744561";

/**
 * Every value below is a token no template, class name or piece of copy could emit by
 * accident. That is the whole point of them: an assertion that `/track` does not render the
 * word "Mumbai" would pass on a page that renders no address *and* fail to notice a page that
 * renders a different customer's, whereas `QQZCITYTOKEN` can only appear on the page if it came
 * out of this order's row.
 *
 * The list is split in two because ADR-071 moved five of them across. `/track` now shows what
 * was bought and what is paid or owed, so those five are asserted **present** rather than
 * absent — a `not.toContain` left behind on a value the page is supposed to render is a test
 * that passes by accident and stops guarding anything.
 *
 * What did not move is the point of the split: the address, the name, the phone number, the
 * email, the operator, the reasons, the cost, the payment type, the Cashfree id and the
 * campaign are all still forbidden, and the address is forbidden on the same reasoning ADR-045
 * gave — this page takes an order number and nothing else.
 */
const WITHHELD_VALUES: Readonly<Record<string, string>> = {
  "the operator who moved the order": "qqz-operator-token",
  "the reason typed beside a status change": "Courier NDR-77 QQZREASONTOKEN, nobody at the gate",
  "the reason typed beside an address correction": "Address corrected QQZFIXTOKEN on request",
  "the customer's phone number": FIXTURE_CUSTOMER_PHONE,
  "the customer's name": "QQZBUYERTOKEN Iyer",
  "the customer's email": "qqzmailtoken@example.test",
  "the first line of the shipping address": "12 QQZSTREETTOKEN Villa",
  "the second line of the shipping address": "Bandra QQZAREATOKEN",
  "the city": "QQZCITYTOKEN",
  "the pincode": "400051",
  "the payment type": "partial_cod",
  "the Cashfree order id": "MG_QQZCASHFREETOKEN_TRACKPRV23",
  "the campaign that won the customer": "qqzutmtoken",
  "the order subtotal, which is also the line's unit price": "4261",
  "what the order cost the shop": "1234.56",
};

/**
 * The five ADR-071 added, as they appear in the **props** — raw, unformatted, the way
 * `JSON.stringify` writes them. The rendered page states the three amounts through
 * `formatRupees`, so the HTML assertions below look for "₹4,321" rather than "4321".
 */
const SHOWN_VALUES: Readonly<Record<string, string>> = {
  "the product that was bought": "QQZPRODUCTTOKEN Ring",
  "the recorded option": "QQZLETTERTOKEN",
  "the order total": "4321",
  "what was collected before dispatch": "2101",
  "what is still owed on delivery": "2220",
};

const EVERY_FIXTURE_VALUE: Readonly<Record<string, string>> = {
  ...WITHHELD_VALUES,
  ...SHOWN_VALUES,
};

function leakableValue(label: keyof typeof EVERY_FIXTURE_VALUE): string {
  return EVERY_FIXTURE_VALUE[label];
}

const FIXTURE_SHIPPING_ADDRESS = {
  name: leakableValue("the customer's name"),
  phone: FIXTURE_CUSTOMER_PHONE,
  email: leakableValue("the customer's email"),
  line1: leakableValue("the first line of the shipping address"),
  line2: leakableValue("the second line of the shipping address"),
  city: leakableValue("the city"),
  state: "Maharashtra",
  pincode: leakableValue("the pincode"),
};

async function removeFixture(): Promise<void> {
  if (unavailableReason !== null) return;

  await prisma.orderStatusHistory.deleteMany({ where: { orderId: FIXTURE_ORDER_ID } });
  await prisma.orderLineItem.deleteMany({ where: { orderId: FIXTURE_ORDER_ID } });
  await prisma.order.deleteMany({ where: { id: FIXTURE_ORDER_ID } });
  await prisma.customer.deleteMany({ where: { phone: FIXTURE_CUSTOMER_PHONE } });
}

async function createFixture(): Promise<void> {
  const customer = await prisma.customer.create({
    data: {
      phone: FIXTURE_CUSTOMER_PHONE,
      name: leakableValue("the customer's name"),
      email: leakableValue("the customer's email"),
      firstUtmSource: leakableValue("the campaign that won the customer"),
    },
    select: { id: true },
  });

  await prisma.order.create({
    data: {
      id: FIXTURE_ORDER_ID,
      customerId: customer.id,
      status: "shipped",
      createdAt: new Date("2026-05-01T06:00:00Z"),
      paymentType: "partial_cod",
      subtotal: new Prisma.Decimal(4261),
      shippingFee: new Prisma.Decimal(60),
      total: new Prisma.Decimal(4321),
      totalCost: new Prisma.Decimal("1234.56"),
      amountPrepaid: new Prisma.Decimal(2101),
      amountDue: new Prisma.Decimal(2220),
      cashfreeOrderId: leakableValue("the Cashfree order id"),
      cashfreePaymentStatus: "PAID",
      utmSource: leakableValue("the campaign that won the customer"),
      shippingAddress: FIXTURE_SHIPPING_ADDRESS,
      lineItems: {
        create: [
          {
            productId: "P010",
            productName: leakableValue("the product that was bought"),
            productImage: "/images/products/P010-1.jpg",
            selectedOptions: { Letter: leakableValue("the recorded option") },
            quantity: 1,
            unitPrice: new Prisma.Decimal(4261),
            unitCost: new Prisma.Decimal("1234.56"),
          },
        ],
      },
      statusHistory: {
        create: [
          {
            status: "placed",
            changedAt: new Date("2026-05-01T06:00:00Z"),
            changedBy: leakableValue("the operator who moved the order"),
            reason: null,
          },
          /**
           * An address correction: a row holding the order's *unchanged* status, written only
           * so the reason beside it is on the record. It is the single most leak-prone row in
           * the table — it exists for its reason and for nothing else — which is why the
           * fixture carries one.
           */
          {
            status: "placed",
            changedAt: new Date("2026-05-01T09:00:00Z"),
            changedBy: leakableValue("the operator who moved the order"),
            reason: leakableValue("the reason typed beside an address correction"),
          },
          {
            status: "packed",
            changedAt: new Date("2026-05-02T06:00:00Z"),
            changedBy: leakableValue("the operator who moved the order"),
            reason: null,
          },
          {
            status: "shipped",
            changedAt: new Date("2026-05-03T06:00:00Z"),
            changedBy: leakableValue("the operator who moved the order"),
            reason: leakableValue("the reason typed beside a status change"),
          },
        ],
      },
    },
  });
}

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    unavailableReason = `no database at DATABASE_URL (${firstLineOf(error)}) — ${START_POSTGRES_HINT}`;
    return;
  }

  await removeFixture();
  await createFixture();
});

afterAll(async () => {
  await removeFixture();
  await prisma.$disconnect();
});

let lookupCounter = 0;

/**
 * A fresh client address per render, so the eight-a-minute limit of
 * `lib/tracking-lookup-limit.ts` — which this file is not testing and must not trip over —
 * counts each render into its own bucket.
 */
function renderTrackPage(submittedOrderId: string): Promise<string> {
  lookupCounter += 1;
  requestHeaderState.forwardedFor = `198.51.100.${lookupCounter}`;

  return import("@/app/(storefront)/track/page").then(async ({ default: TrackOrderPage }) => {
    const page = await TrackOrderPage({
      searchParams: { [TRACK_ORDER_QUERY_PARAM]: submittedOrderId },
    });
    return renderToStaticMarkup(page);
  });
}

const SHIPPED_HEADLINE = "On its way to you";

describe("the fixture order, as the database actually holds it", () => {
  it("carries every value the page is then asked not to show", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: FIXTURE_ORDER_ID },
      select: {
        paymentType: true,
        subtotal: true,
        total: true,
        totalCost: true,
        amountPrepaid: true,
        amountDue: true,
        cashfreeOrderId: true,
        utmSource: true,
        shippingAddress: true,
        customer: {
          select: { phone: true, name: true, email: true, firstUtmSource: true },
        },
        lineItems: { select: { productName: true, selectedOptions: true, unitCost: true } },
        statusHistory: { select: { changedBy: true, reason: true } },
      },
    });

    expect(stored.paymentType).toBe("partial_cod");
    expect(stored.customer.phone).toBe(FIXTURE_CUSTOMER_PHONE);
    expect(stored.shippingAddress).toEqual(FIXTURE_SHIPPING_ADDRESS);
    expect(stored.lineItems[0].productName).toBe(leakableValue("the product that was bought"));
    expect(stored.statusHistory.map((event) => event.changedBy)).toEqual(
      Array(4).fill(leakableValue("the operator who moved the order")),
    );
    expect(stored.statusHistory.map((event) => event.reason).filter(Boolean)).toEqual([
      leakableValue("the reason typed beside an address correction"),
      leakableValue("the reason typed beside a status change"),
    ]);

    /**
     * The control that makes every `not.toContain` below a real absence rather than a broken
     * search: the same haystack function, over the row itself, finds all twenty values.
     */
    const storedAsText = JSON.stringify(stored);
    for (const [label, value] of Object.entries(EVERY_FIXTURE_VALUE)) {
      expect(storedAsText, `${label} is missing from the fixture row`).toContain(value);
    }
  });
});

describe("what /track renders for a real order", () => {
  it("renders that order rather than the not-found message", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const html = await renderTrackPage(FIXTURE_ORDER_ID);

    expect(html).toContain(SHIPPED_HEADLINE);
    expect(html).not.toContain(ORDER_NOT_FOUND_MESSAGE);
    expect(html).toContain("Order placed");
    expect(html).toContain("Packed");
    expect(html).toContain("1 May 2026");
    expect(html).toContain("3 May 2026");
  });

  it("puts none of the withheld values anywhere in the HTML", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const html = await renderTrackPage(FIXTURE_ORDER_ID);

    expect(html).toContain(SHIPPED_HEADLINE);

    for (const [label, value] of Object.entries(WITHHELD_VALUES)) {
      expect(html, `${label} reached the rendered page`).not.toContain(value);
    }
  });

  /**
   * The half of the contract that is now positive. Without it, deleting the items panel would
   * leave every remaining assertion in this file green.
   */
  it("shows what was bought, what was chosen, and what is paid and owed", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const html = await renderTrackPage(FIXTURE_ORDER_ID);

    expect(html).toContain(leakableValue("the product that was bought"));
    expect(html).toContain(leakableValue("the recorded option"));
    expect(html).toContain("₹4,321");
    expect(html).toContain("₹2,101");
    expect(html).toContain("₹2,220");
  });

  /**
   * The address is the one field ADR-071 was explicitly refused. Asserted on its own, so a
   * future change that widens the query cannot bury it in a loop over a list somebody edited.
   */
  it("still shows no delivery address, on a page that shows the order's contents", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const html = await renderTrackPage(FIXTURE_ORDER_ID);

    expect(html).toContain(leakableValue("the product that was bought"));
    for (const label of [
      "the first line of the shipping address",
      "the second line of the shipping address",
      "the city",
      "the pincode",
      "the customer's name",
      "the customer's phone number",
    ] as const) {
      expect(html, `${label} reached a page that asks only for an order number`).not.toContain(
        WITHHELD_VALUES[label],
      );
    }
  });

  it("renders each step's date and its clock time, not the date alone", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const html = await renderTrackPage(FIXTURE_ORDER_ID);

    expect(html).toContain("1 May 2026, 11:30 am");
    expect(html).toContain("2 May 2026, 11:30 am");
    expect(html).toContain("3 May 2026, 11:30 am");
  });

  it("puts none of them in the props the page hands its components either", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const tracking = await findPublicOrderTracking(FIXTURE_ORDER_ID);
    expect(tracking).not.toBeNull();

    const trackingAsText = JSON.stringify(tracking);
    for (const [label, value] of Object.entries(WITHHELD_VALUES)) {
      expect(trackingAsText, `${label} reached the page's data`).not.toContain(value);
    }

    expect(Object.keys(tracking ?? {}).sort()).toEqual([
      "history",
      "id",
      "items",
      "payment",
      "placedAt",
      "refund",
      "status",
    ]);

    for (const event of tracking?.history ?? []) {
      expect(Object.keys(event).sort()).toEqual(["changedAt", "status"]);
    }

    /**
     * A line carries no `unitPrice` and no `unitCost`, and no `productId`. The key list is
     * asserted rather than the absences, so a column added to the select fails here instead of
     * arriving unnoticed.
     */
    for (const item of tracking?.items ?? []) {
      expect(Object.keys(item).sort()).toEqual([
        "id",
        "productImage",
        "productName",
        "quantity",
        "selectedOptions",
      ]);
    }

    expect(Object.keys(tracking?.payment ?? {}).sort()).toEqual(["due", "paid", "total"]);
  });

  it("shows the address correction's date without showing what it said", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const tracking = await findPublicOrderTracking(FIXTURE_ORDER_ID);

    expect(tracking?.history.map((event) => event.status)).toEqual([
      "placed",
      "packed",
      "shipped",
    ]);
    expect(tracking?.history[0].changedAt.toISOString()).toBe("2026-05-01T06:00:00.000Z");
  });
});

describe("an order number typed in the wrong case", () => {
  it("finds the same order lowercased as it does exactly", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const exact = await findPublicOrderTracking(FIXTURE_ORDER_ID);
    const lowercased = await findPublicOrderTracking(FIXTURE_ORDER_ID.toLowerCase());

    expect(exact).not.toBeNull();
    expect(lowercased).toEqual(exact);
    expect(lowercased?.id).toBe(FIXTURE_ORDER_ID);
  });

  it("survives mixed case and stray spaces around it", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const exact = await findPublicOrderTracking(FIXTURE_ORDER_ID);

    expect(await findPublicOrderTracking("  trackPRV23  ")).toEqual(exact);
    expect(await findPublicOrderTracking("TrAcKpRv23")).toEqual(exact);
  });

  it("renders the same order page for both spellings", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    const exactHtml = await renderTrackPage(FIXTURE_ORDER_ID);
    const lowercasedHtml = await renderTrackPage(FIXTURE_ORDER_ID.toLowerCase());

    for (const html of [exactHtml, lowercasedHtml]) {
      expect(html).toContain(SHIPPED_HEADLINE);
      expect(html).not.toContain(ORDER_NOT_FOUND_MESSAGE);
    }

    /**
     * The two pages differ in one place and one place only: the box keeps what was typed, so a
     * lookup that failed can be corrected without retyping it. Everything after the form is
     * byte-identical.
     */
    expect(lowercasedHtml.replace(FIXTURE_ORDER_ID.toLowerCase(), FIXTURE_ORDER_ID)).toBe(
      exactHtml,
    );
  });

  it("still finds nothing for a number nobody was given", async (ctx) => {
    ctx.skip(unavailableReason !== null, unavailableReason ?? undefined);

    expect(await findPublicOrderTracking("TRACKPRV24")).toBeNull();
    expect(await findPublicOrderTracking("trackprv24")).toBeNull();

    const html = await renderTrackPage("trackprv24");

    expect(html).toContain(ORDER_NOT_FOUND_MESSAGE);
    expect(html).not.toContain(SHIPPED_HEADLINE);
  });
});
