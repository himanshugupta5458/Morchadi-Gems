import { readFileSync } from "node:fs";

const [,, label, value] = process.argv;

if (!label || !value) {
  console.error('Usage: node scripts/get-group-ids.mjs "<label>" "<value>"');
  process.exit(2);
}

const content = readFileSync("docs/pipeline-prep/batch-01-confirmation-groups.md", "utf8");
const lines = content.split("\n");

const dataRows = lines.filter((l) => l.startsWith("|") && l.includes("P") && !l.includes("---"));

const target = dataRows.find((line) => {
  const cells = line.split("|").map((c) => c.trim());
  return cells[1] === label && cells[2] === value;
});

if (!target) {
  console.error(`No row found matching label="${label}" value="${value}".`);
  process.exit(1);
}

const cells = target.split("|").map((c) => c.trim());
const idsCell = cells[4];
const ids = idsCell.split(",").map((s) => s.trim());

console.log(ids.join(" "));
console.error(`\n(${ids.length} ids found for "${label}: ${value}")`);
