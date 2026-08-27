import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "content-pipeline/drafts";
let applied = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const price = draft.pricing?.price;
  const cost = draft.pricing?.cost;

  if (cost !== null && cost !== undefined) continue; // already has a real (or placeholder) cost
  if (!(typeof price === "number" && price > 0)) continue; // no price yet, nothing to compute from

  const dummyCost = Math.round(price * 0.4);
  draft.pricing.cost = dummyCost;
  applied.push({ pid, price, dummyCost });
  writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}

console.log(`Applied dummy cost (40% of price) to ${applied.length} product(s)`);
console.log(applied.slice(0, 15).map(a => `${a.pid}: price=${a.price} -> cost=${a.dummyCost}`).join("\n"));
if (applied.length > 15) console.log(`... and ${applied.length - 15} more`);
