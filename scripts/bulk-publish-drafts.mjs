import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const catalogue = JSON.parse(readFileSync("data/products.json", "utf8"));
const draftIds = catalogue.filter((p) => p.status === "draft").map((p) => p.id);

console.log(`Found ${draftIds.length} draft product(s) to publish.\n`);

let published = [];
let failed = [];

for (const id of draftIds) {
  try {
    execSync(`node scripts/publish-product.mjs ${id}`, { stdio: "pipe" });
    published.push(id);
    console.log(`  OK   ${id}`);
  } catch (err) {
    failed.push({ id, error: err.stdout?.toString() || err.message });
    console.log(`  FAIL ${id}`);
  }
}

console.log(`\nPublished: ${published.length}`);
console.log(`Failed: ${failed.length}`);
if (failed.length > 0) {
  for (const f of failed) console.log(`  ${f.id}: ${f.error}`);
}
