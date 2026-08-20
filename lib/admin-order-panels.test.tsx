/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressFormValues } from "@/lib/address";
import { AdminOrderAddressPanel } from "@/components/AdminOrderAddressPanel";
import { AdminOrderReceiptToggles } from "@/components/AdminOrderReceiptToggles";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const ADDRESS: AddressFormValues = {
  name: "Ananya Iyer",
  phone: "9812300011",
  email: "ananya@example.com",
  line1: "12 Rose Villa",
  line2: "Bandra West",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
};

const ADDRESS_HREF = "/admin/api/orders/W2ACEHACUU/address";
const RECEIPT_HREF = "/admin/api/orders/W2ACEHACUU/receipt";
const LOCKED_NOTE = "The parcel has left, so this address is now a record.";

function fetchCalls(): [string, RequestInit][] {
  return (fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls;
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

describe("the shipping address panel", () => {
  it("offers an edit while the parcel has not left", () => {
    render(
      <AdminOrderAddressPanel
        actionHref={ADDRESS_HREF}
        address={ADDRESS}
        isEditable
        lockedNote={LOCKED_NOTE}
      />,
    );

    expect(screen.getByText("12 Rose Villa")).toBeTruthy();
    expect(screen.getByRole("button", { name: /edit address/i })).toBeTruthy();
    expect(screen.queryByText(LOCKED_NOTE)).toBeNull();
  });

  /**
   * Read-only rather than disabled. A greyed-out button invites an operator to hunt for the
   * reason it is greyed out, and the sentence that replaces it is that reason.
   */
  it("renders as plain text once the parcel has left, with no control to press", () => {
    render(
      <AdminOrderAddressPanel
        actionHref={ADDRESS_HREF}
        address={ADDRESS}
        isEditable={false}
        lockedNote={LOCKED_NOTE}
      />,
    );

    expect(screen.getByText("12 Rose Villa")).toBeTruthy();
    expect(screen.getByText(LOCKED_NOTE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit address/i })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens the checkout address form, prefilled, and posts a correction", async () => {
    render(
      <AdminOrderAddressPanel
        actionHref={ADDRESS_HREF}
        address={ADDRESS}
        isEditable
        lockedNote={LOCKED_NOTE}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit address/i }));

    const pincode = screen.getByLabelText(/PIN code/i);
    expect(pincode).toHaveProperty("value", "400050");

    fireEvent.change(pincode, { target: { value: "400052" } });
    fireEvent.click(screen.getByRole("button", { name: /save corrected address/i }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    const [href, init] = fetchCalls()[0];
    expect(href).toBe(ADDRESS_HREF);
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: "Ananya Iyer",
      pincode: "400052",
      line2: "Bandra West",
    });
  });

  it("refuses to post an address the storefront's own validator rejects", async () => {
    render(
      <AdminOrderAddressPanel
        actionHref={ADDRESS_HREF}
        address={ADDRESS}
        isEditable
        lockedNote={LOCKED_NOTE}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edit address/i }));
    fireEvent.change(screen.getByLabelText(/PIN code/i), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: /save corrected address/i }));

    await waitFor(() => {
      expect(screen.getByText(/A PIN code does not start with 0/)).toBeTruthy();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("the receipt toggles", () => {
  function renderToggles(itemOn: boolean, codOn: boolean): void {
    render(
      <AdminOrderReceiptToggles
        actionHref={RECEIPT_HREF}
        toggles={[
          {
            field: "itemReceivedBack",
            label: "Item received back",
            description: "Tick this when the parcel is back on the shelf.",
            isOn: itemOn,
            recordedAt: itemOn ? "20 Aug 2026, 04:03 pm" : null,
          },
          {
            field: "codAmountCollected",
            label: "COD amount collected",
            description: "Tick this when the cash has been remitted.",
            isOn: codOn,
            recordedAt: codOn ? "20 Aug 2026, 04:05 pm" : null,
          },
        ]}
      />,
    );
  }

  it("sends only the field that was toggled, so neither can clear the other", async () => {
    renderToggles(false, true);

    fireEvent.click(screen.getByRole("checkbox", { name: /item received back/i }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    const [href, init] = fetchCalls()[0];
    expect(href).toBe(RECEIPT_HREF);
    expect(JSON.parse(String(init.body))).toEqual({ itemReceivedBack: true });
  });

  it("sends false when a flag is unticked", async () => {
    renderToggles(false, true);

    fireEvent.click(screen.getByRole("checkbox", { name: /COD amount collected/i }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    expect(JSON.parse(String(fetchCalls()[0][1].body))).toEqual({ codAmountCollected: false });
  });

  it("shows when each flag was recorded rather than only that it was", () => {
    renderToggles(true, false);

    expect(screen.getByText(/Recorded 20 Aug 2026, 04:03 pm/)).toBeTruthy();
    expect(screen.getByText(/Tick this when the cash has been remitted/)).toBeTruthy();
  });

  it("surfaces the server's refusal without pretending the flag moved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              status: "REJECTED",
              error: "NO_COD_TO_COLLECT",
              message: "This order was paid up front, so there is no cash to collect on delivery.",
            }),
            { status: 422 },
          ),
      ),
    );

    renderToggles(false, false);
    fireEvent.click(screen.getByRole("checkbox", { name: /COD amount collected/i }));

    await waitFor(() => {
      expect(screen.getByText(/no cash to collect on delivery/)).toBeTruthy();
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
