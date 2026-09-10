import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const contractUrl = new URL("../src/sy.word-contract.json", import.meta.url);
const hyphenUrl = new URL("../src/sy.hyphen-units.json", import.meta.url);
const internalQuoteUrl = new URL("../src/sy.internal-quote-units.json", import.meta.url);
const outputUrl = new URL("../src/sy.sealed-word-units.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const contractText = fs.readFileSync(contractUrl, "utf8");
const hyphenText = fs.readFileSync(hyphenUrl, "utf8");
const internalQuoteText = fs.readFileSync(internalQuoteUrl, "utf8");
const corpus = JSON.parse(corpusText);
const contract = JSON.parse(contractText);
const hyphenUnits = JSON.parse(hyphenText);
const internalQuoteUnits = JSON.parse(internalQuoteText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

const sourceHash = sha256(Buffer.from(source, "utf8"));
if (corpus.source.sha256 !== sourceHash) throw new Error("Corpus and source differ.");
if (contract.status !== "sealed_partial") throw new Error("Word contract is not sealed partial.");
for (const artifact of [hyphenUnits, internalQuoteUnits]) {
  if (artifact.status !== "sealed" || artifact.source.sha256 !== sourceHash) {
    throw new Error(`Input ${artifact.id} is not sealed against this source.`);
  }
}

const inputs = [
  ...hyphenUnits.units.map((unit) => ({ unit, recognitionRule: "hyphen", artifact: hyphenUnits.id })),
  ...internalQuoteUnits.units.map((unit) => ({ unit, recognitionRule: "internal_quote", artifact: internalQuoteUnits.id })),
].sort((left, right) => left.unit.source_code_unit_range.start - right.unit.source_code_unit_range.start);

const occurrences = inputs.map(({ unit, recognitionRule, artifact }, index) => ({
  id: `sealed-word-occurrence.${String(index + 1).padStart(3, "0")}`,
  ordinal: index,
  unit_type: "word",
  decision_status: "sealed",
  authority: "user_rule",
  surface_identity_mode: "exact_pointed_source_form",
  raw: unit.raw,
  recognition_rule: recognitionRule,
  source_artifact_id: artifact,
  source_unit_id: unit.id,
  corpus_fragment_id: unit.corpus_fragment_id,
  source_node_id: unit.source_node_id,
  reading_unit_id: unit.reading_unit_id,
  source_code_unit_range: unit.source_code_unit_range,
}));

const frequencyBySurface = new Map();
for (const occurrence of occurrences) {
  const entry = frequencyBySurface.get(occurrence.raw) ?? {
    exact_pointed_surface: occurrence.raw,
    occurrence_count: 0,
    occurrence_ids: [],
    recognition_rules: new Set(),
  };
  entry.occurrence_count += 1;
  entry.occurrence_ids.push(occurrence.id);
  entry.recognition_rules.add(occurrence.recognition_rule);
  frequencyBySurface.set(occurrence.raw, entry);
}
const exactPointedSurfaceCounts = [...frequencyBySurface.values()]
  .map((entry) => ({ ...entry, recognition_rules: [...entry.recognition_rules].sort() }))
  .sort((left, right) => left.exact_pointed_surface.localeCompare(right.exact_pointed_surface, "he"));

const inputKeys = inputs.map(({ unit, artifact }) => `${artifact}:${unit.id}`);
const outputKeys = occurrences.map((item) => `${item.source_artifact_id}:${item.source_unit_id}`);
const sourceRanges = occurrences.map((item) => item.source_code_unit_range);
const reconstructed = corpus.fragments.map((fragment) => source.slice(
  fragment.source_code_unit_range.start,
  fragment.source_code_unit_range.end,
)).join("");
const proof = {
  exactly_ninety_one_signed_occurrences: occurrences.length === 91,
  every_input_occurrence_included_exactly_once: inputKeys.length === outputKeys.length
    && new Set(outputKeys).size === outputKeys.length
    && inputKeys.every((key) => outputKeys.includes(key)),
  no_occurrence_ranges_overlap: sourceRanges.every((range, index) => index === 0
    || sourceRanges[index - 1].end <= range.start),
  source_order_preserved: sourceRanges.every((range, index) => index === 0
    || sourceRanges[index - 1].start < range.start),
  every_occurrence_matches_exact_source_range: occurrences.every((item) =>
    source.slice(item.source_code_unit_range.start, item.source_code_unit_range.end) === item.raw),
  every_occurrence_identifies_its_recognition_rule: occurrences.every((item) =>
    ["hyphen", "internal_quote"].includes(item.recognition_rule)),
  exact_pointed_frequency_counts_cover_every_occurrence: exactPointedSurfaceCounts
    .reduce((sum, entry) => sum + entry.occurrence_count, 0) === occurrences.length
    && new Set(exactPointedSurfaceCounts.flatMap((entry) => entry.occurrence_ids)).size === occurrences.length,
  exact_corpus_round_trip_after_overlay_removal: reconstructed === corpus.corpus_text,
  no_new_word_occurrences_emitted: occurrences.length === hyphenUnits.units.length + internalQuoteUnits.units.length,
  no_unpointed_identity_emitted: occurrences.every((item) => item.surface_identity_mode === "exact_pointed_source_form"),
  no_prefix_analysis_or_semantic_interpretation_emitted: true,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Unified sealed-word proof failed.");

const artifact = {
  id: "sy.unified-sealed-word-units",
  version: "1.0.0",
  status: "sealed",
  scope: "previously_sealed_word_rules_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    corpus_text_sha256: corpus.corpus_text_sha256,
    word_contract_sha256: sha256(Buffer.from(contractText, "utf8")),
    hyphen_units_sha256: sha256(Buffer.from(hyphenText, "utf8")),
    internal_quote_units_sha256: sha256(Buffer.from(internalQuoteText, "utf8")),
  },
  rules: {
    accepted_recognition_rules: ["hyphen", "internal_quote"],
    surface_identity: "exact_pointed_source_form",
    frequency_grouping: "exact_pointed_source_form_only",
    normalization: "none",
    prefix_analysis: "not_performed",
    repetition_interpretation: "forbidden",
    class_assignment: "forbidden",
    ordinary_non_signed_words: "not_emitted",
  },
  proof: {
    ...proof,
    occurrence_count: occurrences.length,
    hyphen_occurrence_count: occurrences.filter((item) => item.recognition_rule === "hyphen").length,
    internal_quote_occurrence_count: occurrences.filter((item) => item.recognition_rule === "internal_quote").length,
    distinct_exact_pointed_surface_count: exactPointedSurfaceCounts.length,
  },
  exact_pointed_surface_counts: exactPointedSurfaceCounts,
  occurrences,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.sealed-word-units.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof }, null, 2));
}
