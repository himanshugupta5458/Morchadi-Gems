import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "content-pipeline/drafts";
let realApplied = [];
let placeholderApplied = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const currentPrice = draft.pricing?.price;
  // Only touch products currently at 777 (our placeholder) or still null/below-floor
  const isPlaceholderOrUnset = currentPrice === 777 || currentPrice === null || (typeof currentPrice === "number" && currentPrice < 25);
  if (!isPlaceholderOrUnset) continue;

  const ref = draft.pricing?.referencePrice || "";
  const saleMatch = ref.match(/₹\s?([\d,]+(?:\.\d+)?)\s*sale price/i);
  const costMatch = ref.match(/₹\s?([\d,]+(?:\.\d+)?)\s*cost/i);

  let price = null;
  let cost = costMatch ? parseFloat(costMatch[1].replace(/,/g, "")) : null;

  if (saleMatch) {
    const candidate = parseFloat(saleMatch[1].replace(/,/g, ""));
    // Check for a genuinely conflicting second price mention (like P536/P537's "Only ₹XXX")
    const otherMentions = [...ref.matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)]
      .map((m) => parseFloat(m[1].replace(/,/g, "")))
      .filter((p) => p !== candidate && p !== cost);
    if (otherMentions.length === 0 && candidate >= 25) {
      price = candidate;
    }
  } else {
    // Fall back: single lone ₹ figure with no explicit "sale price" label
    const anyMatches = [...ref.matchAll(/₹\s?([\d,]+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1].replace(/,/g, "")));
    if (anyMatches.length === 1 && anyMatches[0] >= 25) {
      price = anyMatches[0];
    }
  }

  if (price !== null) {
    draft.pricing.price = price;
    draft.pricing.mrp = price;
    if (cost !== null && (draft.pricing.cost === null || draft.pricing.cost === undefined)) {
      draft.pricing.cost = cost;
    }
    realApplied.push({ pid, price });
  } else {
    draft.pricing.price = 777;
    draft.pricing.mrp = 777;
    placeholderApplied.push(pid);
  }

  writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}

console.log(`Real reference price applied: ${realApplied.length}`);
console.log(`Placeholder 777 kept (no parseable reference price): ${placeholderApplied.length}`);
console.log();
console.log("Placeholder-only ids (genuinely no usable reference price):");
console.log(placeholderApplied.join(" "));
