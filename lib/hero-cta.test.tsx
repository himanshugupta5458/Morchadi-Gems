/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Hero } from "@/components/Hero";

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

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill,
    priority,
    ...imageProps
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      data-fill={fill ? "true" : "false"}
      data-priority={priority ? "true" : "false"}
      {...imageProps}
    />
  ),
}));

afterEach(cleanup);

function heroCtas(): { shop: HTMLElement; categories: HTMLElement } {
  render(<Hero categoryAnchorId="categories" />);

  return {
    shop: screen.getByRole("link", { name: "Shop Collection" }),
    categories: screen.getByRole("link", { name: "Explore Categories" }),
  };
}

describe("hero call to action pair", () => {
  /**
   * The two labels are different lengths, so nothing about their own boxes would make them
   * match. Equal width comes from the pair being one grid of two equal columns with each
   * button spanning its column, which is why both assertions matter: the columns without
   * `fullWidth` would leave the buttons shrink-wrapped inside equal cells.
   */
  it("puts both buttons in two equal columns", () => {
    const { shop, categories } = heroCtas();
    const pair = shop.parentElement;

    expect(pair).toBe(categories.parentElement);
    expect(pair?.className).toContain(
      "sm:grid-cols-[repeat(2,minmax(17rem,1fr))]",
    );
    expect(pair?.className).toContain("grid");
  });

  it("spans each button across its column", () => {
    const { shop, categories } = heroCtas();

    expect(shop.className).toContain("w-full");
    expect(categories.className).toContain("w-full");
  });

  /**
   * Same box, different fill: the pair only reads as a matched set if the two differ in
   * nothing but the variant colours.
   */
  it("keeps one box across the pair, differing only in variant", () => {
    const { shop, categories } = heroCtas();

    for (const sizing of ["px-10", "py-5", "text-label", "w-full"]) {
      expect(shop.className).toContain(sizing);
      expect(categories.className).toContain(sizing);
    }

    expect(shop.className).toContain("bg-charcoal");
    expect(categories.className).toContain("bg-transparent");
  });

  it("separates the two buttons at every width", () => {
    const { shop } = heroCtas();

    expect(shop.parentElement?.className).toContain("gap-4");
  });
});
