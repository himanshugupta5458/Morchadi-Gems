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

  const general = draft.images?.general || [];
  const unconfirmed = general.filter((i) => i.confirmed !== true);
  if (unconfirmed.length === 0) continue;

  applied.push({ pid, count: unconfirmed.length, total: general.length });
  if (!dryRun) {
    for (const img of general) img.confirmed = true;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(dryRun ? "DRY RUN\n" : "APPLIED\n");
console.log(`Products with remaining unconfirmed gallery images: ${applied.length}`);
for (const a of applied.slice(0, 20)) console.log(`  ${a.pid}: ${a.count} of ${a.total} image(s) still unconfirmed`);
if (applied.length > 20) console.log(`  ... and ${applied.length - 20} more`);
