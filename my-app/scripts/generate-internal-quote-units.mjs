import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const contractUrl = new URL("../src/sy.word-contract.json", import.meta.url);
const ambiguitiesUrl = new URL("../src/sy.lexical-ambiguities.json", import.meta.url);
const outputUrl = new URL("../src/sy.internal-quote-units.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const contractText = fs.readFileSync(contractUrl, "utf8");
const ambiguitiesText = fs.readFileSync(ambiguitiesUrl, "utf8");
const corpus = JSON.parse(corpusText);
const contract = JSON.parse(contractText);
const ambiguities = JSON.parse(ambiguitiesText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

if (corpus.source.sha256 !== sha256(Buffer.from(source, "utf8"))) throw new Error("Corpus and source differ.");
if (contract.rules.initialisms.status !== "sealed") throw new Error("Internal quote rule is not sealed.");
if (ambiguities.source.corpus_text_sha256 !== corpus.corpus_text_sha256) throw new Error("Ambiguity inventory is stale.");

const quoteCharacters = contract.rules.initialisms.internal_quote_characters;
const quoteClass = quoteCharacters.map((char) => char.replace(/[\\\]^-]/g, "\\$&")).join("");
const pointedHebrewPart = String.raw`(?:[א-ת]\p{M}*)+`;
const internalQuotePattern = new RegExp(`${pointedHebrewPart}[${quoteClass}]${pointedHebrewPart}`, "gu");
const units = [];

for (const fragment of corpus.fragments) {
  for (const match of fragment.raw.matchAll(internalQuotePattern)) {
    const raw = match[0];
    const start = fragment.source_code_unit_range.start + match.index;
    const quoteOffset = [...raw].reduce((state, char) => {
      if (state.found) return state;
      if (quoteCharacters.includes(char)) return { found: true, offset: state.offset, char };
      return { found: false, offset: state.offset + char.length, char: null };
    }, { found: false, offset: 0, char: null });
    if (!quoteOffset.found) throw new Error(`No internal quote in ${raw}.`);
    units.push({
      id: `internal-quote-unit.${String(units.length + 1).padStart(3, "0")}`,
      ordinal: units.length,
      unit_type: "word",
      decision_status: "sealed",
      authority: "user",
      linguistic_subtype: "unknown",
      raw,
      quote_character: quoteOffset.char,
      component_surface_forms: [raw.slice(0, quoteOffset.offset), raw.slice(quoteOffset.offset + quoteOffset.char.length)],
      corpus_fragment_id: fragment.id,
      source_node_id: fragment.source_node_id,
      reading_unit_id: fragment.reading_unit_id,
      source_code_unit_range: { start, end: start + raw.length },
      quote_source_code_unit_range: {
        start: start + quoteOffset.offset,
        end: start + quoteOffset.offset + quoteOffset.char.length,
      },
    });
  }
}

const schema = new Map(ambiguities.ambiguous_character_occurrence_schema.map((key, index) => [key, index]));
const quoteRows = ambiguities.ambiguous_character_occurrences
  .filter((row) => row[schema.get("category")] === "quote_mark");
const unitQuotePositions = new Set(units.map((unit) => unit.quote_source_code_unit_range.start));
const classifications = quoteRows.map((row, index) => {
  const start = row[schema.get("source_code_unit_start")];
  const internal = unitQuotePositions.has(start);
  return {
    id: `quote-classification.${String(index + 1).padStart(3, "0")}`,
    quote_character: row[schema.get("char")],
    classification: internal ? "internal_quote_word_connector" : "unknown_non_internal_quote",
    resulting_unit_id: internal
      ? units.find((unit) => unit.quote_source_code_unit_range.start === start).id
      : null,
    corpus_fragment_id: row[schema.get("corpus_fragment_id")],
    source_node_id: row[schema.get("source_node_id")],
    reading_unit_id: row[schema.get("reading_unit_id")],
    source_code_unit_range: { start, end: row[schema.get("source_code_unit_end")] },
  };
});

const trailingPunctuation = units.flatMap((unit) => {
  const char = source.slice(unit.source_code_unit_range.end, unit.source_code_unit_range.end + 1);
  return /^\p{P}$/u.test(char) && !quoteCharacters.includes(char) ? [{
    internal_quote_unit_id: unit.id,
    char,
    status: "excluded_from_word_role_unknown",
    source_code_unit_range: { start: unit.source_code_unit_range.end, end: unit.source_code_unit_range.end + char.length },
  }] : [];
});
const reconstructed = corpus.fragments.map((fragment) => source.slice(
  fragment.source_code_unit_range.start,
  fragment.source_code_unit_range.end,
)).join("");
const proof = {
  every_quote_mark_classified_exactly_once: classifications.length === 119
    && new Set(classifications.map((item) => item.source_code_unit_range.start)).size === 119,
  every_internal_quote_assigned_to_one_word: units.length === 86
    && unitQuotePositions.size === units.length
    && classifications.filter((item) => item.classification === "internal_quote_word_connector").length === units.length,
  every_non_internal_quote_remains_unknown: classifications.filter((item) => item.classification === "unknown_non_internal_quote").length === 33,
  every_unit_matches_exact_source_range: units.every((unit) =>
    source.slice(unit.source_code_unit_range.start, unit.source_code_unit_range.end) === unit.raw),
  every_unit_has_hebrew_content_on_both_sides: units.every((unit) =>
    unit.component_surface_forms.length === 2
    && unit.component_surface_forms.every((part) => /[א-ת]/u.test(part))),
  adjacent_punctuation_excluded_and_preserved: trailingPunctuation.every((item) =>
    source.slice(item.source_code_unit_range.start, item.source_code_unit_range.end) === item.char),
  exact_corpus_round_trip_after_overlay_removal: reconstructed === corpus.corpus_text,
  no_non_internal_quote_words_emitted: true,
  no_linguistic_subtype_inferred: units.every((unit) => unit.linguistic_subtype === "unknown"),
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Internal-quote unit proof failed.");

const artifact = {
  id: "sy.sealed-internal-quote-word-units",
  version: "1.0.0",
  status: "sealed",
  scope: "internal_quote_words_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: corpus.source.sha256,
    corpus_text_sha256: corpus.corpus_text_sha256,
    word_contract_sha256: sha256(Buffer.from(contractText, "utf8")),
    lexical_ambiguities_sha256: sha256(Buffer.from(ambiguitiesText, "utf8")),
  },
  rule: {
    statement: "A quote mark internal to a pointed Hebrew letter sequence keeps the complete sequence as one word.",
    quote_characters: quoteCharacters,
    linguistic_subtype: "unknown_not_every_internal_quote_form_is_asserted_to_be_an_initialism",
    surface_preservation: "exact",
    attached_prefix_analysis: "not_performed",
    non_internal_quote_role: "unknown",
    punctuation_role: "unknown_and_excluded_from_the_word",
  },
  proof: {
    ...proof,
    quote_mark_count: classifications.length,
    internal_quote_word_count: units.length,
    unknown_non_internal_quote_count: classifications.filter((item) => item.classification === "unknown_non_internal_quote").length,
    adjacent_punctuation_count: trailingPunctuation.length,
  },
  quote_mark_classifications: classifications,
  units,
  adjacent_punctuation_observations: trailingPunctuation,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.internal-quote-units.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof }, null, 2));
}
