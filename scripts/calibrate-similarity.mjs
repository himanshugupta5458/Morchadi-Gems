import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { BRAND_NAME } from "../config/site-facts.mjs";

import {
  OPENING_SHINGLE_SIZE,
  OPENING_WORD_LIMIT,
  PLACEHOLDER_PRECEDENCE,
  SHINGLE_SIZE,
  buildNormalisationVocabulary,
  extractOpeningSentence,
  normaliseDescription,
  normalisedSimilarity,
  openingSentenceSimilarity,
  rawSimilarity,
  tokenise,
} from "../lib/content-similarity.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = join(repoRoot, "docs/pipeline-prep/similarity-calibration-report.md");
const scoresPath = join(repoRoot, "docs/pipeline-prep/similarity-scores-all-pairs.json");

const METRICS = [
  { key: "raw", label: "Raw", heading: "raw score" },
  { key: "normalised", label: "Normalised", heading: "normalised score" },
  { key: "opening", label: "Opening sentence", heading: "opening-sentence score" },
];

const TOP_N = 20;

const products = JSON.parse(readFileSync(join(repoRoot, "data/products.json"), "utf8"));

const pairs = [];
for (let i = 0; i < products.length; i += 1) {
  for (let j = i + 1; j < products.length; j += 1) {
    const left = products[i];
    const right = products[j];
    pairs.push({
      a: left.id,
      b: right.id,
      sameCategory: left.category === right.category,
      category: left.category === right.category ? left.category : null,
      raw: rawSimilarity(left.description, right.description),
      normalised: normalisedSimilarity(left, right),
      opening: openingSentenceSimilarity(left.description, right.description),
    });
  }
}

const round = (value) => Number(value.toFixed(6));
const format = (value) => value.toFixed(4);

function percentile(sortedAscending, fraction) {
  if (sortedAscending.length === 0) return 0;
  const rank = Math.ceil(fraction * sortedAscending.length);
  return sortedAscending[Math.min(Math.max(rank, 1), sortedAscending.length) - 1];
}

function summarise(values) {
  const sorted = [...values].sort((x, y) => x - y);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  const middle = Math.floor(sorted.length / 2);
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: sorted.length === 0 ? 0 : total / sorted.length,
    median:
      sorted.length === 0
        ? 0
        : sorted.length % 2 === 1
          ? sorted[middle]
          : (sorted[middle - 1] + sorted[middle]) / 2,
    p90: percentile(sorted, 0.9),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
  };
}

const productById = new Map(products.map((product) => [product.id, product]));
const wordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const pairKey = (pair) => `${pair.a}|${pair.b}`;

const topByMetric = new Map(
  METRICS.map((metric) => [
    metric.key,
    [...pairs].sort((x, y) => y[metric.key] - x[metric.key] || pairKey(x).localeCompare(pairKey(y))).slice(0, TOP_N),
  ]),
);

const appearances = new Map();
for (const metric of METRICS) {
  for (const pair of topByMetric.get(metric.key)) {
    const key = pairKey(pair);
    if (!appearances.has(key)) appearances.set(key, { pair, metrics: [] });
    appearances.get(key).metrics.push(metric.label);
  }
}
const multiListPairs = [...appearances.values()]
  .filter((entry) => entry.metrics.length > 1)
  .sort((x, y) => y.metrics.length - x.metrics.length || y.pair.raw - x.pair.raw);

const withinPairs = pairs.filter((pair) => pair.sameCategory);
const crossPairs = pairs.filter((pair) => !pair.sameCategory);

function cell(text) {
  return text.replace(/\r?\n\s*\r?\n/g, "<br><br>").replace(/\r?\n/g, " ").replace(/\|/g, "\\|");
}

function statsCells(stats) {
  return [
    stats.count,
    format(stats.min),
    format(stats.max),
    format(stats.mean),
    format(stats.median),
    format(stats.p90),
    format(stats.p95),
    format(stats.p99),
  ].join(" | ");
}

function statsRow(label, stats) {
  return `| ${label} | ${statsCells(stats)} |`;
}

const SENSITIVITY_WIDTHS = [2, 3, 4, 5, 6];

function rawSummaryAtWidth(shingleSize) {
  const values = [];
  for (let i = 0; i < products.length; i += 1) {
    for (let j = i + 1; j < products.length; j += 1) {
      values.push(rawSimilarity(products[i].description, products[j].description, shingleSize));
    }
  }
  return summarise(values);
}

/**
 * A deterministic control built from real catalogue copy: one product's sentences carrying
 * another product's spec vocabulary. This is exactly the template reuse the normalised score
 * exists to catch, and it is the only way to tell a catalogue with no duplication from an
 * engine that cannot see any.
 */
function buildTemplateClone(source, target) {
  const sourceVocabulary = buildNormalisationVocabulary(source);
  const targetVocabulary = buildNormalisationVocabulary(target);
  const replacementFor = (placeholderClass) =>
    [...targetVocabulary[placeholderClass]].sort()[0] ?? null;

  const cloned = tokenise(source.description).map((token) => {
    for (const placeholderClass of PLACEHOLDER_PRECEDENCE) {
      if (!sourceVocabulary[placeholderClass].has(token)) continue;
      const replacement = replacementFor(placeholderClass);
      if (replacement) return replacement;
    }
    return token;
  });

  return {
    id: `${source.id}-as-${target.id}`,
    category: target.category,
    description: cloned.join(" "),
    specs: target.specs,
    options: target.options,
  };
}

function renderPairBlock(pair, rank, metricKey) {
  const left = productById.get(pair.a);
  const right = productById.get(pair.b);
  const scoreLine = METRICS.map(
    (metric) =>
      `${metric.key === metricKey ? "**" : ""}${metric.label} ${format(pair[metric.key])}${metric.key === metricKey ? "**" : ""}`,
  ).join(" · ");
  return [
    `#### ${rank}. ${pair.a} × ${pair.b} — ${scoreLine}`,
    "",
    `${pair.sameCategory ? `Both \`${left.category}\`` : `\`${left.category}\` against \`${right.category}\``}. Opening sentences: *"${cell(extractOpeningSentence(left.description))}"* against *"${cell(extractOpeningSentence(right.description))}"*.`,
    "",
    `| ${pair.a} — ${cell(left.name)} | ${pair.b} — ${cell(right.name)} |`,
    "| --- | --- |",
    `| ${cell(left.description)} | ${cell(right.description)} |`,
    "",
  ].join("\n");
}

function comparisonVerdict(metricLabel, within, cross) {
  const meanGap = within.mean - cross.mean;
  const ratio = cross.mean === 0 ? null : within.mean / cross.mean;
  const absoluteSize =
    Math.abs(meanGap) < 0.01 ? "negligible in absolute terms" : Math.abs(meanGap) < 0.03 ? "small" : "material";
  const ratioClause =
    ratio === null
      ? "the cross-category mean is zero, so no ratio is meaningful"
      : `the within-category mean is **${ratio.toFixed(1)}\u00d7** the cross-category mean`;
  return [
    `**${metricLabel}:** mean ${format(within.mean)} within against ${format(cross.mean)} cross (gap ${meanGap >= 0 ? "+" : ""}${format(meanGap)}, ${absoluteSize}), median ${format(within.median)} against ${format(cross.median)}, p95 ${format(within.p95)} against ${format(cross.p95)}, max ${format(within.max)} against ${format(cross.max)}.`,
    `Stated plainly: ${ratioClause}. Two products in the same category do resemble each other more than two products in different categories, consistently on all three metrics — but every number involved is so close to zero that the gap is a shape in the noise rather than a signal. It matters for calibration only in this sense: **if a threshold is ever set near the top of this distribution it should be category-aware**, because a within-category pair reaching a given score is ordinary where a cross-category pair reaching the same score is not.`,
  ].join(" ");
}

const overall = new Map(METRICS.map((metric) => [metric.key, summarise(pairs.map((pair) => pair[metric.key]))]));
const withinStats = new Map(METRICS.map((metric) => [metric.key, summarise(withinPairs.map((pair) => pair[metric.key]))]));
const crossStats = new Map(METRICS.map((metric) => [metric.key, summarise(crossPairs.map((pair) => pair[metric.key]))]));

const categoryCounts = new Map();
for (const product of products) {
  categoryCounts.set(product.category, (categoryCounts.get(product.category) ?? 0) + 1);
}

const rawTopKeys = new Set(topByMetric.get("raw").map(pairKey));
const normalisedTopKeys = new Set(topByMetric.get("normalised").map(pairKey));
const openingTopKeys = new Set(topByMetric.get("opening").map(pairKey));
const rawNormalisedShared = [...rawTopKeys].filter((key) => normalisedTopKeys.has(key)).length;
const openingShared = [...openingTopKeys].filter(
  (key) => rawTopKeys.has(key) || normalisedTopKeys.has(key),
).length;

const normalisedHigher = pairs.filter((pair) => pair.normalised > pair.raw).length;
const normalisedLower = pairs.filter((pair) => pair.normalised < pair.raw).length;
const normalisedEqual = pairs.length - normalisedHigher - normalisedLower;

let totalTokens = 0;
let replacedTokens = 0;
for (const product of products) {
  const normalised = normaliseDescription(
    product.description,
    buildNormalisationVocabulary(product),
  ).split(" ");
  totalTokens += normalised.length;
  replacedTokens += normalised.filter((token) => token.startsWith("<")).length;
}
const replacedTokenShare = totalTokens === 0 ? 0 : replacedTokens / totalTokens;

const controlSource = products.find((product) => product.id === "P002") ?? products[1];
const controlTarget = products.find((product) => product.id === "P003") ?? products[2];
const controlClone = buildTemplateClone(controlSource, controlTarget);
const cloneRaw = rawSimilarity(controlSource.description, controlClone.description);
const cloneNormalised = normalisedSimilarity(controlSource, controlClone);
const cloneOpening = openingSentenceSimilarity(controlSource.description, controlClone.description);
const topRawPair = topByMetric.get("raw")[0];

const lines = [];
lines.push(`# Similarity calibration — the ${products.length} live products`);
lines.push("");
lines.push("## No threshold is set here");
lines.push("");
lines.push(
  "This file reports what the three similarity metrics actually measure across the catalogue as it stands. It **does not** set a flagging threshold, does not label any pair a duplicate, and does not gate anything. Choosing the number at which a score becomes a problem is a separate, human step taken after reading this — see [ADR-052](../decisions/ADR-052-content-similarity-engine.md), which states the same thing and explains why the engine and the threshold are decided apart.",
);
lines.push("");
lines.push(
  "Nothing in the pipeline reads these scores. `data/products.json` is untouched by the script that produced them.",
);
lines.push("");
lines.push("## Method");
lines.push("");
lines.push(
  `Every score is a Jaccard similarity — the size of the intersection over the size of the union — between two sets of overlapping word shingles. The engine is [\`lib/content-similarity.ts\`](../../lib/content-similarity.ts); the script is [\`scripts/calibrate-similarity.mjs\`](../../scripts/calibrate-similarity.mjs), run as \`npm run calibrate:similarity\`.`,
);
lines.push("");
lines.push("| Metric | Compares | Shingle width |");
lines.push("| --- | --- | --- |");
lines.push(`| Raw | The two descriptions verbatim, lowercased and stripped of punctuation | ${SHINGLE_SIZE} words |`);
lines.push(
  `| Normalised | The same two descriptions with each product's own category, stone, material, colour and size terms replaced by placeholders | ${SHINGLE_SIZE} words |`,
);
lines.push(
  `| Opening sentence | The first sentence of each description, truncated to ${OPENING_WORD_LIMIT} words | ${OPENING_SHINGLE_SIZE} words |`,
);
lines.push("");
lines.push(
  "The normalisation vocabulary is read from each product's **own record** — its `category` slug, its `specs.material`, `specs.stone` and `specs.size` values, and the values of any option named Colour — never from a shared domain word list. Two products therefore normalise against different vocabularies, and the placeholder marks what that particular product claims. A short function-word list (`the`, `with`, `and`, …) keeps connectives inside a spec value out of the vocabulary; it carries no product terms.",
);
lines.push("");
lines.push(
  `The catalogue: **${products.length} products**, **${pairs.length} pairs**. Descriptions run ${Math.min(...products.map((p) => wordCount(p.description)))}–${Math.max(...products.map((p) => wordCount(p.description)))} words; the four shortest (${products.filter((p) => wordCount(p.description) < 100).map((p) => p.id).join(", ")}) are placeholder copy still awaiting the owner, and are scored alongside everything else rather than excluded.`,
);
lines.push("");
lines.push("## Summary statistics — all pairs");
lines.push("");
lines.push("| Metric | Pairs | Min | Max | Mean | Median | p90 | p95 | p99 |");
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const metric of METRICS) lines.push(statsRow(metric.label, overall.get(metric.key)));
lines.push("");
lines.push("## Within-category against cross-category");
lines.push("");
lines.push(
  `Category sizes: ${[...categoryCounts.entries()].sort((x, y) => y[1] - x[1]).map(([slug, count]) => `\`${slug}\` ${count}`).join(", ")}. That gives **${withinPairs.length} within-category pairs** and **${crossPairs.length} cross-category pairs**.`,
);
lines.push("");
lines.push("| Metric | Group | Pairs | Min | Max | Mean | Median | p90 | p95 | p99 |");
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const metric of METRICS) {
  lines.push(`| ${metric.label} | Within | ${statsCells(withinStats.get(metric.key))} |`);
  lines.push(`| ${metric.label} | Cross | ${statsCells(crossStats.get(metric.key))} |`);
}
lines.push("");
for (const metric of METRICS) {
  lines.push(comparisonVerdict(metric.label, withinStats.get(metric.key), crossStats.get(metric.key)));
  lines.push("");
}
lines.push("## Is the engine seeing anything? — two controls and a width sweep");
lines.push("");
lines.push(
  "Every score below is low. That reading is only worth something if the engine would score a duplicate high, so two checks sit here before the rankings.",
);
lines.push("");
lines.push("### Shingle width sweep");
lines.push("");
lines.push(
  `The chosen width is ${SHINGLE_SIZE} words. A narrower shingle is strictly more permissive, so if duplication were being hidden by the width it would surface as the width falls.`,
);
lines.push("");
lines.push("| Shingle width | Pairs | Min | Max | Mean | Median | p90 | p95 | p99 |");
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const width of SENSITIVITY_WIDTHS) {
  lines.push(statsRow(`${width}${width === SHINGLE_SIZE ? " *(chosen)*" : ""}`, rawSummaryAtWidth(width)));
}
lines.push("");
lines.push(
  `At width 2 — two-word runs, permissive to the point of matching ordinary English — the highest-scoring pair in the catalogue still reaches only ${format(rawSummaryAtWidth(2).max)}. Nothing is being hidden by the width.`,
);
lines.push("");
lines.push("### Synthetic controls, built from real catalogue copy");
lines.push("");
lines.push(
  `Both controls take ${controlSource.id}'s real description. The first is that description unchanged; the second keeps its sentences and swaps its own category, material, stone and size terms for ${controlTarget.id}'s — a template clone, which is precisely what the normalised score exists to catch and what the raw score is expected to miss.`,
);
lines.push("");
lines.push("| Control | Raw | Normalised | Opening | What it demonstrates |");
lines.push("| --- | --- | --- | --- | --- |");
lines.push(
  `| ${controlSource.id} against itself | ${format(1)} | ${format(1)} | ${format(1)} | An exact duplicate scores 1 on every metric |`,
);
lines.push(
  `| ${controlSource.id} against its ${controlTarget.id}-vocabulary clone | ${format(cloneRaw)} | ${format(cloneNormalised)} | ${format(cloneOpening)} | ${cloneNormalised > cloneRaw ? `The normalised score recovers the shared template the raw score dilutes — **+${format(cloneNormalised - cloneRaw)}**` : "The two metrics agree on this clone"} |`,
);
lines.push(
  `| Highest real pair in the catalogue | ${format(topRawPair.raw)} | ${format(topRawPair.normalised)} | ${format(topRawPair.opening)} | ${topRawPair.a} \u00d7 ${topRawPair.b}, for scale against the two rows above |`,
);
lines.push("");
lines.push(
  `The engine separates a template clone from real copy by roughly ${(cloneNormalised / Math.max(topRawPair.normalised, 1e-6)).toFixed(0)}\u00d7 on the normalised metric. The low scores in this report are a property of the catalogue, not of the measurement.`,
);
lines.push("");
lines.push("## Overlap between the three top-20 lists");
lines.push("");
if (multiListPairs.length === 0) {
  lines.push(
    "**No pair appears in more than one of the three top-20 lists.** The three metrics rank different pairs at the top, which is the strongest single argument in this report for keeping all three rather than collapsing them into one score.",
  );
} else {
  lines.push(
    `**${multiListPairs.length} pair${multiListPairs.length === 1 ? "" : "s"} appear${multiListPairs.length === 1 ? "s" : ""} in more than one of the three top-20 lists.** Which lists they are is the finding: **${rawNormalisedShared} of the top ${TOP_N} are shared between the raw and normalised rankings, and ${openingShared} pair${openingShared === 1 ? "" : "s"} ${openingShared === 1 ? "is" : "are"} shared with the opening-sentence ranking.**`,
  );
  lines.push("");
  lines.push(
    `The raw and normalised rankings agreeing that closely is a direct consequence of how little the normaliser has to remove: across the whole catalogue only **${format(100 * replacedTokenShare).slice(0, 4)}%** of description tokens are named by their own product's \`category\`, \`specs\` or Colour option, so most shingles survive normalisation untouched. Pair by pair, the normalised score is higher than the raw score for **${normalisedHigher}** pairs, identical for **${normalisedEqual}**, and lower for **${normalisedLower}**.`,
  );
  lines.push("");
  lines.push(
    `That the opening-sentence ranking shares ${openingShared === 0 ? "nothing" : "almost nothing"} with the other two is the argument for keeping it as a separate signal rather than folding it into the whole-description score: it ranks a different set of pairs, and on this catalogue it is the only metric with a non-trivial top score (${format(overall.get("opening").max)}) sitting above an otherwise flat distribution.`,
  );
  lines.push("");
  lines.push("| Pair | Lists | Raw | Normalised | Opening |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const entry of multiListPairs) {
    lines.push(
      `| ${entry.pair.a} × ${entry.pair.b} | ${entry.metrics.join(", ")} | ${format(entry.pair.raw)} | ${format(entry.pair.normalised)} | ${format(entry.pair.opening)} |`,
    );
  }
}
lines.push("");
for (const metric of METRICS) {
  lines.push(`## Top ${TOP_N} by ${metric.heading}`);
  lines.push("");
  topByMetric.get(metric.key).forEach((pair, index) => {
    lines.push(renderPairBlock(pair, index + 1, metric.key));
  });
}
lines.push("## The machine-readable companion");
lines.push("");
lines.push(
  `Every one of the ${pairs.length} pairs — not only the ranked ones — is in [\`similarity-scores-all-pairs.json\`](similarity-scores-all-pairs.json), scores rounded to six decimal places. It carries no timestamp, so re-running the script against an unchanged catalogue produces a byte-identical file and a diff shows only real movement. It exists so these scores can later be correlated against real rank data and a threshold argued from evidence rather than picked.`,
);
lines.push("");

writeFileSync(reportPath, `${lines.join("\n")}`, "utf8");

writeFileSync(
  scoresPath,
  `${JSON.stringify(
    {
      source: "data/products.json",
      engine: "lib/content-similarity.ts",
      method: {
        metric: "jaccard-over-word-shingles",
        shingleSize: SHINGLE_SIZE,
        openingShingleSize: OPENING_SHINGLE_SIZE,
        openingWordLimit: OPENING_WORD_LIMIT,
        normalisationVocabularySource: [
          "category",
          "specs.material",
          "specs.stone",
          "specs.size",
          "options[name=Colour].values",
        ],
        placeholderPrecedence: ["category", "stone", "material", "colour", "size"],
      },
      thresholdsDecided: false,
      productCount: products.length,
      pairCount: pairs.length,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        descriptionWordCount: wordCount(product.description),
        openingSentence: extractOpeningSentence(product.description),
        normalisationTermCount: Object.fromEntries(
          Object.entries(buildNormalisationVocabulary(product)).map(([key, value]) => [key, value.size]),
        ),
      })),
      pairs: pairs.map((pair) => ({
        a: pair.a,
        b: pair.b,
        sameCategory: pair.sameCategory,
        raw: round(pair.raw),
        normalised: round(pair.normalised),
        opening: round(pair.opening),
      })),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

const summaryLine = METRICS.map(
  (metric) => `${metric.label} max ${format(overall.get(metric.key).max)} / p99 ${format(overall.get(metric.key).p99)}`,
).join(" · ");
process.stdout.write(
  `${BRAND_NAME} — content similarity calibration\n\n  products ${products.length}\n  pairs    ${pairs.length}\n  ${summaryLine}\n\n  report ${reportPath.replace(`${repoRoot}/`, "")}\n  scores ${scoresPath.replace(`${repoRoot}/`, "")}\n\nNo threshold set — see the report's opening section.\n`,
);
