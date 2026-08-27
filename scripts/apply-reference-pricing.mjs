import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv[2] !== "--apply";
const dir = "content-pipeline/drafts";

let applied = [];
let flagged = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const attrs = draft.attributes || [];
  const allConfirmed = attrs.length > 0 && attrs.every((a) => a.confirmed === true);
  if (!allConfirmed) continue;
  if (draft.pricing?.price !== null) continue;

  const ref = draft.pricing?.referencePrice || "";

  // Parse "sale price" figure specifically
  const saleMatch = ref.match(/₹\s?([\d,]+(?:\.\d+)?)\s*sale price/i);
  // Parse "cost" figure specifically
  const costMatch = ref.match(/₹\s?([\d,]+(?:\.\d+)?)\s*cost/i);

  if (!saleMatch) {
    // Fall back: any lone ₹ figure with no explicit "sale price"/"cost" labels
    const anyMatches = [...ref.matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1].replace(/,/g, "")));
    if (anyMatches.length === 1) {
      applied.push({ pid, price: anyMatches[0], cost: null, ref });
      if (!dryRun) {
        draft.pricing.price = anyMatches[0];
        draft.pricing.mrp = anyMatches[0];
        writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
      }
      continue;
    }
    flagged.push({ pid, ref, reason: "no clear sale price figure found" });
    continue;
  }

  const price = parseFloat(saleMatch[1].replace(/,/g, ""));
  const cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, "")) : null;

  // Now check: does the source copy mention a DIFFERENT price elsewhere (e.g. "Only ₹XXX")?
  const otherPriceMentions = [...ref.matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)]
    .map((m) => parseFloat(m[1].replace(/,/g, "")))
    .filter((p) => p !== price && p !== cost);

  if (otherPriceMentions.length > 0) {
    flagged.push({ pid, ref, reason: `sale price ₹${price} conflicts with other mentioned figure(s): ${otherPriceMentions.join(", ")}` });
    continue;
  }

  if (price < 25) {
    flagged.push({ pid, ref, reason: `below ₹25 floor (${price})` });
    continue;
  }

  applied.push({ pid, price, cost, ref });

  if (!dryRun) {
    draft.pricing.price = price;
    draft.pricing.mrp = price;
    if (cost !== null) draft.pricing.cost = cost;
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(dryRun ? "DRY RUN — no files written\n" : "APPLIED — files written\n");
console.log(`Would set/set real price on: ${applied.length} product(s)`);
console.log(`Flagged for individual attention: ${flagged.length} product(s)\n`);

if (flagged.length > 0) {
  console.log("Flagged:");
  for (const f of flagged) console.log(`  ${f.pid}: ${f.reason}`);
}
