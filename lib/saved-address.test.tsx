/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, CartItem } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CHECKOUT_STORAGE_KEY, buildCheckoutData } from "@/lib/checkout";
import { EMPTY_ADDRESS_FORM } from "@/lib/address";
import {
  SAVED_ADDRESS_STORAGE_KEY,
  clearSavedAddress,
  parseSavedAddress,
  readSavedAddress,
  saveAddressForNextTime,
} from "@/lib/saved-address";
import { AddressCheckout } from "@/components/AddressCheckout";
import { CartProvider } from "@/lib/cart-context";
import { CART_STORAGE_KEY, buildCartLines } from "@/lib/cart";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const LAST_ORDER_ADDRESS: Address = {
  name: "Ananya Iyer",
  phone: "9812300011",
  email: "ananya@example.com",
  line1: "12 Rose Villa",
  line2: "Bandra West",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
};

const IN_PROGRESS_ADDRESS: Address = {
  ...LAST_ORDER_ADDRESS,
  name: "Rohit Malhotra",
  line1: "8 Cubbon Road",
  city: "Bengaluru",
  state: "Karnataka",
  pincode: "560001",
};

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  category: "necklaces",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const CATALOGUE: CatalogueEntry[] = [NECKLACE];

function seedCart(): void {
  const line: CartItem = {
    productId: NECKLACE.id,
    name: NECKLACE.name,
    price: NECKLACE.price,
    image: NECKLACE.image ?? "",
    qty: 1,
  };
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([line]));
}

function renderAddressStep() {
  return render(
    <CartProvider catalogue={CATALOGUE}>
      <AddressCheckout codCatalogue={[]} />
    </CartProvider>,
  );
}

function fieldValue(label: RegExp): string {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
}

async function waitForFormReady(): Promise<void> {
  await waitFor(() => expect(screen.getByLabelText(/full name/i)).toBeTruthy());
}

beforeEach(() => {
  push.mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe("what is written to localStorage", () => {
  it("stores exactly the eight fields the form collects, and nothing else", () => {
    expect(saveAddressForNextTime(LAST_ORDER_ADDRESS)).toBe(true);

    const stored = JSON.parse(
      window.localStorage.getItem(SAVED_ADDRESS_STORAGE_KEY) ?? "null",
    );

    expect(Object.keys(stored).sort()).toEqual(Object.keys(EMPTY_ADDRESS_FORM).sort());
    expect(stored).toEqual(LAST_ORDER_ADDRESS);
  });

  it("carries no order, no amount and no identifier", () => {
    saveAddressForNextTime(LAST_ORDER_ADDRESS);
    const raw = window.localStorage.getItem(SAVED_ADDRESS_STORAGE_KEY) ?? "";

    for (const forbidden of ["orderId", "trackingId", "cart", "total", "subtotal", "MG_"]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  it("survives a round trip, and reads back as null once cleared", () => {
    saveAddressForNextTime(LAST_ORDER_ADDRESS);
    expect(readSavedAddress()).toEqual({ ...LAST_ORDER_ADDRESS });

    clearSavedAddress();
    expect(readSavedAddress()).toBeNull();
    expect(window.localStorage.getItem(SAVED_ADDRESS_STORAGE_KEY)).toBeNull();
  });

  it("does not throw when storage refuses the write", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    expect(saveAddressForNextTime(LAST_ORDER_ADDRESS)).toBe(false);
    setItem.mockRestore();
  });
});

describe("reading back something that is not an address", () => {
  it("refuses a malformed record rather than half-filling the form", () => {
    expect(parseSavedAddress(null)).toBeNull();
    expect(parseSavedAddress("not json")).toBeNull();
    expect(parseSavedAddress("[]")).toBeNull();
    expect(parseSavedAddress('"a string"')).toBeNull();
    expect(parseSavedAddress(JSON.stringify({ name: "Ananya Iyer" }))).toBeNull();
    expect(
      parseSavedAddress(JSON.stringify({ ...LAST_ORDER_ADDRESS, pincode: 400050 })),
    ).toBeNull();
    expect(
      parseSavedAddress(JSON.stringify({ ...LAST_ORDER_ADDRESS, line1: "x".repeat(201) })),
    ).toBeNull();
  });

  it("blanks an unrecognised state and keeps the rest", () => {
    const restored = parseSavedAddress(
      JSON.stringify({ ...LAST_ORDER_ADDRESS, state: "Atlantis" }),
    );

    expect(restored).not.toBeNull();
    expect(restored?.state).toBe("");
    expect(restored?.city).toBe("Mumbai");
    expect(restored?.pincode).toBe("400050");
  });

  it("accepts an address whose optional second line is empty", () => {
    expect(parseSavedAddress(JSON.stringify({ ...LAST_ORDER_ADDRESS, line2: "" }))).toEqual({
      ...LAST_ORDER_ADDRESS,
      line2: "",
    });
  });
});

describe("the address step for a first-time visitor", () => {
  it("shows an empty form and no mention of a saved address", async () => {
    seedCart();
    renderAddressStep();
    await waitForFormReady();

    expect(fieldValue(/full name/i)).toBe("");
    expect(fieldValue(/pin code/i)).toBe("");
    expect(screen.queryByText(/filled in from your last order/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /use a different address/i })).toBeNull();
  });
});

describe("the address step for a returning shopper", () => {
  it("pre-fills from the last completed order and says so", async () => {
    seedCart();
    saveAddressForNextTime(LAST_ORDER_ADDRESS);
    renderAddressStep();
    await waitForFormReady();

    expect(fieldValue(/full name/i)).toBe("Ananya Iyer");
    expect(fieldValue(/pin code/i)).toBe("400050");
    expect(screen.getByText(/filled in from your last order/i)).toBeTruthy();
  });

  it("does not write back to storage while the pre-filled form is edited", async () => {
    seedCart();
    saveAddressForNextTime(LAST_ORDER_ADDRESS);
    renderAddressStep();
    await waitForFormReady();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Someone Else Entirely" },
    });
    fireEvent.change(screen.getByLabelText(/pin code/i), { target: { value: "110001" } });
    fireEvent.blur(screen.getByLabelText(/pin code/i));

    expect(fieldValue(/full name/i)).toBe("Someone Else Entirely");
    expect(readSavedAddress()).toEqual({ ...LAST_ORDER_ADDRESS });
  });

  it("never submits on the shopper's behalf", async () => {
    seedCart();
    saveAddressForNextTime(LAST_ORDER_ADDRESS);
    renderAddressStep();
    await waitForFormReady();

    expect(push).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY)).toBeNull();
  });

  it("empties the form and forgets the address when asked to", async () => {
    seedCart();
    saveAddressForNextTime(LAST_ORDER_ADDRESS);
    renderAddressStep();
    await waitForFormReady();

    fireEvent.click(screen.getByRole("button", { name: /use a different address/i }));

    await waitFor(() => expect(fieldValue(/full name/i)).toBe(""));
    expect(fieldValue(/pin code/i)).toBe("");
    expect(fieldValue(/city or town/i)).toBe("");
    expect(readSavedAddress()).toBeNull();
    expect(screen.queryByText(/filled in from your last order/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /use a different address/i })).toBeNull();
  });

  /**
   * A shopper who reached `/payment` and pressed back is mid-checkout, and that address is a
   * more recent statement of intent than the one their last order went to.
   */
  it("prefers an in-progress checkout over the last order's address", async () => {
    seedCart();
    saveAddressForNextTime(LAST_ORDER_ADDRESS);
    window.sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify(
        buildCheckoutData(
          buildCartLines(
            [
              {
                productId: NECKLACE.id,
                name: NECKLACE.name,
                price: NECKLACE.price,
                image: NECKLACE.image ?? "",
                qty: 1,
              },
            ],
            CATALOGUE,
          ),
          IN_PROGRESS_ADDRESS,
        ),
      ),
    );

    renderAddressStep();
    await waitForFormReady();

    expect(fieldValue(/full name/i)).toBe("Rohit Malhotra");
    expect(fieldValue(/pin code/i)).toBe("560001");
    expect(screen.queryByText(/filled in from your last order/i)).toBeNull();
  });
});
