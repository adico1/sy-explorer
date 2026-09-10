import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const sourceMapUrl = new URL("../src/sy.source-map.json", import.meta.url);
const textContextUrl = new URL("../src/sy.text-context.json", import.meta.url);
const corpusScopeUrl = new URL("../src/sy.corpus-scope.json", import.meta.url);
const outputUrl = new URL("../src/sy.editorial-candidate-inventory.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const sourceMapText = fs.readFileSync(sourceMapUrl, "utf8");
const textContextText = fs.readFileSync(textContextUrl, "utf8");
const corpusScopeText = fs.readFileSync(corpusScopeUrl, "utf8");
const sourceMap = JSON.parse(sourceMapText);
const textContext = JSON.parse(textContextText);
const corpusScope = JSON.parse(corpusScopeText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

for (const input of [sourceMap, textContext, corpusScope]) {
  if (input.source.sha256 !== sourceHash) throw new Error(`Sealed input ${input.id} does not match the source.`);
}

const rootStart = sourceMap.source.root_code_unit_range.start;
const rootEnd = sourceMap.source.root_code_unit_range.end;
const overlaps = (left, right) => left.start < right.end && right.start < left.end;
const textNodes = textContext.text_nodes;
const scopeByNode = new Map(corpusScope.decisions.map((item) => [item.source_node_id, item.decision]));

function contextFor(range) {
  const members = textNodes.filter((node) => overlaps(range, node.source_code_unit_range));
  return {
    source_node_ids: members.map((node) => node.source_node_id),
    reading_unit_ids: [...new Set(members.map((node) => node.reading_unit_id).filter(Boolean))],
    scope_decisions: members.map((node) => ({
      source_node_id: node.source_node_id,
      ...scopeByNode.get(node.source_node_id),
    })),
  };
}

const smallStack = [];
const smallRanges = [];
for (const node of sourceMap.nodes) {
  if (node.tag_name !== "small") continue;
  if (node.kind === "element_open") smallStack.push(node);
  if (node.kind === "element_close") {
    const open = smallStack.pop();
    if (!open) throw new Error("Unmatched closing small element.");
    smallRanges.push({
      marker_kind: "small_element",
      range: { start: open.code_unit_range.start, end: node.code_unit_range.end },
      content_range: { start: open.code_unit_range.end, end: node.code_unit_range.start },
    });
  }
}
if (smallStack.length) throw new Error("Unmatched opening small element.");
smallRanges.sort((left, right) => left.range.start - right.range.start || right.range.end - left.range.end);

function pairedRanges(openChar, closeChar, markerKind) {
  const stack = [];
  const ranges = [];
  for (let index = rootStart; index < rootEnd; index += 1) {
    const char = source[index];
    if (char === openChar) stack.push(index);
    if (char === closeChar) {
      const start = stack.pop();
      if (start === undefined) throw new Error(`Unmatched ${closeChar}.`);
      ranges.push({
        marker_kind: markerKind,
        range: { start, end: index + 1 },
        content_range: { start: start + 1, end: index },
      });
    }
  }
  if (stack.length) throw new Error(`Unmatched ${openChar}.`);
  return ranges.sort((left, right) => left.range.start - right.range.start || right.range.end - left.range.end);
}

const structuralRanges = [
  ...smallRanges,
  ...pairedRanges("[", "]", "square_bracket_pair"),
  ...pairedRanges("(", ")", "parenthesis_pair"),
].sort((left, right) => left.range.start - right.range.start || right.range.end - left.range.end);

const candidates = structuralRanges.map((candidate, index) => {
  const raw = source.slice(candidate.range.start, candidate.range.end);
  const contentRaw = source.slice(candidate.content_range.start, candidate.content_range.end);
  return {
    id: `editorial-candidate.${String(index + 1).padStart(3, "0")}`,
    ordinal: index,
    evidence_type: "structural_marker_only",
    marker_kind: candidate.marker_kind,
    decision: {
      corpus_role: "unknown",
      editorial_addition_status: "unknown",
      action: "none",
      authority: "none_pending_user_decision",
    },
    source_code_unit_range: candidate.range,
    content_code_unit_range: candidate.content_range,
    raw,
    raw_sha256: sha256(Buffer.from(raw, "utf8")),
    content_raw: contentRaw,
    content_raw_sha256: sha256(Buffer.from(contentRaw, "utf8")),
    immediate_context: source.slice(Math.max(rootStart, candidate.range.start - 24), Math.min(rootEnd, candidate.range.end + 24)),
    ...contextFor(candidate.range),
  };
});

for (const candidate of candidates) {
  candidate.overlapping_candidate_ids = candidates
    .filter((other) => other.id !== candidate.id && overlaps(candidate.source_code_unit_range, other.source_code_unit_range))
    .map((other) => other.id);
}

const kindCounts = Object.fromEntries(["small_element", "square_bracket_pair", "parenthesis_pair"]
  .map((kind) => [kind, candidates.filter((item) => item.marker_kind === kind).length]));
const proof = {
  exactly_zero_small_elements_inventoried: kindCounts.small_element === 0,
  exactly_three_square_bracket_pairs_inventoried: kindCounts.square_bracket_pair === 3,
  exactly_four_parenthesis_pairs_inventoried: kindCounts.parenthesis_pair === 4,
  every_candidate_matches_exact_source_range: candidates.every((item) =>
    source.slice(item.source_code_unit_range.start, item.source_code_unit_range.end) === item.raw
    && source.slice(item.content_code_unit_range.start, item.content_code_unit_range.end) === item.content_raw),
  every_candidate_has_source_context: candidates.every((item) => item.source_node_ids.length > 0),
  every_source_node_reference_resolves: candidates.every((item) => item.source_node_ids.every((id) =>
    textNodes.some((node) => node.source_node_id === id))),
  every_overlap_reference_is_symmetric: candidates.every((item) => item.overlapping_candidate_ids.every((id) =>
    candidates.find((other) => other.id === id)?.overlapping_candidate_ids.includes(item.id))),
  every_corpus_and_editorial_role_remains_unknown: candidates.every((item) =>
    item.decision.corpus_role === "unknown"
    && item.decision.editorial_addition_status === "unknown"
    && item.decision.action === "none"),
  no_source_or_corpus_change_performed: true,
  deterministic_output: true,
  candidate_count: candidates.length,
  marker_kind_counts: kindCounts,
};
if (Object.entries(proof).filter(([, value]) => typeof value === "boolean").some(([, value]) => !value)) {
  throw new Error("Editorial-candidate inventory proof failed.");
}

const artifact = {
  id: "sy.editorial-addition-candidate-inventory",
  version: "1.0.0",
  status: "sealed_observation",
  semantic_status: "candidates_only_no_editorial_or_corpus_decision",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    source_map_sha256: sha256(Buffer.from(sourceMapText, "utf8")),
    text_context_sha256: sha256(Buffer.from(textContextText, "utf8")),
    corpus_scope_sha256: sha256(Buffer.from(corpusScopeText, "utf8")),
  },
  rules: {
    included_marker_kinds: ["small_element", "square_bracket_pair", "parenthesis_pair"],
    marker_meaning: "candidate_only",
    corpus_decision: "forbidden",
    removal: "forbidden",
    interpretation: "forbidden",
    source_normalization: "none",
  },
  proof,
  candidates,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.editorial-candidate-inventory.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...proof, source_sha256: sourceHash }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...proof, source_sha256: sourceHash }, null, 2));
}
