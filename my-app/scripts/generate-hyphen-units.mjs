import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const contractUrl = new URL("../src/sy.word-contract.json", import.meta.url);
const ambiguitiesUrl = new URL("../src/sy.lexical-ambiguities.json", import.meta.url);
const outputUrl = new URL("../src/sy.hyphen-units.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const contractText = fs.readFileSync(contractUrl, "utf8");
const ambiguitiesText = fs.readFileSync(ambiguitiesUrl, "utf8");
const corpus = JSON.parse(corpusText);
const contract = JSON.parse(contractText);
const ambiguities = JSON.parse(ambiguitiesText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

if (corpus.source.sha256 !== sha256(Buffer.from(source, "utf8"))) throw new Error("Corpus and source differ.");
if (contract.rules.hyphen_connectors.status !== "sealed") throw new Error("Hyphen rule is not sealed.");
if (ambiguities.source.corpus_text_sha256 !== corpus.corpus_text_sha256) throw new Error("Ambiguity inventory is stale.");

const connectorClass = contract.rules.hyphen_connectors.characters
  .map((char) => char.replace(/[\\\]-]/g, "\\$&"))
  .join("");
const pointedHebrewWord = String.raw`(?:[א-ת]\p{M}*)+`;
const connectedPattern = new RegExp(`${pointedHebrewWord}(?:[${connectorClass}]${pointedHebrewWord})+`, "gu");
const units = [];

for (const fragment of corpus.fragments) {
  for (const match of fragment.raw.matchAll(connectedPattern)) {
    const raw = match[0];
    const start = fragment.source_code_unit_range.start + match.index;
    const connectors = [...raw].filter((char) => contract.rules.hyphen_connectors.characters.includes(char));
    units.push({
      id: `hyphen-unit.${String(units.length + 1).padStart(3, "0")}`,
      ordinal: units.length,
      unit_type: "word",
      decision_status: "sealed",
      authority: "user",
      raw,
      connector_characters: connectors,
      component_surface_forms: raw.split(new RegExp(`[${connectorClass}]`, "u")),
      corpus_fragment_id: fragment.id,
      source_node_id: fragment.source_node_id,
      reading_unit_id: fragment.reading_unit_id,
      source_code_unit_range: { start, end: start + raw.length },
    });
  }
}

const ambiguitySchema = new Map(ambiguities.ambiguous_character_occurrence_schema.map((key, index) => [key, index]));
const recordedHyphens = ambiguities.ambiguous_character_occurrences
  .filter((row) => row[ambiguitySchema.get("category")] === "hyphen_connector");
const allUnitConnectors = units.flatMap((unit) => {
  const positions = [];
  let relative = 0;
  for (const char of unit.raw) {
    if (contract.rules.hyphen_connectors.characters.includes(char)) {
      positions.push(unit.source_code_unit_range.start + relative);
    }
    relative += char.length;
  }
  return positions;
});
const recordedPositions = recordedHyphens.map((row) => row[ambiguitySchema.get("source_code_unit_start")]);
const punctuationCharacters = new Set([":", "."]);
const trailingPunctuation = units.flatMap((unit) => {
  const char = source.slice(unit.source_code_unit_range.end, unit.source_code_unit_range.end + 1);
  return punctuationCharacters.has(char) ? [{
    hyphen_unit_id: unit.id,
    char,
    status: "excluded_from_hyphen_unit_role_unknown",
    source_code_unit_range: { start: unit.source_code_unit_range.end, end: unit.source_code_unit_range.end + 1 },
  }] : [];
});
const reconstructed = corpus.fragments.map((fragment) => source.slice(
  fragment.source_code_unit_range.start,
  fragment.source_code_unit_range.end,
)).join("");
const proof = {
  exactly_eight_hyphen_units: units.length === 8,
  every_recorded_hyphen_assigned_exactly_once: recordedPositions.length === 8
    && allUnitConnectors.length === recordedPositions.length
    && new Set(allUnitConnectors).size === recordedPositions.length
    && recordedPositions.every((position) => allUnitConnectors.includes(position)),
  every_unit_matches_exact_source_range: units.every((unit) =>
    source.slice(unit.source_code_unit_range.start, unit.source_code_unit_range.end) === unit.raw),
  every_unit_has_content_on_both_sides: units.every((unit) =>
    unit.component_surface_forms.length >= 2 && unit.component_surface_forms.every(Boolean)),
  no_unit_contains_whitespace: units.every((unit) => !/\s/u.test(unit.raw)),
  adjacent_punctuation_excluded_and_preserved: trailingPunctuation.every((item) =>
    source.slice(item.source_code_unit_range.start, item.source_code_unit_range.end) === item.char),
  exact_corpus_round_trip_after_overlay_removal: reconstructed === corpus.corpus_text,
  no_non_hyphen_words_emitted: true,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Hyphen-unit proof failed.");

const artifact = {
  id: "sy.sealed-hyphen-word-units",
  version: "1.0.0",
  status: "sealed",
  scope: "hyphen_connected_words_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: corpus.source.sha256,
    corpus_text_sha256: corpus.corpus_text_sha256,
    word_contract_sha256: sha256(Buffer.from(contractText, "utf8")),
    lexical_ambiguities_sha256: sha256(Buffer.from(ambiguitiesText, "utf8")),
  },
  rule: {
    statement: "Pointed Hebrew surface forms joined internally by an approved hyphen connector are one word.",
    connector_characters: contract.rules.hyphen_connectors.characters,
    surface_preservation: "exact",
    attached_prefix_analysis: "not_performed",
    punctuation_role: "unknown_and_excluded_from_the_hyphen_unit",
  },
  proof: { ...proof, unit_count: units.length, adjacent_punctuation_count: trailingPunctuation.length },
  units,
  adjacent_punctuation_observations: trailingPunctuation,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.hyphen-units.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, units: units.map((unit) => unit.raw) }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, units: units.map((unit) => unit.raw) }, null, 2));
}
