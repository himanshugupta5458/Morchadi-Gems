import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv[2] !== "--apply";
const dir = "content-pipeline/drafts";

let applied = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const variantImages = draft.images?.variantImages || {};
  const keys = Object.keys(variantImages);
  const unconfirmedKeys = keys.filter((k) => variantImages[k].confirmed !== true);
  if (unconfirmedKeys.length === 0) continue;

  applied.push({ pid, count: unconfirmedKeys.length, total: keys.length });
  if (!dryRun) {
    for (const k of keys) variantImages[k].confirmed = true;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(dryRun ? "DRY RUN\n" : "APPLIED\n");
console.log(`Products with unconfirmed variant images: ${applied.length}`);
for (const a of applied) console.log(`  ${a.pid}: ${a.count} of ${a.total} variant image(s)`);
