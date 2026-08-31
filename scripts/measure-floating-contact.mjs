/**
 * Measures whether the floating WhatsApp button overlaps any call to action, in a real browser,
 * at several viewport widths and several scroll positions on each page.
 *
 * This is the tool that found the bug ADR-069 fixes and the tool that proves it fixed: the
 * jsdom suite can assert the arithmetic in `lib/floating-contact.ts` but cannot lay out a page,
 * and the overlap was a layout fact. `lib/floating-contact.test.ts` checks the rule; this checks
 * that the rule is being applied to real rectangles.
 *
 * Not part of `npm test`. It needs a browser binary and a running dev server, neither of which
 * belongs in the gate:
 *
 *   npm i -D playwright-core          # once, removed again afterwards
 *   npm run dev                       # in another terminal
 *   node scripts/measure-floating-contact.mjs
 *
 * Exits non-zero if any overlap is found, so it can be run as a check rather than read as a
 * report.
 */

import { readFileSync } from "node:fs";

const BASE_URL = process.env.MEASURE_BASE_URL ?? "http://localhost:3000";

const PAGES = [
  { name: "home", path: "/" },
  {
    name: "shop fixture",
    path: "/shop?category=rings&min=199&max=199&sort=name-desc",
  },
];

const VIEWPORT_WIDTHS = [375, 414, 768, 1024, 1440];
const VIEWPORT_HEIGHT = 1000;

/** Fractions of the scrollable height to stop at. Five, including both ends. */
const SCROLL_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

/** Longer than the component's own settle delay, so it has taken its resting position. */
const SETTLE_WAIT_MS = 450;

/**
 * The selector, lifted out of `lib/floating-contact.ts` rather than restated here. A plain
 * script cannot import a TypeScript module, and a second copy of the selector would let this
 * measure something other than what the button actually avoids.
 */
function readObstacleSelector() {
  const source = readFileSync(
    new URL("../lib/floating-contact.ts", import.meta.url),
    "utf8",
  );
  const declaration = /export const CONTACT_OBSTACLE_SELECTOR =\s*([\s\S]*?);/.exec(source);
  if (declaration === null) {
    throw new Error("lib/floating-contact.ts declares no CONTACT_OBSTACLE_SELECTOR");
  }

  return declaration[1]
    .split("+")
    .map((piece) => piece.trim().replace(/^['"`]|['"`]$/g, ""))
    .join("");
}

async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch {
    console.error(
      "playwright-core is not installed. Run `npm i -D playwright-core`, take the measurements, then remove it again.",
    );
    process.exit(2);
  }
}

/**
 * Read inside the page: the button's rectangle, and the rectangle of everything the button is
 * supposed to keep off. The selector is read from the page's own bundle rather than restated
 * here, so this cannot drift from what the component actually avoids.
 */
function measureInPage(selector) {
  const button = document.querySelector("[data-floating-contact]");
  if (button === null) return { error: "no floating contact button on this page" };

  const buttonBox = button.getBoundingClientRect();
  const isHidden = window.getComputedStyle(button).opacity === "0";

  const overlaps = [];
  for (const control of document.querySelectorAll(selector)) {
    const box = control.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;

    const overlapWidth = Math.min(buttonBox.right, box.right) - Math.max(buttonBox.left, box.left);
    const overlapHeight = Math.min(buttonBox.bottom, box.bottom) - Math.max(buttonBox.top, box.top);
    if (overlapWidth <= 0 || overlapHeight <= 0) continue;

    overlaps.push({
      label: (control.textContent ?? "").trim().slice(0, 40) || control.tagName.toLowerCase(),
      control: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      overlapWidth: Math.round(overlapWidth),
      overlapHeight: Math.round(overlapHeight),
      coveredPercent: Math.round(
        ((overlapWidth * overlapHeight) / (box.width * box.height)) * 100,
      ),
    });
  }

  return {
    isHidden,
    button: {
      left: Math.round(buttonBox.left),
      top: Math.round(buttonBox.top),
      width: Math.round(buttonBox.width),
      height: Math.round(buttonBox.height),
    },
    overlaps,
  };
}

async function main() {
  const { chromium } = await loadPlaywright();
  const obstacleSelector = readObstacleSelector();

  const browser = await chromium.launch();
  let failures = 0;

  for (const width of VIEWPORT_WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height: VIEWPORT_HEIGHT },
    });
    const page = await context.newPage();

    for (const target of PAGES) {
      await page.goto(`${BASE_URL}${target.path}`, { waitUntil: "networkidle" });

      const scrollHeight = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );

      for (const fraction of SCROLL_FRACTIONS) {
        const offset = Math.round(scrollHeight * fraction);
        await page.evaluate((to) => window.scrollTo(0, to), offset);
        await page.waitForTimeout(SETTLE_WAIT_MS);

        const measured = await page.evaluate(measureInPage, obstacleSelector);

        if (measured.error !== undefined) {
          console.log(`${width}px  ${target.name}  scroll ${offset}  ${measured.error}`);
          continue;
        }

        const { button, overlaps, isHidden } = measured;
        const position = `${button.width}x${button.height} at left ${button.left}, top ${button.top}`;

        if (overlaps.length === 0) {
          console.log(
            `PASS  ${width}px  ${target.name.padEnd(13)} scroll ${String(offset).padStart(5)}  ${position}${isHidden ? "  (hidden)" : ""}`,
          );
          continue;
        }

        failures += overlaps.length;
        console.log(
          `FAIL  ${width}px  ${target.name.padEnd(13)} scroll ${String(offset).padStart(5)}  ${position}`,
        );
        for (const overlap of overlaps) {
          console.log(
            `        covers ${overlap.overlapWidth}x${overlap.overlapHeight}px (${overlap.coveredPercent}%) of "${overlap.label}"`,
          );
        }
      }
    }

    await context.close();
  }

  await browser.close();

  console.log(
    failures === 0
      ? "\nNo call to action is covered at any tested width or scroll position."
      : `\n${failures} overlap(s) found.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

await main();
