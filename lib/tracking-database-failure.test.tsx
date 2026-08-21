import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TRACK_ORDER_QUERY_PARAM } from "@/lib/navigation";
import { ORDER_NOT_FOUND_MESSAGE } from "@/lib/order-tracking-copy";

/**
 * `/track` with Postgres refused, which is the public half of ADR-048.
 *
 * The person on this page is a customer holding an order number, and the only two things they
 * can do about either failure are identical: check the number, or message the shop. So they are
 * told the same sentence for both, the one the page already shows for a number that names
 * nothing, and the reason goes to the log where somebody can act on it. That is the storefront's
 * discipline from ADR-042, applied to a read rather than a write.
 */
const DATABASE_DOWN = new Error("Can't reach database server at localhost:5432");

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: { findUnique: (): Promise<never> => Promise.reject(DATABASE_DOWN) },
  },
}));

const requestHeaderState = vi.hoisted(() => ({ forwardedFor: "203.0.113.90" }));

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

const WELL_FORMED_ORDER_ID = "W2ACEHACUU";

let lookupCounter = 0;
let silencedErrors: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  silencedErrors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => {
  silencedErrors.mockRestore();
});

async function renderTrackPage(submittedOrderId: string): Promise<string> {
  lookupCounter += 1;
  requestHeaderState.forwardedFor = `198.51.100.${lookupCounter}`;

  const { default: TrackOrderPage } = await import("@/app/(storefront)/track/page");

  return renderToStaticMarkup(
    await TrackOrderPage({ searchParams: { [TRACK_ORDER_QUERY_PARAM]: submittedOrderId } }),
  );
}

describe("/track with Postgres unreachable", () => {
  it("renders the page's own not-found copy rather than an error screen", async () => {
    const html = await renderTrackPage(WELL_FORMED_ORDER_ID);

    expect(html).toContain(ORDER_NOT_FOUND_MESSAGE);
  });

  it("still renders the form, so the shopper has something to do next", async () => {
    const html = await renderTrackPage(WELL_FORMED_ORDER_ID);

    expect(html).toContain("Track Your");
    expect(html).toContain(WELL_FORMED_ORDER_ID);
  });

  it("tells the shopper nothing about the database and the log everything", async () => {
    const html = await renderTrackPage(WELL_FORMED_ORDER_ID);

    expect(html).not.toContain("localhost:5432");
    expect(html).not.toContain("Postgres");
    expect(html).not.toContain("prisma");

    const loggedText = silencedErrors.mock.calls.flat().map(String).join(" ");
    expect(loggedText).toContain("[order-tracking]");
    expect(loggedText).toContain(WELL_FORMED_ORDER_ID);
  });

  /**
   * The outage must not become an oracle either. An id that could never name an order is
   * refused before the query, and one that could gets the same sentence back when the query
   * fails, so the failing database has not made the two distinguishable.
   */
  it("answers a malformed number and a well-formed one identically", async () => {
    const malformed = await renderTrackPage("nope");
    const wellFormed = await renderTrackPage(WELL_FORMED_ORDER_ID);

    expect(malformed).toContain(ORDER_NOT_FOUND_MESSAGE);
    expect(wellFormed).toContain(ORDER_NOT_FOUND_MESSAGE);
  });
});
