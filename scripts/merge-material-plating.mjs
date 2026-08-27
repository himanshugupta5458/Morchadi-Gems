import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv[2] !== "--apply";
const dir = "content-pipeline/drafts";

let merged = [];
let flagged = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const attrs = draft.attributes || [];

  // Group by normalized label -> specs key, same synonym logic as the mapper
  const synonym = (label) => {
    const l = label.trim().toLowerCase();
    if (["material","materials","metal","base metal","base material","plating","finish"].includes(l)) return "material";
    if (["stone","stones","gem","gems","gemstone","gemstones"].includes(l)) return "stone";
    return l;
  };

  const byKey = {};
  attrs.forEach((a, idx) => {
    const key = synonym(a.label);
    byKey[key] = byKey[key] || [];
    byKey[key].push({ idx, attr: a });
  });

  let changed = false;
  const toRemove = new Set();

  for (const [key, group] of Object.entries(byKey)) {
    if (group.length < 2) continue;

    const labels = group.map((g) => g.attr.label.toLowerCase());
    const isMaterialPlatingPair =
      key === "material" &&
      group.length === 2 &&
      labels.includes("material") &&
      labels.some((l) => l === "plating" || l === "finish");

    if (isMaterialPlatingPair) {
      const materialEntry = group.find((g) => g.attr.label.toLowerCase() === "material");
      const platingEntry = group.find((g) => g.attr.label.toLowerCase() !== "material");

      const mergedValue = `${platingEntry.attr.value}-plated ${materialEntry.attr.value}`.toLowerCase();
      const mergedQuote = [materialEntry.attr.source?.quotedPhrase, platingEntry.attr.source?.quotedPhrase]
        .filter(Boolean)
        .join(" / ");

      // Replace the material entry with the merged one, mark plating entry for removal
      materialEntry.attr.value = mergedValue;
      materialEntry.attr.label = "Material";
      if (materialEntry.attr.source) {
        materialEntry.attr.source.quotedPhrase = mergedQuote || materialEntry.attr.source.quotedPhrase;
      }
      toRemove.add(platingEntry.idx);
      changed = true;
      merged.push({ pid, mergedValue });
    } else {
      flagged.push({ pid, key, labels: group.map((g) => g.attr.label) });
    }
  }

  if (changed) {
    draft.attributes = attrs.filter((_, idx) => !toRemove.has(idx));
    if (!dryRun) {
      writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
    }
  }
}

console.log(dryRun ? "DRY RUN\n" : "APPLIED\n");
console.log(`Merged Material+Plating pairs: ${merged.length}`);
console.log(`Flagged as NOT a simple Material+Plating pair (needs individual review): ${flagged.length}\n`);
for (const f of flagged) console.log(`  ${f.pid}: key="${f.key}" <- ${f.labels.join(", ")}`);
console.log();
console.log("Sample of merges (first 15):");
for (const m of merged.slice(0, 15)) console.log(`  ${m.pid}: -> "${m.mergedValue}"`);
