/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderStatus, PaymentType } from "@prisma/client";
import { AdminOrderStatusForm } from "@/components/AdminOrderStatusForm";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const ACTION_HREF = "/admin/api/orders/W2ACEHACUU/status";

function renderForm(
  currentStatus: OrderStatus,
  paymentType: PaymentType = "prepaid",
  amountPrepaid = 1200,
): void {
  render(
    <AdminOrderStatusForm
      actionHref={ACTION_HREF}
      currentStatus={currentStatus}
      paymentType={paymentType}
      amountPrepaid={amountPrepaid}
    />,
  );
}

function offeredStatuses(): string[] {
  return Array.from(screen.getByRole("combobox").querySelectorAll("option"))
    .map((option) => option.textContent ?? "")
    .filter((label) => label !== "Choose a status");
}

function chooseStatus(status: string): void {
  fireEvent.change(screen.getByRole("combobox"), { target: { value: status } });
}

beforeEach(() => {
  refresh.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ status: "UPDATED" }), { status: 200 })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * The dropdown is a convenience, not the rule — the same validator runs again in the route
 * handler. It is still worth proving, because an operator who is *offered* an impossible move
 * will make it, and the first thing they will believe is that the move was legitimate.
 */
describe("what the status control offers", () => {
  it("offers only the lifecycle's next steps", () => {
    const cases: ReadonlyArray<[OrderStatus, string[]]> = [
      ["placed", ["Packed", "Cancelled"]],
      ["packed", ["Shipped", "Cancelled"]],
      ["shipped", ["Delivered", "RTO", "Cancelled"]],
      ["delivered", ["Returned"]],
    ];

    for (const [status, expected] of cases) {
      renderForm(status);
      expect(offeredStatuses()).toEqual(expected);
      cleanup();
    }
  });

  it("offers cancellation right up to the moment the parcel is delivered", () => {
    for (const status of ["placed", "packed", "shipped"] as const) {
      renderForm(status);
      expect(offeredStatuses()).toContain("Cancelled");
      cleanup();
    }
  });

  it("offers nothing at all on an order that has finished", () => {
    for (const status of ["rto", "returned", "cancelled"] as const) {
      renderForm(status);
      expect(screen.queryByRole("combobox")).toBeNull();
      expect(screen.getByText(/end of its lifecycle/i)).toBeTruthy();
      cleanup();
    }
  });
});

describe("the fields a chosen status brings with it", () => {
  it("asks for nothing extra on an ordinary step", () => {
    renderForm("placed");
    chooseStatus("packed");

    expect(screen.queryByText(/^Reason/)).toBeNull();
    expect(screen.queryByText(/Refund amount/)).toBeNull();
    expect(screen.queryByText(/No refund needed/)).toBeNull();
  });

  it("asks for a reason and an amount on a prepaid cancellation", () => {
    renderForm("placed", "prepaid", 1200);
    chooseStatus("cancelled");

    expect(screen.getByText(/^Reason/)).toBeTruthy();
    expect(screen.getByText(/Refund amount/)).toBeTruthy();
    expect(screen.getByRole("spinbutton")).toHaveProperty("value", "1200");
  });

  it("asks a COD order to confirm rather than to price", () => {
    renderForm("placed", "cod", 0);
    chooseStatus("cancelled");

    expect(screen.getByText(/^Reason/)).toBeTruthy();
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText(/No refund needed/)).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
  });

  it("withdraws the refund block again when the operator changes their mind", () => {
    renderForm("shipped", "prepaid", 1200);

    chooseStatus("rto");
    expect(screen.getByText(/Refund amount/)).toBeTruthy();

    chooseStatus("delivered");
    expect(screen.queryByText(/Refund amount/)).toBeNull();
    expect(screen.queryByText(/^Reason/)).toBeNull();
  });
});

describe("what the form refuses to send", () => {
  it("will not submit an unhappy status with no reason", async () => {
    renderForm("placed", "prepaid", 1200);
    chooseStatus("cancelled");

    fireEvent.click(screen.getByRole("button", { name: /save status change/i }));

    await waitFor(() => {
      expect(screen.getByText(/Say why this order is being marked Cancelled/)).toBeTruthy();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("will not submit a COD cancellation that was never acknowledged", async () => {
    renderForm("placed", "cod", 0);
    chooseStatus("cancelled");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Customer stopped answering" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save status change/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirm that no refund is due/)).toBeTruthy();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the status, the reason and the refund as one request", async () => {
    renderForm("placed", "prepaid", 1200);
    chooseStatus("cancelled");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Customer changed their mind" },
    });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "900" } });

    fireEvent.click(screen.getByRole("button", { name: /save status change/i }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [href, init] = (fetch as unknown as { mock: { calls: [string, RequestInit][] } })
      .mock.calls[0];

    expect(href).toBe(ACTION_HREF);
    expect(JSON.parse(String(init.body))).toEqual({
      status: "cancelled",
      reason: "Customer changed their mind",
      refundAmount: "900",
      refundAcknowledged: false,
    });
  });

  it("shows the server's own refusal when the server refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "REJECTED",
              error: "CONCURRENT_CHANGE",
              message: "This order moved while the page was open. Reload it and try again.",
            }),
            { status: 409 },
          ),
      ),
    );

    renderForm("placed");
    chooseStatus("packed");
    fireEvent.click(screen.getByRole("button", { name: /save status change/i }));

    await waitFor(() => {
      expect(screen.getByText(/This order moved while the page was open/)).toBeTruthy();
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
