import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * ADR-042 writes `amountPrepaid` the moment Cashfree mints a session, before the customer has
 * paid anything — so the raw figure names a payment TYPE, not money already collected. These
 * tests hold the Money panel to the one thing it must never do with that figure: present it as
 * a receipt while Cashfree's own status still says the payment did not go through.
 */

function decimal(value: number): { toNumber: () => number } {
  return { toNumber: () => value };
}

const ORDER_ID = "W2ACEHACUU";

function orderRow(
  paymentType: string,
  cashfreePaymentStatus: string,
  amountPrepaid: number,
): Record<string, unknown> {
  return {
    id: ORDER_ID,
    createdAt: new Date("2026-08-01T10:00:00Z"),
    updatedAt: new Date("2026-08-01T10:00:00Z"),
    status: "placed",
    paymentType,
    subtotal: decimal(450),
    shippingFee: decimal(99),
    total: decimal(526),
    amountPrepaid: decimal(amountPrepaid),
    amountDue: decimal(0),
    codAmountCollected: false,
    codCollectedAt: null,
    itemReceivedBack: false,
    itemReceivedBackAt: null,
    isRefunded: false,
    refundedAt: null,
    refundAmount: null,
    cashfreeOrderId: "CF_ORDER_123",
    cashfreePaymentStatus,
    shippingAddress: {
      name: "Ananya Iyer",
      phone: "9812300011",
      email: "ananya@example.com",
      line1: "12 Rose Villa",
      line2: "",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400050",
    },
    customer: { name: "Ananya Iyer", phone: "9812300011", email: "ananya@example.com" },
    lineItems: [
      {
        id: "line-1",
        productId: "P002",
        productName: "Teardrop Glass Locket Necklace",
        productImage: "/images/p002.jpg",
        selectedOptions: {},
        quantity: 1,
        unitPrice: decimal(450),
      },
    ],
    statusHistory: [
      {
        id: "evt-1",
        status: "placed",
        changedAt: new Date("2026-08-01T10:00:00Z"),
        changedBy: "system",
        reason: null,
      },
    ],
  };
}

let findUniqueResult: Record<string, unknown> | null = null;

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findUnique: () => Promise.resolve(findUniqueResult),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: () => ({
    get: (name: string) => (name.toLowerCase() === "host" ? "localhost:3000" : null),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  redirect: () => {},
  notFound: () => {
    throw new Error("unexpected notFound() in Money panel test");
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

async function renderOrderDetail(): Promise<string> {
  const { default: AdminOrderDetailPage } = await import(
    "@/app/admin/(protected)/orders/[id]/page"
  );
  return renderToStaticMarkup(await AdminOrderDetailPage({ params: { id: ORDER_ID } }));
}

describe("the Money panel's Prepaid figure", () => {
  it("never reads as a received payment while Cashfree still says PENDING", async () => {
    findUniqueResult = orderRow("prepaid", "PENDING", 431);

    const html = await renderOrderDetail();

    expect(html).toContain("Awaiting payment confirmation");
    expect(html).not.toContain("₹431");
    expect(html).not.toContain("Payment received");
  });

  it("never reads as a received payment while Cashfree says FAILED", async () => {
    findUniqueResult = orderRow("prepaid", "FAILED", 431);

    const html = await renderOrderDetail();

    expect(html).toContain("Awaiting payment confirmation");
    expect(html).not.toContain("₹431");
  });

  it("shows the rupee figure once Cashfree confirms PAID", async () => {
    findUniqueResult = orderRow("prepaid", "PAID", 431);

    const html = await renderOrderDetail();

    expect(html).toContain("₹431");
    expect(html).not.toContain("Awaiting payment confirmation");
  });

  it("is unaffected on a COD order, which never had a prepayment to confirm", async () => {
    findUniqueResult = orderRow("cod", "NOT_APPLICABLE", 0);

    const html = await renderOrderDetail();

    expect(html).not.toContain("Awaiting payment confirmation");
  });
});
