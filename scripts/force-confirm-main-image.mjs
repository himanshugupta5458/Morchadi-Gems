import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "content-pipeline/drafts";
let count = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const general = draft.images?.general || [];
  if (general.length === 0) continue;
  if (general[0].confirmed !== true) {
    general[0].confirmed = true;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
    count++;
  }
}
console.log(`Force-confirmed main image on ${count} product(s)`);
