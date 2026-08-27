import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const content = readFileSync("docs/pipeline-prep/batch-01-confirmation-groups.md", "utf8");
const lines = content.split("\n");

const singlesIdx = lines.findIndex((l) => l.trim() === "## Fully unique / ungroupable singles");
if (singlesIdx === -1) {
  console.error("Could not find '## Fully unique / ungroupable singles' heading — check the file structure.");
  process.exit(1);
}

const relevantLines = lines.slice(singlesIdx);
const dataRows = relevantLines.filter((l) => l.startsWith("|") && l.includes("P") && !l.includes("---") && !l.includes("Label"));

console.log(`Found ${dataRows.length} rows in the singles section (from line ${singlesIdx + 1} onward).\n`);

for (const row of dataRows) {
  const cells = row.split("|").map((c) => c.trim());
  if (cells.length < 5) continue;
  const [, label, value, count, idsCell] = cells;
  if (!idsCell || !/^P\d/.test(idsCell)) continue;

  const ids = idsCell.split(",").map((s) => s.trim()).filter(Boolean);

  console.log(`### ${label} = ${value} (${count})`);
  for (const id of ids) {
    const draftPath = join("content-pipeline", "drafts", `${id}.json`);
    if (!existsSync(draftPath)) {
      console.log(`  ${id}: draft not found`);
      continue;
    }
    const draft = JSON.parse(readFileSync(draftPath, "utf8"));
    const match = (draft.attributes || []).find((a) => a.label === label && a.value === value);
    if (!match) {
      console.log(`  ${id}: NO MATCHING ATTRIBUTE`);
      continue;
    }
    const quote = match.source?.quotedPhrase ?? "(no quote)";
    const already = match.confirmed === true ? " [ALREADY CONFIRMED]" : "";
    console.log(`  ${id}: "${quote}"${already}`);
  }
  console.log("");
}
