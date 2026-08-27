import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv[2] !== "--apply";
const dir = "content-pipeline/drafts";

let applied = [];
let skipped = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const attrs = draft.attributes || [];
  const allConfirmed = attrs.length > 0 && attrs.every((a) => a.confirmed === true);
  if (!allConfirmed) continue;

  const general = draft.images?.general || [];
  if (general.length !== 1) {
    skipped.push({ pid, reason: `${general.length} general images (need exactly 1 for auto-confirm)` });
    continue;
  }
  if (general[0].confirmed === true) {
    continue;
  }

  applied.push({ pid, path: general[0].path });
  if (!dryRun) {
    general[0].confirmed = true;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(dryRun ? "DRY RUN\n" : "APPLIED\n");
console.log(`Auto-confirmed (exactly 1 main image): ${applied.length}`);
console.log(`Skipped (0 or 2+ images, needs individual look): ${skipped.length}\n`);
for (const s of skipped) console.log(`  ${s.pid}: ${s.reason}`);
