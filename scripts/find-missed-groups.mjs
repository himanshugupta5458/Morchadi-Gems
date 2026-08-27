import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const content = readFileSync("docs/pipeline-prep/batch-01-confirmation-groups.md", "utf8");
const lines = content.split("\n");

const singlesIdx = lines.findIndex((l) => l.trim() === "## Fully unique / ungroupable singles");
const groupedSection = lines.slice(0, singlesIdx);

const dataRows = groupedSection.filter((l) => l.startsWith("|") && l.includes("P") && !l.includes("---") && !l.includes("Label"));

let missed = [];

for (const row of dataRows) {
  const cells = row.split("|").map((c) => c.trim());
  if (cells.length < 5) continue;
  const [, label, value, count, idsCell] = cells;
  if (!idsCell || !/^P\d/.test(idsCell)) continue;

  const ids = idsCell.split(",").map((s) => s.trim()).filter(Boolean);
  const firstId = ids[0];
  const draftPath = join("content-pipeline", "drafts", `${firstId}.json`);
  if (!existsSync(draftPath)) continue;

  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const match = (draft.attributes || []).find((a) => a.label === label && a.value === value);

  if (match && match.confirmed !== true) {
    missed.push({ label, value, count, ids });
  }
}

console.log(`Found ${missed.length} grouped-commons rows still unconfirmed (never actually run):\n`);
for (const m of missed) {
  console.log(`"${m.label}" "${m.value}" (${m.count}) -> ${m.ids.join(" ")}`);
}
