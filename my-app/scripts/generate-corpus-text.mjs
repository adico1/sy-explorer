import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const projectionUrl = new URL("../src/sy.text-projection.json", import.meta.url);
const scopeUrl = new URL("../src/sy.corpus-scope.json", import.meta.url);
const unitsUrl = new URL("../src/sy.reading-units.json", import.meta.url);
const hierarchyUrl = new URL("../src/sy.reading-hierarchy.json", import.meta.url);
const outputUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const projectionText = fs.readFileSync(projectionUrl, "utf8");
const scopeText = fs.readFileSync(scopeUrl, "utf8");
const unitsText = fs.readFileSync(unitsUrl, "utf8");
const hierarchyText = fs.readFileSync(hierarchyUrl, "utf8");
const projection = JSON.parse(projectionText);
const scope = JSON.parse(scopeText);
const readingUnits = JSON.parse(unitsText);
const hierarchy = JSON.parse(hierarchyText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

for (const input of [projection, scope, readingUnits, hierarchy]) {
  if (input.source.sha256 !== sourceHash) throw new Error(`Sealed input ${input.id} does not match the source.`);
}

const projectionByNode = new Map();
for (const unit of projection.units) {
  for (const fragment of unit.fragments) {
    projectionByNode.set(fragment.source_node_id, { ...fragment, reading_unit_id: unit.reading_unit_id });
  }
}
for (const fragment of projection.structural_tail.fragments) {
  projectionByNode.set(fragment.source_node_id, { ...fragment, reading_unit_id: null });
}

const unitById = new Map(readingUnits.units.map((unit) => [unit.id, unit]));
const hierarchyByUnit = new Map(hierarchy.reading_unit_assignments.map((item) => [item.reading_unit_id, item]));
const includedDecisions = scope.decisions.filter((item) =>
  ["included", "included_temporarily"].includes(item.decision.status));

const fragments = includedDecisions.map((scopeDecision, index) => {
  const projected = projectionByNode.get(scopeDecision.source_node_id);
  if (!projected) throw new Error(`Included node ${scopeDecision.source_node_id} has no exact projection.`);
  const unit = unitById.get(projected.reading_unit_id);
  const hierarchyAssignment = hierarchyByUnit.get(projected.reading_unit_id);
  if (!unit || !hierarchyAssignment) throw new Error(`Included node ${scopeDecision.source_node_id} has no reading context.`);
  return {
    id: `corpus-fragment.${String(index + 1).padStart(4, "0")}`,
    ordinal: index,
    source_node_id: scopeDecision.source_node_id,
    reading_unit_id: projected.reading_unit_id,
    reading_group_id: unit.group_id,
    scope_status: scopeDecision.decision.status,
    scope_class: scopeDecision.decision.class,
    source_code_unit_range: projected.code_unit_range,
    source_byte_range: projected.byte_range,
    raw: projected.raw,
    raw_sha256: projected.raw_sha256,
    structural_context: {
      containing_section_ids: hierarchyAssignment.containing_section_ids,
      latest_heading_in_source_order: hierarchyAssignment.latest_heading_in_source_order,
    },
  };
});

const units = readingUnits.units.map((readingUnit) => {
  const members = fragments.filter((fragment) => fragment.reading_unit_id === readingUnit.id);
  const rawText = members.map((fragment) => fragment.raw).join("");
  return {
    reading_unit_id: readingUnit.id,
    reading_group_id: readingUnit.group_id,
    corpus_fragment_ids: members.map((fragment) => fragment.id),
    corpus_fragment_count: members.length,
    corpus_content_status: members.length ? "contains_included_text" : "no_included_text",
    raw_text: rawText,
    raw_text_sha256: sha256(Buffer.from(rawText, "utf8")),
  };
});

const includedIds = includedDecisions.map((item) => item.source_node_id);
const fragmentSourceIds = fragments.map((item) => item.source_node_id);
const excludedIds = new Set(scope.decisions
  .filter((item) => item.decision.status === "excluded")
  .map((item) => item.source_node_id));
const everyIncludedNodePresentOnce = fragments.length === includedIds.length
  && new Set(fragmentSourceIds).size === includedIds.length
  && includedIds.every((id) => fragmentSourceIds.includes(id));
const noExcludedNodePresent = fragmentSourceIds.every((id) => !excludedIds.has(id));
const everyFragmentMatchesSource = fragments.every((fragment) => {
  const raw = source.slice(fragment.source_code_unit_range.start, fragment.source_code_unit_range.end);
  return raw === fragment.raw && sha256(Buffer.from(raw, "utf8")) === fragment.raw_sha256;
});
const sourceOrderPreserved = fragments.every((fragment, index) => index === 0
  || fragment.source_code_unit_range.start > fragments[index - 1].source_code_unit_range.start);
const everyFragmentAssignedToOneUnit = units.flatMap((unit) => unit.corpus_fragment_ids).length === fragments.length
  && new Set(units.flatMap((unit) => unit.corpus_fragment_ids)).size === fragments.length;
const exactIncludedStream = includedIds.map((id) => projectionByNode.get(id).raw).join("");
const corpusText = fragments.map((fragment) => fragment.raw).join("");
const exactCorpusStreamRoundTrip = corpusText === exactIncludedStream;
const countsMatchSealedScope = fragments.length === 361
  && fragments.filter((fragment) => fragment.scope_class === "section_body").length === 353
  && fragments.filter((fragment) => fragment.scope_class === "small_text").length === 8;

if (!everyIncludedNodePresentOnce || !noExcludedNodePresent || !everyFragmentMatchesSource
  || !sourceOrderPreserved || !everyFragmentAssignedToOneUnit || !exactCorpusStreamRoundTrip
  || !countsMatchSealedScope) {
  throw new Error("Corpus-text proof failed.");
}

const artifact = {
  id: "sy.sealed-working-corpus-text",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "text_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    text_projection_sha256: sha256(Buffer.from(projectionText, "utf8")),
    corpus_scope_sha256: sha256(Buffer.from(scopeText, "utf8")),
    reading_units_sha256: sha256(Buffer.from(unitsText, "utf8")),
    reading_hierarchy_sha256: sha256(Buffer.from(hierarchyText, "utf8")),
  },
  rules: {
    inclusion: "sealed_corpus_scope",
    ordering: "source_order",
    preservation: "exact_raw_utf8_text_node_content",
    small_status: "included_temporarily",
    headings: "references_only_not_corpus_text",
    whitespace_normalization: "none",
    niqqud_normalization: "none",
    punctuation_normalization: "none",
    tokenization: "forbidden",
    interpretation: "forbidden",
  },
  proof: {
    every_included_node_present_exactly_once: everyIncludedNodePresentOnce,
    no_excluded_node_present: noExcludedNodePresent,
    every_fragment_matches_source_range: everyFragmentMatchesSource,
    included_source_order_preserved: sourceOrderPreserved,
    every_fragment_assigned_to_one_reading_unit: everyFragmentAssignedToOneUnit,
    exact_included_text_stream_round_trip: exactCorpusStreamRoundTrip,
    counts_match_sealed_scope: countsMatchSealedScope,
    deterministic_output: true,
    corpus_fragment_count: fragments.length,
    section_body_fragment_count: fragments.filter((fragment) => fragment.scope_class === "section_body").length,
    temporary_small_fragment_count: fragments.filter((fragment) => fragment.scope_class === "small_text").length,
    reading_unit_count: units.length,
    reading_units_with_corpus_text: units.filter((unit) => unit.corpus_fragment_count > 0).length,
    reading_units_without_corpus_text: units.filter((unit) => unit.corpus_fragment_count === 0).length,
  },
  corpus_text: corpusText,
  corpus_text_sha256: sha256(Buffer.from(corpusText, "utf8")),
  structural_headings: hierarchy.elements
    .filter((element) => ["h1", "h2", "h3"].includes(element.tag_name))
    .map((element) => ({
      id: element.id,
      tag_name: element.tag_name,
      text_raw: element.text_raw,
      source_code_unit_range: element.source_code_unit_range,
      corpus_inclusion: "excluded_structural_reference",
    })),
  fragments,
  units,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.corpus-text.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, corpus_text_sha256: artifact.corpus_text_sha256 }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, corpus_text_sha256: artifact.corpus_text_sha256 }, null, 2));
}
