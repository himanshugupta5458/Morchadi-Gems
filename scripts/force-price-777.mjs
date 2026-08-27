import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "content-pipeline/drafts";
let touched = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const price = draft.pricing?.price;
  const needsFix = price === null || (typeof price === "number" && price < 25);
  if (!needsFix) continue;

  draft.pricing.price = 777;
  draft.pricing.mrp = 777;
  writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  touched.push(pid);
}
console.log(`Set price=777 on ${touched.length} product(s)`);
console.log(touched.join(" "));
