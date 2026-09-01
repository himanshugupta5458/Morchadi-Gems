/**
 * Measures the real rendered height of every product card in a grid row, in a real browser.
 *
 * The vitest suite cannot do this: jsdom applies no stylesheet, so `lib/product-card-alignment.test.tsx`
 * can only assert the structure the alignment rests on. This script asserts the alignment
 * itself — it loads a built page, finds each grid row by the shared top offset of its cards, and
 * reports the spread of `getBoundingClientRect().height` within it.
 *
 * It also measures the counterfactual, which is the reason it exists rather than a screenshot:
 * with `--counterfactual` it strips the reserved options-tag slot from every card and measures
 * again, so "the reserved slot is still needed" is a number rather than an opinion. See
 * [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 *
 * Usage, against a server already running (`npm run build && npm start`):
 *
 *   node scripts/measure-card-heights.mjs [--url http://localhost:3000] [--counterfactual]
 *
 * It needs a headless Chromium, which `playwright-core` supplies. **That is deliberately not a
 * dependency in `package.json`.** This script is run by hand when the card's box model changes,
 * and listing it would put a browser download into `npm ci` — which is what the Docker build
 * runs, for an image that never opens one. Install it in the working copy when the numbers are
 * needed:
 *
 *   npm i --no-save playwright-core && npx playwright install chromium
 *
 * The gate does not run this. `lib/product-card-alignment.test.tsx` is what runs everywhere, and
 * it asserts the structure these numbers rest on.
 */
import { chromium } from "playwright-core";

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const PAGES = ["/shop", "/"];

const RESERVED_TAG_SELECTOR = "article .h-4";

function readFlag(name) {
  return process.argv.includes(`--${name}`);
}

function readOption(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
}

/** Groups cards into rows by their top offset, then reports the spread of heights in each. */
const measureRows = () => {
  const cards = Array.from(document.querySelectorAll("article")).filter((article) =>
    article.querySelector("button"),
  );

  const rows = new Map();
  for (const card of cards) {
    const box = card.getBoundingClientRect();
    const top = Math.round(box.top + window.scrollY);
    const row = rows.get(top) ?? [];
    row.push({
      id: card.querySelector("a[href^='/product/']")?.getAttribute("href") ?? "?",
      height: Math.round(box.height * 100) / 100,
      hasOptionsTag: (card.querySelector(".h-4")?.textContent ?? "").trim().length > 0,
    });
    rows.set(top, row);
  }

  return Array.from(rows.entries())
    .sort(([left], [right]) => left - right)
    .map(([top, cardsInRow]) => {
      const heights = cardsInRow.map((card) => card.height);
      return {
        top,
        count: cardsInRow.length,
        min: Math.min(...heights),
        max: Math.max(...heights),
        spread: Math.round((Math.max(...heights) - Math.min(...heights)) * 100) / 100,
        withOptions: cardsInRow.filter((card) => card.hasOptionsTag).length,
      };
    });
};

const stripReservedSlot = (selector) => {
  for (const slot of document.querySelectorAll(selector)) {
    if ((slot.textContent ?? "").trim().length === 0) slot.remove();
  }
};

async function main() {
  const baseUrl = readOption("url", "http://localhost:3000");
  const wantsCounterfactual = readFlag("counterfactual");

  const browser = await chromium.launch();

  try {
    for (const path of PAGES) {
      for (const viewport of VIEWPORTS) {
        const page = await browser.newPage({ viewport });
        await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });

        const rows = await page.evaluate(measureRows);
        report(path, viewport, "as built", rows);

        if (wantsCounterfactual) {
          await page.evaluate(stripReservedSlot, RESERVED_TAG_SELECTOR);
          report(path, viewport, "slot removed", await page.evaluate(measureRows));
        }

        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

function report(path, viewport, label, rows) {
  const worst = rows.reduce((highest, row) => Math.max(highest, row.spread), 0);
  const mixed = rows.filter((row) => row.withOptions > 0 && row.withOptions < row.count);

  console.log(
    `${path} @ ${viewport.name} (${viewport.width}px) — ${label}: ` +
      `${rows.length} rows, ${mixed.length} mixed, worst spread ${worst}px`,
  );

  for (const row of rows) {
    const mixedMark = row.withOptions > 0 && row.withOptions < row.count ? " mixed" : "";
    console.log(
      `    row@${row.top}: ${row.count} cards, ${row.withOptions} tagged${mixedMark}, ` +
        `${row.min}–${row.max}px, spread ${row.spread}px`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
