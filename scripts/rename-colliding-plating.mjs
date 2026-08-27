import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv[2] !== "--apply";
const dir = "content-pipeline/drafts";

let renamed = [];
let stillFlagged = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json") || file.includes("similarity")) continue;
  const path = join(dir, file);
  const draft = JSON.parse(readFileSync(path, "utf8"));
  const pid = file.replace(".json", "");

  const attrs = draft.attributes || [];
  const synonym = (label) => {
    const l = label.trim().toLowerCase();
    if (["material","materials","metal","base metal","base material","plating","finish"].includes(l)) return "material";
    if (["stone","stones","gem","gems","gemstone","gemstones"].includes(l)) return "stone";
    return l;
  };

  const byKey = {};
  attrs.forEach((a, idx) => {
    byKey[synonym(a.label)] = byKey[synonym(a.label)] || [];
    byKey[synonym(a.label)].push({ idx, attr: a });
  });

  let changed = false;
  for (const [key, group] of Object.entries(byKey)) {
    if (group.length < 2) continue;
    if (key !== "material") { stillFlagged.push({ pid, key, labels: group.map(g=>g.attr.label) }); continue; }

    const labels = group.map((g) => g.attr.label.toLowerCase());
    const materialCount = labels.filter((l) => l === "material" || l === "base material").length;
    if (materialCount !== 1 || group.length !== 2) {
      stillFlagged.push({ pid, key, labels: group.map(g=>g.attr.label) });
      continue;
    }

    // Keep the "Material"/"Base Material" entry's label as-is; rename the plating/finish one
    const platingEntry = group.find((g) => !["material","base material"].includes(g.attr.label.toLowerCase()));
    const oldLabel = platingEntry.attr.label;
    platingEntry.attr.label = "Plating/Coating";
    changed = true;
    renamed.push({ pid, oldLabel, newLabel: "Plating/Coating" });
  }

  if (changed && !dryRun) {
    writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  }
}

console.log(dryRun ? "DRY RUN\n" : "APPLIED\n");
console.log(`Renamed to avoid collision: ${renamed.length}`);
console.log(`Still flagged (not a clean 2-way Material+Plating case): ${stillFlagged.length}\n`);
for (const f of stillFlagged) console.log(`  ${f.pid}: key="${f.key}" <- ${f.labels.join(", ")}`);
