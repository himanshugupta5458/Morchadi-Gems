import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [,, label, value, ...ids] = process.argv;

if (!label || !value || ids.length === 0) {
  console.error("Usage: node scripts/inspect-group.mjs \"<label>\" \"<value>\" P101 P102 P103 ...");
  console.error("  Prints the raw source text behind a handful of ids from a confirmation group,");
  console.error("  so you can eyeball whether they genuinely share this value or the extraction");
  console.error("  defaulted to a canned phrase.");
  process.exit(2);
}

const sample = ids.slice(0, 5); // never dump more than 5 at once — this is a spot check, not a report

for (const id of sample) {
  const draftPath = join("content-pipeline", "drafts", `${id}.json`);
  if (!existsSync(draftPath)) {
    console.log(`\n=== ${id} — draft not found at ${draftPath} ===`);
    continue;
  }

  const draft = JSON.parse(readFileSync(draftPath, "utf8"));
  const match = (draft.attributes || []).find(
    (a) => a.label === label && a.value === value
  );

  console.log(`\n=== ${id} ===`);
  if (!match) {
    console.log(`  (no attribute matching label="${label}" value="${value}" found — mismatch worth investigating)`);
    continue;
  }

  console.log(`  candidate value : ${match.value}`);
  console.log(`  source origin   : ${match.source?.origin ?? "(none)"}`);
  console.log(`  quoted phrase   : ${match.source?.quotedPhrase ?? "(none)"}`);

  const rawContent = draft.sourceNotes?.rawContent;
  if (rawContent) {
    console.log(`  raw source text : ${rawContent.slice(0, 300)}${rawContent.length > 300 ? "..." : ""}`);
  } else {
    console.log(`  raw source text : (not present in draft — check content-pipeline/incoming/*/${id}/raw-block.json)`);
  }
}

console.log(`\n(${ids.length - sample.length} more ids in this group not shown — sample of ${sample.length} only)`);
