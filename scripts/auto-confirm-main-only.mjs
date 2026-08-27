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

  const attrs = draft.attributes || [];
  const allConfirmed = attrs.length > 0 && attrs.every((a) => a.confirmed === true);
  if (!allConfirmed) continue;

  const general = draft.images?.general || [];
  if (general.length < 2) continue; // handled by the previous script
  if (general[0].confirmed === true) continue; // already done

  applied.push({ pid, path: general[0].path, total: general.length });
  if (!dryRun) {
    general[0].confirmed = true;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(dryRun ? "DRY RUN\n" : "APPLIED\n");
console.log(`Would confirm main image only (index 0) on: ${applied.length} product(s)`);
console.log(`Remaining images in each gallery stay unconfirmed (not deleted, not touched)\n`);
for (const a of applied.slice(0, 15)) console.log(`  ${a.pid}: main="${a.path}", ${a.total} total images`);
if (applied.length > 15) console.log(`  ... and ${applied.length - 15} more`);
