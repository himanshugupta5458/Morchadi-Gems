import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [,, auditFile, startLine, endLine] = process.argv;

if (!auditFile) {
  console.error("Usage: node scripts/confirm-from-audit.mjs <audit-file> [startLine] [endLine]");
  console.error("  Parses inspect-style audit output (### Label = Value (count) blocks with");
  console.error("  '  PNNN: \"quote\"' lines) and confirms every matching attribute found in it.");
  console.error("  Skips any line already marked [ALREADY CONFIRMED] or [NO MATCHING ATTRIBUTE].");
  process.exit(2);
}

let lines = readFileSync(auditFile, "utf8").split("\n");
if (startLine) {
  const s = parseInt(startLine, 10) - 1;
  const e = endLine ? parseInt(endLine, 10) : lines.length;
  lines = lines.slice(s, e);
}

let currentLabel = null;
let currentValue = null;
let confirmedCount = 0;
let skipped = [];
let groupsProcessed = 0;

const draftCache = {};

function loadDraft(id) {
  if (draftCache[id]) return draftCache[id];
  const path = join("content-pipeline", "drafts", `${id}.json`);
  if (!existsSync(path)) return null;
  const draft = JSON.parse(readFileSync(path, "utf8"));
  draftCache[id] = { draft, path };
  return draftCache[id];
}

for (const line of lines) {
  const headerMatch = line.match(/^### (.+) = (.+) \(\d+.*\)$/);
  if (headerMatch) {
    currentLabel = headerMatch[1];
    currentValue = headerMatch[2];
    groupsProcessed++;
    continue;
  }

  const rowMatch = line.match(/^\s*(P\d+):\s*"(.*)"(\s*\[.*\])?$/s);
  if (!rowMatch || !currentLabel) continue;

  const [, id, , flag] = rowMatch;
  if (flag && (flag.includes("ALREADY CONFIRMED") || flag.includes("NO MATCHING"))) continue;

  const cached = loadDraft(id);
  if (!cached) {
    skipped.push(`${id}: draft not found`);
    continue;
  }

  const { draft, path } = cached;
  const match = (draft.attributes || []).find(
    (a) => a.label === currentLabel && a.value === currentValue
  );

  if (!match) {
    skipped.push(`${id}: no attribute matching label="${currentLabel}" value="${currentValue}"`);
    continue;
  }

  if (match.confirmed === true) continue;

  match.confirmed = true;
  confirmedCount++;
}

for (const id of Object.keys(draftCache)) {
  const { draft, path } = draftCache[id];
  writeFileSync(path, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
}

console.log(`Processed ${groupsProcessed} group(s) from ${auditFile}.`);
console.log(`Confirmed ${confirmedCount} attribute(s).`);
if (skipped.length > 0) {
  console.log(`\nSkipped ${skipped.length}:`);
  for (const s of skipped.slice(0, 30)) console.log(`  - ${s}`);
  if (skipped.length > 30) console.log(`  ... and ${skipped.length - 30} more`);
}
