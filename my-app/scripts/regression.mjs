import crypto from "node:crypto";
import fs from "node:fs";
import spec from "../src/sy.converter.spec.json" with { type: "json" };
import { createConverter } from "../src/converter-engine.mjs";

const source = fs.readFileSync(new URL("../src/SeferYetzirah.tsx", import.meta.url));
const sourceText = source.toString("utf8");
const sourceHash = crypto.createHash("sha256").update(source).digest("hex");
const corpus = createConverter(spec)(sourceText);
const sourceMap = JSON.parse(fs.readFileSync(new URL("../src/sy.source-map.json", import.meta.url), "utf8"));
const readingUnits = JSON.parse(fs.readFileSync(new URL("../src/sy.reading-units.json", import.meta.url), "utf8"));
const readingHierarchy = JSON.parse(fs.readFileSync(new URL("../src/sy.reading-hierarchy.json", import.meta.url), "utf8"));
const failures = [];
const requireInvariant = (condition, name) => {
  if (!condition) failures.push(name);
};

requireInvariant(sourceHash === spec.source.local_edition.sha256, "sealed_source_hash");
requireInvariant(sourceMap.source.sha256 === sourceHash, "source_map_source_hash");
requireInvariant(sourceMap.status === "sealed", "source_map_sealed");
requireInvariant(sourceMap.semantic_status === "none", "source_map_has_no_semantics");
requireInvariant(sourceMap.proof.every_root_code_unit_covered_exactly_once, "source_map_unique_coverage");
requireInvariant(sourceMap.proof.exact_root_round_trip, "source_map_round_trip");
requireInvariant(sourceMap.proof.deterministic_output, "source_map_deterministic");
requireInvariant(readingUnits.source.sha256 === sourceHash, "reading_units_source_hash");
requireInvariant(readingUnits.status === "sealed", "reading_units_sealed");
requireInvariant(readingUnits.semantic_status === "none", "reading_units_have_no_semantics");
requireInvariant(readingUnits.proof.every_source_map_node_assigned_exactly_once, "reading_units_unique_coverage");
requireInvariant(readingUnits.proof.every_br_used_exactly_once_as_a_boundary, "reading_units_all_br_boundaries");
requireInvariant(readingUnits.proof.exact_root_round_trip, "reading_units_round_trip");
requireInvariant(readingUnits.proof.deterministic_output, "reading_units_deterministic");
requireInvariant(readingUnits.proof.stable_ordinal_ids, "reading_units_stable_ids");
requireInvariant(readingHierarchy.source.sha256 === sourceHash, "reading_hierarchy_source_hash");
requireInvariant(readingHierarchy.status === "sealed", "reading_hierarchy_sealed");
requireInvariant(readingHierarchy.semantic_status === "none", "reading_hierarchy_has_no_semantics");
requireInvariant(readingHierarchy.proof.every_source_map_node_processed_exactly_once, "reading_hierarchy_node_coverage");
requireInvariant(readingHierarchy.proof.every_tracked_element_closed, "reading_hierarchy_elements_closed");
requireInvariant(readingHierarchy.proof.every_reading_unit_assigned_exactly_once, "reading_hierarchy_unit_coverage");
requireInvariant(readingHierarchy.proof.every_reference_resolves, "reading_hierarchy_references");
requireInvariant(readingHierarchy.proof.deterministic_output, "reading_hierarchy_deterministic");
requireInvariant(corpus.validation.valid, "corpus_validation");
requireInvariant(corpus.input === sourceText, "lossless_source");
requireInvariant(corpus.stats.occurrences === 1673, "occurrence_count");
requireInvariant(corpus.stats.names === 740, "name_count");
requireInvariant(corpus.evidence.names.some((name) => name.normalized === "פליאות"), "name_פליאות");
requireInvariant(corpus.structure.records.every((record) => record.boundary_basis === "authoritative_br"), "authoritative_br");
requireInvariant(corpus.units.every((unit) => unit.boundary_authority === "user_interpretation"), "authoritative_reading_groups");

const term = spec.terminology.find((item) => item.term === "מילים כפולות");
requireInvariant(Boolean(term), "term_double_words_exists");
requireInvariant(term?.definition === null, "term_double_words_not_invented");
requireInvariant(term?.status === "awaiting_user_definition", "term_double_words_waiting");
requireInvariant(term?.execution === "forbidden_until_defined", "term_double_words_not_executable");
requireInvariant(term?.assistant_inferences.every((item) => item.status === "rejected"), "assistant_meanings_rejected");
requireInvariant(spec.repetition.authority === "assistant_inference", "repetition_authority_corrected");

const activeCapabilities = spec.capability_registry.filter((item) => item.status === "active");
for (const capability of activeCapabilities) {
  requireInvariant(Boolean(capability.id), "active_capability_has_id");
}

if (failures.length) {
  console.error(JSON.stringify({ valid: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  valid: true,
  version: corpus.version,
  source_sha256: sourceHash,
  occurrences: corpus.stats.occurrences,
  names: corpus.stats.names,
  active_capabilities: activeCapabilities.map((item) => item.id),
  protected_undefined_term: term.term,
}, null, 2));
