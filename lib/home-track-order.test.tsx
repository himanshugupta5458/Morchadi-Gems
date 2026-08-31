/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TRACK_ORDER_PATH, TRACK_ORDER_QUERY_PARAM } from "@/lib/navigation";
import { OrderTrackingForm } from "@/components/OrderTrackingForm";
import { CartProvider } from "@/lib/cart-context";
import { ToastProvider } from "@/lib/toast-context";
import { getCatalogueIndex } from "@/lib/products";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

/**
 * The home page's search box reaches for the app router to follow a highlighted suggestion.
 * Nothing in this file is about that, but rendering the page mounts it, and `useRouter` throws
 * outside a router provider.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/**
 * The home page renders product cards, whose add-to-cart button reads both the cart and the
 * toast context, so the two providers `app/(storefront)/layout.tsx` supplies have to be here
 * even though nothing in this file is about either.
 */
async function renderHomePage(): Promise<string> {
  const { default: HomePage } = await import("@/app/(storefront)/page");
  return renderToStaticMarkup(
    <CartProvider catalogue={getCatalogueIndex()}>
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    </CartProvider>,
  );
}

function homePageTrackingForm(): HTMLFormElement {
  const form = document
    .querySelector<HTMLInputElement>(`input[name="${TRACK_ORDER_QUERY_PARAM}"]`)
    ?.closest("form");

  if (form === null || form === undefined) throw new Error("No tracking form on the home page");
  return form;
}

/**
 * The point of this file is that there is nothing here to test twice. `OrderTrackingForm` is a
 * plain `GET` form with no props beyond what to put in the box, so the home page mounts the
 * component the tracking page mounts, and the routing it asserts is the browser's own — no
 * `onSubmit`, no `useRouter`, no second copy of the query-parameter name to drift.
 */
describe("the home page's track-order entry point", () => {
  it("mounts the same component the tracking page uses", async () => {
    const homePage = await renderHomePage();

    expect(homePage).toContain(renderToStaticMarkup(<OrderTrackingForm submittedOrderId="" />));
  });

  it("submits to /track with the order number as the query parameter", async () => {
    document.body.innerHTML = await renderHomePage();

    const form = homePageTrackingForm();

    expect(form.getAttribute("method")).toBe("get");
    expect(form.getAttribute("action")).toBe(TRACK_ORDER_PATH);
    expect(TRACK_ORDER_PATH).toBe("/track");
    expect(TRACK_ORDER_QUERY_PARAM).toBe("order_id");
  });

  it("builds /track?order_id=… from what the shopper types", async () => {
    document.body.innerHTML = await renderHomePage();

    const form = homePageTrackingForm();
    const field = form.querySelector<HTMLInputElement>(
      `input[name="${TRACK_ORDER_QUERY_PARAM}"]`,
    );
    if (field === null) throw new Error("The tracking form has no order-number field");

    field.value = "W2ACEHACUU";

    const submitted = new URL(
      `${form.getAttribute("action")}?${new URLSearchParams(new FormData(form) as never)}`,
      "https://www.morchadigems.com",
    );

    expect(submitted.pathname).toBe(TRACK_ORDER_PATH);
    expect(submitted.searchParams.get(TRACK_ORDER_QUERY_PARAM)).toBe("W2ACEHACUU");
    expect(`${submitted.pathname}${submitted.search}`).toBe("/track?order_id=W2ACEHACUU");
  });

  it("starts empty and carries a submit control and a label", async () => {
    render(<OrderTrackingForm submittedOrderId="" />);

    const field = screen.getByLabelText(/order number/i) as HTMLInputElement;

    expect(field.value).toBe("");
    expect(screen.getByRole("button", { name: /track order/i })).toBeTruthy();
  });

  it("is reachable without a cart, an address or a session", async () => {
    const homePage = await renderHomePage();

    expect(homePage).toContain("Already");
    expect(homePage).toContain("Ordered?");
    expect(homePage).toContain("No account, no password.");
  });

  /**
   * A `GET` form needs no route handler and no client component. If the home page ever starts
   * talking to an endpoint to look an order up, that is a backend change this entry point was
   * explicitly not supposed to need.
   */
  it("needs no endpoint of its own", async () => {
    const homePage = await renderHomePage();

    expect(homePage).not.toContain("/api/");
    expect(homePage).not.toContain("onsubmit");
  });
});
