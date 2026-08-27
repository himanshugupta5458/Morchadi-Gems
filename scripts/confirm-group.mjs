import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [,, label, value, ...ids] = process.argv;

if (!label || !value || ids.length === 0) {
  console.error("Usage: node scripts/confirm-group.mjs \"<label>\" \"<value>\" P101 P102 ...");
  process.exit(2);
}

let confirmedCount = 0;
let skipped = [];

for (const id of ids) {
  const draftPath = join("content-pipeline", "drafts", `${id}.json`);
  if (!existsSync(draftPath)) {
    skipped.push(`${id}: draft not found`);
    continue;
  }

  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const attributes = draft.attributes || [];
  const match = attributes.find((a) => a.label === label && a.value === value);

  if (!match) {
    skipped.push(`${id}: no attribute matching label="${label}" value="${value}"`);
    continue;
  }

  if (match.confirmed === true) {
    skipped.push(`${id}: already confirmed, left as-is`);
    continue;
  }

  match.confirmed = true;
  writeFileSync(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
  confirmedCount++;
}

console.log(`Confirmed "${label}: ${value}" on ${confirmedCount} product(s).`);
if (skipped.length > 0) {
  console.log(`\nSkipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  - ${s}`);
}
