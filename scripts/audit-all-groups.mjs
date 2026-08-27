import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const content = readFileSync("docs/pipeline-prep/batch-01-confirmation-groups.md", "utf8");
const lines = content.split("\n");
const dataRows = lines.filter((l) => l.startsWith("|") && l.includes("P") && !l.includes("---") && !l.includes("Label"));

for (const row of dataRows) {
  const cells = row.split("|").map((c) => c.trim());
  if (cells.length < 5) continue;
  const [, label, value, count, idsCell] = cells;
  if (!idsCell || !/^P\d/.test(idsCell)) continue;

  const ids = idsCell.split(",").map((s) => s.trim()).filter(Boolean);
  const sampleIds = [ids[0], ids[Math.floor(ids.length / 2)], ids[ids.length - 1]].filter(Boolean);

  console.log(`\n### ${label} = ${value} (${count} products)`);

  for (const id of sampleIds) {
    const draftPath = join("content-pipeline", "drafts", `${id}.json`);
    if (!existsSync(draftPath)) {
      console.log(`  ${id}: draft not found`);
      continue;
    }
    const draft = JSON.parse(readFileSync(draftPath, "utf8"));
    const match = (draft.attributes || []).find((a) => a.label === label && a.value === value);
    if (!match) {
      console.log(`  ${id}: NO MATCHING ATTRIBUTE — mismatch`);
      continue;
    }
    const quote = match.source?.quotedPhrase ?? "(no quote)";
    const stoneFlag = match.stoneSource ? ` [${match.stoneSource}]` : "";
    console.log(`  ${id}: "${quote}"${stoneFlag}`);
  }
}
