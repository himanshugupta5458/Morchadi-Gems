import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "content-pipeline/drafts";
let count = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  let changed = false;
  for (const a of draft.attributes || []) {
    if (a.confirmed !== true) { a.confirmed = true; changed = true; count++; }
  }
  if (changed) writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}
console.log(`Force-confirmed ${count} remaining attribute(s) across all drafts`);
