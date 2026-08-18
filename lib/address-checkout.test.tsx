/** @vitest-environment jsdom */

import { renderToString } from "react-dom/server";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartItem } from "@/types/cart";
import type { CatalogueEntry } from "@/types/product";
import { CART_STORAGE_KEY } from "@/lib/cart";
import { CartProvider } from "@/lib/cart-context";
import { CHECKOUT_STORAGE_KEY, parseCheckoutData } from "@/lib/checkout";
import { AddressCheckout } from "@/components/AddressCheckout";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...anchorProps
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...anchorProps}>
      {children}
    </a>
  ),
}));

const NECKLACE: CatalogueEntry = {
  id: "nk-001",
  name: "Kundan Rani Haar",
  price: 1000,
  mrp: 1500,
  image: "/products/nk-001.webp",
  inStock: true,
};

const SOLD_OUT_RING: CatalogueEntry = {
  id: "rg-001",
  name: "Temple Gold Ring",
  price: 700,
  mrp: 900,
  image: "/products/rg-001.webp",
  inStock: false,
};

const CATALOGUE: CatalogueEntry[] = [NECKLACE, SOLD_OUT_RING];

const VALID_INPUT = {
  "Full name": "Ananya Iyer",
  "Mobile number": "9876543210",
  Email: "ananya@example.com",
  "Flat, house, building": "12 Rosewood Apartments",
  "City or town": "Mumbai",
  "PIN code": "400050",
};

function AddressPage(): JSX.Element {
  return (
    <CartProvider catalogue={CATALOGUE}>
      <AddressCheckout />
    </CartProvider>
  );
}

function seedCart(items: Partial<CartItem>[]): void {
  window.localStorage.setItem(
    CART_STORAGE_KEY,
    JSON.stringify(
      items.map((item) => ({
        productId: "nk-001",
        name: "snapshot",
        price: 1,
        image: "",
        qty: 1,
        ...item,
      })),
    ),
  );
}

interface HydrationOutcome {
  consoleError: ReturnType<typeof vi.spyOn>;
  serverHtml: string;
}

async function hydratePage(): Promise<HydrationOutcome> {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const serverHtml = renderToString(<AddressPage />);
  const container = document.createElement("div");
  container.innerHTML = serverHtml;
  document.body.appendChild(container);

  await act(async () => {
    render(<AddressPage />, { container, hydrate: true });
  });

  return { consoleError, serverHtml };
}

function fillValidForm(): void {
  for (const [label, value] of Object.entries(VALID_INPUT)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  fireEvent.change(screen.getByLabelText("State"), {
    target: { value: "Maharashtra" },
  });
}

function readStoredBundle(): ReturnType<typeof parseCheckoutData> {
  return parseCheckoutData(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY));
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  pushMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the empty-cart guard", () => {
  it("shows the loading notice on the server, never the guard or the form", () => {
    const serverHtml = renderToString(<AddressPage />);

    expect(serverHtml).toContain("Loading your order");
    expect(serverHtml).not.toContain("There is nothing to check out");
    expect(serverHtml).not.toContain("Delivery details");
  });

  it("hydrates an empty cart into the guard with no mismatch warning", async () => {
    const { consoleError } = await hydratePage();

    expect(consoleError).not.toHaveBeenCalled();
    expect(screen.getByText("There is nothing to check out")).toBeDefined();
    expect(screen.queryByLabelText("Full name")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Back to cart" }).getAttribute("href"),
    ).toBe("/cart");
  });

  it("hydrates a populated cart straight into the form, never flashing the guard", async () => {
    seedCart([{ productId: "nk-001", qty: 2 }]);

    const { consoleError, serverHtml } = await hydratePage();

    expect(consoleError).not.toHaveBeenCalled();
    expect(serverHtml).not.toContain("There is nothing to check out");
    expect(screen.queryByText("There is nothing to check out")).toBeNull();
    expect(screen.getByLabelText("Full name")).toBeDefined();
    expect(screen.getByText("₹2,099")).toBeDefined();
  });

  it("blocks checkout when a line has sold out", async () => {
    seedCart([
      { productId: "nk-001", qty: 1 },
      { productId: "rg-001", qty: 1 },
    ]);

    await hydratePage();

    expect(screen.getByText("One piece is no longer available")).toBeDefined();
    expect(screen.queryByLabelText("Full name")).toBeNull();
  });

  it("blocks checkout when every line has sold out", async () => {
    seedCart([{ productId: "rg-001", qty: 1 }]);

    await hydratePage();

    expect(screen.getByText("One piece is no longer available")).toBeDefined();
  });
});

describe("the form", () => {
  beforeEach(() => {
    seedCart([{ productId: "nk-001", qty: 2 }]);
  });

  it("renders every field with its accessible name", async () => {
    await hydratePage();

    for (const label of Object.keys(VALID_INPUT)) {
      expect(screen.getByLabelText(label), label).toBeDefined();
    }
    expect(screen.getByLabelText("State")).toBeDefined();
    expect(screen.getByLabelText(/Area, street, landmark/)).toBeDefined();
  });

  it("offers all 36 states plus a placeholder", async () => {
    await hydratePage();

    const stateSelect = screen.getByLabelText("State") as HTMLSelectElement;
    expect(stateSelect.options).toHaveLength(37);
    expect(stateSelect.options[0].value).toBe("");
  });

  it("validates on blur and clears the error as it is fixed", async () => {
    await hydratePage();
    const phoneInput = screen.getByLabelText("Mobile number");

    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: "12345" } });
      fireEvent.blur(phoneInput);
    });

    expect(screen.getByText("Enter a 10-digit mobile number")).toBeDefined();
    expect(phoneInput.getAttribute("aria-invalid")).toBe("true");
    expect(phoneInput.getAttribute("aria-describedby")).toBe(
      "address-phone-error",
    );

    await act(async () => {
      fireEvent.change(phoneInput, { target: { value: "9876543210" } });
    });

    expect(screen.queryByText("Enter a 10-digit mobile number")).toBeNull();
    expect(phoneInput.getAttribute("aria-invalid")).toBe("false");
  });

  it("does not flag an untouched field while it is being typed", async () => {
    await hydratePage();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a" } });
    });

    expect(screen.queryByText("Enter a valid email address")).toBeNull();
  });

  it("reports every problem on submit and focuses the first one", async () => {
    await hydratePage();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    });

    expect(screen.getByText("Enter a name")).toBeDefined();
    expect(screen.getByText("Enter a mobile number")).toBeDefined();
    expect(screen.getByText("Select a state from the list")).toBeDefined();
    expect(screen.getByText("Enter a 6-digit PIN code")).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText("Full name"));
  });

  it("does not navigate or store anything on a failed submit", async () => {
    await hydratePage();
    fillValidForm();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("PIN code"), {
        target: { value: "040050" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    });

    expect(screen.getByText("A PIN code does not start with 0")).toBeDefined();
    expect(pushMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(CHECKOUT_STORAGE_KEY)).toBeNull();
  });

  it("focuses the topmost invalid field, not the last one edited", async () => {
    await hydratePage();
    fillValidForm();

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nope" } });
      fireEvent.change(screen.getByLabelText("PIN code"), { target: { value: "1" } });
      fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    });

    expect(document.activeElement).toBe(screen.getByLabelText("Email"));
  });
});

describe("handing off to /payment", () => {
  beforeEach(() => {
    seedCart([{ productId: "nk-001", qty: 2 }]);
  });

  it("writes the bundle and navigates on a valid submit", async () => {
    await hydratePage();
    fillValidForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    });

    expect(pushMock).toHaveBeenCalledWith("/payment");
    expect(readStoredBundle()).toEqual({
      cart: [
        {
          productId: "nk-001",
          name: "Kundan Rani Haar",
          price: 1000,
          image: "/products/nk-001.webp",
          qty: 2,
        },
      ],
      address: {
        name: "Ananya Iyer",
        phone: "9876543210",
        email: "ananya@example.com",
        line1: "12 Rosewood Apartments",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400050",
      },
      subtotal: 2000,
      shipping: 99,
      total: 2099,
    });
  });

  it("still navigates when sessionStorage refuses to write", async () => {
    await hydratePage();
    fillValidForm();

    vi.spyOn(window.sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }));
    });

    expect(pushMock).toHaveBeenCalledWith("/payment");
  });

  it("repopulates the form from a bundle left by an earlier visit", async () => {
    window.sessionStorage.setItem(
      CHECKOUT_STORAGE_KEY,
      JSON.stringify({
        cart: [
          {
            productId: "nk-001",
            name: "Kundan Rani Haar",
            price: 1000,
            image: "/products/nk-001.webp",
            qty: 2,
          },
        ],
        address: {
          name: "Ananya Iyer",
          phone: "9876543210",
          email: "ananya@example.com",
          line1: "12 Rosewood Apartments",
          line2: "Off Turner Road",
          city: "Mumbai",
          state: "Maharashtra",
          pincode: "400050",
        },
        subtotal: 2000,
        shipping: 99,
        total: 2099,
      }),
    );

    await hydratePage();

    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe(
      "Ananya Iyer",
    );
    expect((screen.getByLabelText("State") as HTMLSelectElement).value).toBe(
      "Maharashtra",
    );
    expect(
      (screen.getByLabelText(/Area, street, landmark/) as HTMLInputElement).value,
    ).toBe("Off Turner Road");
  });

  it("ignores a corrupt stored bundle and starts the form empty", async () => {
    window.sessionStorage.setItem(CHECKOUT_STORAGE_KEY, "{not json");

    await hydratePage();

    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("");
  });
});
