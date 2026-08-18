import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOGUE_PATH = join(REPO_ROOT, "data", "products.json");
const PRODUCT_IMAGE_DIR = join(REPO_ROOT, "public", "products");
const CATEGORY_IMAGE_DIR = join(REPO_ROOT, "public", "categories");
const HERO_IMAGE_DIR = join(REPO_ROOT, "public", "hero");

const PRODUCT_SIZE = 1000;
const CATEGORY_WIDTH = 1200;
const CATEGORY_HEIGHT = 1500;
const HERO_WIDTH = 1600;
const HERO_HEIGHT = 1200;
const HERO_TINT = "#F2E6D2";
const WEBP_QUALITY = 82;

const IVORY = "#FDFBF7";
const INK = "#1C1C1C";
const GOLD = "#C6A24C";
const GOLD_DEEP = "#A9863A";
const MUTED = "#6B6B6B";

const SERIF_STACK = "DejaVu Serif, Georgia, Times New Roman, serif";
const SANS_STACK = "DejaVu Sans, Helvetica, Arial, sans-serif";

const GEM_MOTIF_PATHS = [
  "M8 3h8l4 6-8 12L4 9l4-6z",
  "M4 9h16",
  "M8 3l4 18 4-18",
];
const GEM_VIEWBOX_SIZE = 24;

const CATEGORIES = [
  { slug: "necklaces", label: "Necklaces", tint: "#F1E6D8" },
  { slug: "earrings", label: "Earrings", tint: "#ECE5DD" },
  { slug: "rings", label: "Rings", tint: "#F4E6E1" },
  { slug: "bracelets", label: "Bracelets", tint: "#E7E9E0" },
  { slug: "bangles", label: "Bangles", tint: "#F5E8D0" },
  { slug: "pendants", label: "Pendants", tint: "#E7E5EC" },
  { slug: "anklets", label: "Anklets", tint: "#E3E8E8" },
  { slug: "nose-pins", label: "Nose Pins", tint: "#F0E2E2" },
  { slug: "watches", label: "Watches", tint: "#E6E4DE" },
  { slug: "hair-accessories", label: "Hair Accessories", tint: "#EFE4EA" },
];

const categoryBySlug = new Map(CATEGORIES.map((category) => [category.slug, category]));

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapIntoLines(text, maxCharsPerLine, maxLines) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }
    if (currentLine.length > 0) lines.push(currentLine);
    currentLine = word;
    if (lines.length === maxLines) break;
  }

  if (lines.length < maxLines && currentLine.length > 0) lines.push(currentLine);
  return lines.slice(0, maxLines);
}

function gemMotif({ centreX, topY, size, strokeWidth }) {
  const scale = size / GEM_VIEWBOX_SIZE;
  const paths = GEM_MOTIF_PATHS.map((path) => `<path d="${path}" />`).join("");

  return `<g transform="translate(${centreX - size / 2} ${topY}) scale(${scale})"
    fill="none" stroke="${GOLD}" stroke-width="${strokeWidth}"
    stroke-linecap="round" stroke-linejoin="round" opacity="0.9">${paths}</g>`;
}

/**
 * Tint sits in the centre and falls off to ivory at the edges, never the other way
 * round. ProductCard insets the image inside an ivory area, so an edge-tinted field
 * would draw a visible rectangle there — the inner frame design QA removed.
 */
function tintedField(width, height, tint, falloffRadiusPercent = 78) {
  return `
    <defs>
      <radialGradient id="field" cx="50%" cy="46%" r="${falloffRadiusPercent}%">
        <stop offset="0%" stop-color="${tint}" />
        <stop offset="44%" stop-color="${tint}" />
        <stop offset="100%" stop-color="${IVORY}" />
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="${IVORY}" />
    <rect width="${width}" height="${height}" fill="url(#field)" />`;
}

function productPlaceholderSvg(product) {
  const category = categoryBySlug.get(product.category);
  const nameLines = wrapIntoLines(escapeXml(product.name), 26, 2);
  const nameStartY = 708;
  const nameLineHeight = 48;

  const nameMarkup = nameLines
    .map(
      (line, index) =>
        `<text x="${PRODUCT_SIZE / 2}" y="${nameStartY + index * nameLineHeight}"
          font-family="${SERIF_STACK}" font-size="38" fill="${INK}"
          text-anchor="middle">${line}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${PRODUCT_SIZE}" height="${PRODUCT_SIZE}">
    ${tintedField(PRODUCT_SIZE, PRODUCT_SIZE, category.tint)}
    ${gemMotif({ centreX: PRODUCT_SIZE / 2, topY: 300, size: 260, strokeWidth: 0.75 })}
    <rect x="${PRODUCT_SIZE / 2 - 40}" y="596" width="80" height="1.5" fill="${GOLD}" />
    <text x="${PRODUCT_SIZE / 2}" y="644" font-family="${SANS_STACK}" font-size="19"
      letter-spacing="5.5" fill="${GOLD_DEEP}" text-anchor="middle">
      ${escapeXml(category.label.toUpperCase())}
    </text>
    ${nameMarkup}
  </svg>`;
}

function categoryPlaceholderSvg(category) {
  const centreX = CATEGORY_WIDTH / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CATEGORY_WIDTH}" height="${CATEGORY_HEIGHT}">
    ${tintedField(CATEGORY_WIDTH, CATEGORY_HEIGHT, category.tint, 100)}
    ${gemMotif({ centreX, topY: 500, size: 210, strokeWidth: 0.8 })}
    <rect x="${centreX - 45}" y="780" width="90" height="1.5" fill="${GOLD}" />
    <text x="${centreX}" y="884" font-family="${SERIF_STACK}" font-size="86" fill="${INK}"
      text-anchor="middle">${escapeXml(category.label)}</text>
    <text x="${centreX}" y="944" font-family="${SANS_STACK}" font-size="20"
      letter-spacing="6" fill="${MUTED}" text-anchor="middle">MORCHADI GEMS</text>
  </svg>`;
}

/**
 * Deliberately wordless. The hero panel sits beside a headline that already says the
 * brand name, so text here would only repeat it — and a real photograph dropped in at
 * this path later would carry none of it anyway.
 */
function heroPlaceholderSvg() {
  const centreX = HERO_WIDTH / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_WIDTH}" height="${HERO_HEIGHT}">
    ${tintedField(HERO_WIDTH, HERO_HEIGHT, HERO_TINT, 100)}
    <rect x="${centreX - 140}" y="392" width="280" height="1.5" fill="${GOLD}" opacity="0.55" />
    ${gemMotif({ centreX, topY: 456, size: 300, strokeWidth: 0.7 })}
    <rect x="${centreX - 140}" y="838" width="280" height="1.5" fill="${GOLD}" opacity="0.55" />
    <text x="${centreX}" y="906" font-family="${SANS_STACK}" font-size="22"
      letter-spacing="8" fill="${GOLD_DEEP}" text-anchor="middle">FINE JEWELLERY</text>
  </svg>`;
}

async function writeWebpIfAbsent(targetPath, svg) {
  if (existsSync(targetPath)) return "skipped";

  await sharp(Buffer.from(svg))
    .webp({ quality: WEBP_QUALITY })
    .toFile(targetPath);

  return "written";
}

async function generatePlaceholders() {
  const catalogue = JSON.parse(readFileSync(CATALOGUE_PATH, "utf8"));

  mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });
  mkdirSync(CATEGORY_IMAGE_DIR, { recursive: true });
  mkdirSync(HERO_IMAGE_DIR, { recursive: true });

  const tally = {
    productsWritten: 0,
    productsSkipped: 0,
    categoriesWritten: 0,
    categoriesSkipped: 0,
    heroWritten: 0,
    heroSkipped: 0,
  };

  const unknownCategories = new Set();

  for (const product of catalogue) {
    if (!categoryBySlug.has(product.category)) {
      unknownCategories.add(product.category);
      continue;
    }

    const outcome = await writeWebpIfAbsent(
      join(PRODUCT_IMAGE_DIR, `${product.id}.webp`),
      productPlaceholderSvg(product),
    );

    if (outcome === "written") tally.productsWritten += 1;
    else tally.productsSkipped += 1;
  }

  for (const category of CATEGORIES) {
    const outcome = await writeWebpIfAbsent(
      join(CATEGORY_IMAGE_DIR, `${category.slug}.webp`),
      categoryPlaceholderSvg(category),
    );

    if (outcome === "written") tally.categoriesWritten += 1;
    else tally.categoriesSkipped += 1;
  }

  const heroOutcome = await writeWebpIfAbsent(
    join(HERO_IMAGE_DIR, "home-hero.webp"),
    heroPlaceholderSvg(),
  );

  if (heroOutcome === "written") tally.heroWritten += 1;
  else tally.heroSkipped += 1;

  console.log("Morchadi Gems — placeholder image generation\n");
  console.log(`Products    written ${tally.productsWritten}   skipped ${tally.productsSkipped}`);
  console.log(`Categories  written ${tally.categoriesWritten}   skipped ${tally.categoriesSkipped}`);
  console.log(`Hero        written ${tally.heroWritten}   skipped ${tally.heroSkipped}`);
  console.log("\nSkipped means a file already exists at that path. This script never");
  console.log("overwrites, so real photography added by hand survives a re-run.");

  if (unknownCategories.size > 0) {
    console.error(
      `\nFAIL — unknown categories with no tint defined: ${[...unknownCategories].join(", ")}`,
    );
    process.exit(1);
  }
}

generatePlaceholders().catch((error) => {
  console.error(`FAIL — ${error.message}`);
  process.exit(1);
});
