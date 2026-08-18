import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGO_PATH = join(REPO_ROOT, "public", "logo.png");
const APP_DIR = join(REPO_ROOT, "app");
const OG_DIR = join(REPO_ROOT, "public", "og");

const IVORY = { r: 0xfd, g: 0xfb, b: 0xf7, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const GOLD_DEEP = "#A9863A";
const SANS_STACK = "DejaVu Sans, Helvetica, Arial, sans-serif";

/**
 * The peacock feather's eye, measured off the 642 x 388 source. The full lockup is 1.65:1
 * and reduces to an illegible smear at 32px, so the icon takes the one element that is
 * square, self-contained, and recognisable that small. The bottom edge stops at y=200:
 * below that the crop starts catching ascenders from the "Morchadi" script, which read as a
 * detached speck once the icon is scaled down.
 */
const FEATHER_CROP = { left: 240, top: 60, width: 150, height: 140 };
const ICON_PADDING_RATIO = 0.06;

const ICON_SIZE = 512;
const APPLE_ICON_SIZE = 180;
const FAVICON_SIZES = [16, 32, 48];

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_LOGO_WIDTH = 640;

async function renderFeather(size, background) {
  const cropped = await sharp(LOGO_PATH).extract(FEATHER_CROP).png().toBuffer();
  const inner = Math.round(size * (1 - 2 * ICON_PADDING_RATIO));
  const scaled = await sharp(cropped)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: scaled, gravity: "centre" }])
    .png()
    .toBuffer();
}

const ICO_HEADER_BYTES = 6;
const ICO_ENTRY_BYTES = 16;

/**
 * A minimal ICO container holding one PNG per size. Sharp cannot write .ico, and the format
 * is small enough to assemble by hand: a 6-byte header, one 16-byte directory entry per
 * image, then the PNG payloads. PNG-in-ICO is understood by every browser still shipping.
 */
function packIco(pngs) {
  const header = Buffer.alloc(ICO_HEADER_BYTES);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  let offset = ICO_HEADER_BYTES + ICO_ENTRY_BYTES * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(ICO_ENTRY_BYTES);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngs.map(({ data }) => data)]);
}

function ogCaptionSvg() {
  const centreX = OG_WIDTH / 2;

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}">
    <rect x="${centreX - 60}" y="522" width="120" height="2" fill="${GOLD_DEEP}" />
    <text x="${centreX}" y="574" font-family="${SANS_STACK}" font-size="24"
      letter-spacing="7" fill="${GOLD_DEEP}" text-anchor="middle">ANTI-TARNISH ARTIFICIAL JEWELLERY</text>
  </svg>`);
}

async function renderOgImage() {
  const logo = await sharp(LOGO_PATH)
    .resize({ width: OG_LOGO_WIDTH })
    .png()
    .toBuffer();
  const { height: logoHeight } = await sharp(logo).metadata();

  return sharp({
    create: { width: OG_WIDTH, height: OG_HEIGHT, channels: 4, background: IVORY },
  })
    .composite([
      {
        input: logo,
        left: Math.round((OG_WIDTH - OG_LOGO_WIDTH) / 2),
        top: Math.round((522 - logoHeight) / 2),
      },
      { input: ogCaptionSvg(), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * Unlike `generate-placeholders.mjs`, this overwrites. Every file here is derived from
 * `public/logo.png` with no hand-editing in between, so a stale copy is a bug rather than
 * something worth protecting — replace the logo, re-run, and the set stays in step.
 */
async function generateBrandAssets() {
  mkdirSync(OG_DIR, { recursive: true });

  const icon = await renderFeather(ICON_SIZE, TRANSPARENT);
  writeFileSync(join(APP_DIR, "icon.png"), icon);

  const appleIcon = await renderFeather(APPLE_ICON_SIZE, IVORY);
  writeFileSync(join(APP_DIR, "apple-icon.png"), appleIcon);

  const faviconPngs = [];
  for (const size of FAVICON_SIZES) {
    faviconPngs.push({ size, data: await renderFeather(size, TRANSPARENT) });
  }
  writeFileSync(join(APP_DIR, "favicon.ico"), packIco(faviconPngs));

  const ogImage = await renderOgImage();
  writeFileSync(join(OG_DIR, "default.png"), ogImage);

  console.log("Morchadi Gems — brand asset generation\n");
  console.log(`Source            public/logo.png`);
  console.log(`Icon crop         ${FEATHER_CROP.width}x${FEATHER_CROP.height} at (${FEATHER_CROP.left}, ${FEATHER_CROP.top}) — the peacock feather eye`);
  console.log(`app/icon.png      ${ICON_SIZE}x${ICON_SIZE}, transparent`);
  console.log(`app/apple-icon.png ${APPLE_ICON_SIZE}x${APPLE_ICON_SIZE}, ivory ground`);
  console.log(`app/favicon.ico   ${FAVICON_SIZES.join(", ")}px`);
  console.log(`public/og/default.png ${OG_WIDTH}x${OG_HEIGHT}`);
  console.log("\nThis script overwrites. Every output is derived from the logo alone.");
}

generateBrandAssets().catch((error) => {
  console.error(`FAIL — ${error.message}`);
  process.exit(1);
});
