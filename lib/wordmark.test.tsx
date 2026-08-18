/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Wordmark } from "@/components/Wordmark";

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
    priority,
    ...imageProps
  }: {
    src: { src: string } | string;
    alt: string;
    priority?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : src.src}
      alt={alt}
      data-priority={priority ? "true" : "false"}
      {...imageProps}
    />
  ),
}));

afterEach(cleanup);

describe("Wordmark", () => {
  it("renders the logo image by default", () => {
    render(<Wordmark />);

    const logo = screen.getByAltText("Morchadi Gems");
    expect(logo.tagName).toBe("IMG");
    expect(logo.getAttribute("src")).toContain("logo");
  });

  it("links home from either variant", () => {
    const { rerender } = render(<Wordmark />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/");

    rerender(<Wordmark variant="text" />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/");
  });

  it("names the link for assistive technology", () => {
    render(<Wordmark />);
    expect(screen.getByRole("link", { name: "Morchadi Gems, home" })).toBeTruthy();
  });

  /**
   * Both dimensions are constrained in CSS — a fixed height and an explicit `w-auto`. That
   * pairing is what keeps the header from reflowing when the logo decodes, and it is also
   * what stops next/image warning that only one dimension was modified.
   */
  it("constrains the logo's height and lets width follow the aspect ratio", () => {
    render(<Wordmark />);

    const className = screen.getByAltText("Morchadi Gems").getAttribute("class") ?? "";
    expect(className).toContain("h-11");
    expect(className).toContain("lg:h-16");
    expect(className).toContain("w-auto");
  });

  it("marks the logo as priority only when asked", () => {
    const { rerender } = render(<Wordmark />);
    expect(screen.getByAltText("Morchadi Gems").getAttribute("data-priority")).toBe("false");

    rerender(<Wordmark priority />);
    expect(screen.getByAltText("Morchadi Gems").getAttribute("data-priority")).toBe("true");
  });

  /**
   * The footer is charcoal and the logo's script is dark green — measured at 1.65:1 against
   * `#1C1C1C`, well under the 3:1 a graphic needs. ADR-022 answers that with the type
   * lockup rather than the image, and these two cases are what stop the footer quietly
   * reverting to an unreadable logo.
   */
  describe("the text variant, for dark grounds", () => {
    it("renders the two-tone type lockup and no image at all", () => {
      render(<Wordmark variant="text" tone="ivory" />);

      expect(screen.queryByAltText("Morchadi Gems")).toBeNull();
      expect(screen.getByText("Morchadi")).toBeTruthy();
      expect(screen.getByText("Gems")).toBeTruthy();
    });

    it("carries the requested tone on the roman half and gold on the italic half", () => {
      render(<Wordmark variant="text" tone="ivory" />);

      expect(screen.getByText("Morchadi").getAttribute("class")).toContain("text-ivory");
      expect(screen.getByText("Gems").getAttribute("class")).toContain("text-gold");
    });
  });
});
