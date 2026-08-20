/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_TAG_MANAGER_ORIGIN,
  buildGtagInitScript,
  buildGtagScriptSrc,
  getGoogleAnalyticsMeasurementId,
} from "@/lib/analytics";
import { buildContentSecurityPolicy } from "@/config/security-headers.mjs";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

const MEASUREMENT_ID = "G-TEST1234";

/**
 * `next/script` is Next's loader rather than a tag, and outside a running app it has no
 * router to register with. It is replaced with the element it eventually renders, which is
 * what these assertions are about: the src, the strategy and the config call.
 */
vi.mock("next/script", () => ({
  default: ({
    id,
    src,
    strategy,
    dangerouslySetInnerHTML,
  }: {
    id?: string;
    src?: string;
    strategy?: string;
    dangerouslySetInnerHTML?: { __html: string };
  }) => (
    <script
      data-testid={id}
      data-src={src}
      data-strategy={strategy}
      dangerouslySetInnerHTML={dangerouslySetInnerHTML}
    />
  ),
}));

function renderedScripts(): HTMLScriptElement[] {
  const { container } = render(<GoogleAnalytics />);
  return Array.from(container.querySelectorAll("script"));
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
});

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
});

describe("the measurement id", () => {
  it("is an empty string when the deployment was given none", () => {
    expect(getGoogleAnalyticsMeasurementId()).toBe("");

    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "";
    expect(getGoogleAnalyticsMeasurementId()).toBe("");
  });

  it("is whatever the deployment set", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = MEASUREMENT_ID;
    expect(getGoogleAnalyticsMeasurementId()).toBe(MEASUREMENT_ID);
  });
});

describe("the tag, with no measurement id set", () => {
  it("renders nothing at all, so nothing is requested from Google", () => {
    expect(renderedScripts()).toHaveLength(0);
  });

  it("renders nothing for an id that is only whitespace away from being unset", () => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "";
    expect(renderedScripts()).toHaveLength(0);
  });
});

describe("the tag, once a measurement id exists", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = MEASUREMENT_ID;
  });

  it("loads gtag.js from the Google Tag host and configures the id", () => {
    const [loader, config] = renderedScripts();

    expect(loader.getAttribute("data-src")).toBe(
      `${GOOGLE_TAG_MANAGER_ORIGIN}/gtag/js?id=${MEASUREMENT_ID}`,
    );
    expect(config.innerHTML).toContain(`gtag('config', "${MEASUREMENT_ID}")`);
  });

  it("waits until the page is interactive, so it never delays the pay button", () => {
    for (const script of renderedScripts()) {
      expect(script.getAttribute("data-strategy")).toBe("afterInteractive");
    }
  });

  it("loads from a host the content security policy actually allows", () => {
    const scriptSrc = buildContentSecurityPolicy(false)
      .split("; ")
      .find((directive) => directive.startsWith("script-src "));

    expect(scriptSrc).toContain(
      new URL(buildGtagScriptSrc(MEASUREMENT_ID)).origin,
    );
  });

  it("escapes the id it writes into an inline script", () => {
    expect(buildGtagInitScript('G-X");evil("')).toContain(
      'gtag(\'config\', "G-X\\");evil(\\"")',
    );
  });
});
