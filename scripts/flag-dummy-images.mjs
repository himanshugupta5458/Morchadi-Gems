#!/usr/bin/env node
/**
 * v3 — the file-size and bytes-per-pixel approaches (v1, v2) both failed on this catalogue:
 * WebP's adaptive compression squeezes both real photos and flat generated graphics into a
 * similar bytes-per-pixel band, so that signal had no real discriminative power here.
 *
 * This version measures PIXEL VALUE VARIANCE instead (via sharp's per-channel standard
 * deviation), which survives compression format differences. A real jewellery photograph has
 * continuous shading, reflections and shadow gradients even on a clean studio background — real
 * pixel-to-pixel variation. A flat icon-on-gradient placeholder graphic has very little of that;
 * most of the image is smooth, near-uniform colour. Low standard deviation = flat/generated;
 * high standard deviation = photographic detail.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const PRODUCTS_PATH = path.join(REPO_ROOT, "data", "products.json");
const PUBLIC_DIR = path.join(REPO_ROOT, "public");

function readProducts() {
  return JSON.parse(fs.readFileSync(PRODUCTS_PATH, "utf8"));
}

async function main() {
  const products = readProducts();
  const active = products.filter((p) => p.status !== "draft");
  const results = [];
  const missing = [];

  for (const product of active) {
    const primaryImage = product.media?.images?.[0];
    if (!primaryImage) {
      missing.push(product.id);
      continue;
    }

    const absolutePath = path.join(PUBLIC_DIR, primaryImage.replace(/^\//, ""));
    if (!fs.existsSync(absolutePath)) {
      missing.push(product.id);
      continue;
    }

    const stats = await sharp(absolutePath).stats();
    const avgStdev =
      stats.channels.slice(0, 3).reduce((sum, ch) => sum + ch.stdev, 0) /
      Math.min(3, stats.channels.length);

    results.push({ id: product.id, path: primaryImage, avgStdev });
  }

  results.sort((a, b) => a.avgStdev - b.avgStdev);

  console.log(`Checked ${active.length} active products (${missing.length} missing images).\n`);

  console.log("=== LOWEST 30 BY COLOUR VARIANCE (most likely flat/generated graphics) ===");
  for (const item of results.slice(0, 30)) {
    console.log(`  ${item.id}: stdev ${item.avgStdev.toFixed(2)}  (${item.path})`);
  }

  console.log("\n=== HIGHEST 15 BY COLOUR VARIANCE (most likely real, detailed photos) ===");
  for (const item of results.slice(-15).reverse()) {
    console.log(`  ${item.id}: stdev ${item.avgStdev.toFixed(2)}  (${item.path})`);
  }

  const p113 = results.find((r) => r.id === "P113");
  console.log(`\n=== KNOWN PLACEHOLDER (P113), confirmed by you ===`);
  if (p113) console.log(`  P113: stdev ${p113.avgStdev.toFixed(2)}`);

  console.log(
    "\nLook at where P113 lands relative to the full sorted list, and where the 'HIGHEST 15'",
  );
  console.log(
    "sit. If there's a real, clear jump in the numbers somewhere, that gap is the threshold to",
  );
  console.log(
    "use. If P113's number is NOT clearly separated from real-photo numbers, this signal also",
  );
  console.log("doesn't work cleanly for this catalogue, and this needs a manual visual review.");
}

main();
