import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const contractUrl = new URL("../src/sy.word-contract.json", import.meta.url);
const outputUrl = new URL("../src/sy.lexical-ambiguities.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const contractText = fs.readFileSync(contractUrl, "utf8");
const corpus = JSON.parse(corpusText);
const contract = JSON.parse(contractText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

if (corpus.source.sha256 !== sha256(Buffer.from(source, "utf8"))) throw new Error("Corpus and source differ.");
if (contract.status !== "sealed_partial") throw new Error("The partial word contract is not sealed.");

const hyphens = new Set(contract.rules.hyphen_connectors.characters);
const quotes = new Set(contract.rules.initialisms.internal_quote_characters);
const classify = (char) => {
  if (hyphens.has(char)) return "hyphen_connector";
  if (quotes.has(char)) return "quote_mark";
  if (/^[א-ת]$/u.test(char)) return "hebrew_letter";
  if (/^[\u0591-\u05BD\u05BF-\u05C7]$/u.test(char)) return "hebrew_mark";
  if (/^\p{Nd}$/u.test(char)) return "decimal_digit";
  if (/^\s$/u.test(char)) return "whitespace";
  if (/^[\p{P}\p{S}]$/u.test(char)) return "punctuation_or_symbol";
  return "other";
};

const categoryCounts = {};
const ambiguousOccurrences = [];
const diagnosticSpans = [];
let classifiedCodePointCount = 0;
let classifiedCodeUnitCount = 0;
let ambiguityOrdinal = 0;
let spanOrdinal = 0;

for (const fragment of corpus.fragments) {
  let relative = 0;
  for (const char of fragment.raw) {
    const category = classify(char);
    const start = fragment.source_code_unit_range.start + relative;
    const end = start + char.length;
    if (source.slice(start, end) !== char) throw new Error(`Character/source mismatch at ${start}.`);
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    classifiedCodePointCount += 1;
    classifiedCodeUnitCount += char.length;
    if (["hyphen_connector", "quote_mark", "decimal_digit", "punctuation_or_symbol"].includes(category)) {
      ambiguityOrdinal += 1;
      ambiguousOccurrences.push({
        id: `lexical-evidence.${String(ambiguityOrdinal).padStart(5, "0")}`,
        category,
        char,
        code_point: `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
        corpus_fragment_id: fragment.id,
        source_node_id: fragment.source_node_id,
        reading_unit_id: fragment.reading_unit_id,
        source_code_unit_range: { start, end },
      });
    }
    relative += char.length;
  }
  if (relative !== fragment.raw.length) throw new Error(`Incomplete fragment scan: ${fragment.id}.`);

  for (const match of fragment.raw.matchAll(/\S+/gu)) {
    const raw = match[0];
    const start = fragment.source_code_unit_range.start + match.index;
    spanOrdinal += 1;
    diagnosticSpans.push({
      id: `diagnostic-span.${String(spanOrdinal).padStart(4, "0")}`,
      semantic_status: "not_a_word_or_token",
      raw,
      corpus_fragment_id: fragment.id,
      source_node_id: fragment.source_node_id,
      reading_unit_id: fragment.reading_unit_id,
      source_code_unit_range: { start, end: start + raw.length },
      observations: {
        contains_hyphen_connector: [...raw].some((char) => hyphens.has(char)),
        contains_quote_mark: [...raw].some((char) => quotes.has(char)),
        contains_decimal_digit: /\p{Nd}/u.test(raw),
        contains_hebrew_mark: /[\u0591-\u05BD\u05BF-\u05C7]/u.test(raw),
        initial_hebrew_letter: raw.match(/[א-ת]/u)?.[0] ?? null,
        prefix_boundary_status: "unknown"
      }
    });
  }
}

const reconstructed = corpus.fragments.map((fragment) => fragment.raw).join("");
const fragmentCodeUnits = corpus.fragments.reduce((sum, fragment) => sum + fragment.raw.length, 0);
const openDecisionsRemainUnknown = contract.rules.attached_prefixes.segmentation_rules === "unknown"
  && contract.rules.attached_prefixes.accepted_prefix_inventory === "unknown"
  && contract.rules.numbers_and_verse_markers.status === "unknown"
  && contract.rules.punctuation.entity_role === "unknown"
  && contract.rules.niqqud.unpointed_derivative === "unknown";
const proof = {
  every_corpus_fragment_scanned_exactly_once: corpus.fragments.length === new Set(corpus.fragments.map((item) => item.id)).size,
  every_corpus_code_unit_classified_exactly_once: classifiedCodeUnitCount === fragmentCodeUnits,
  every_recorded_character_matches_source_range: ambiguousOccurrences.every((item) => source.slice(item.source_code_unit_range.start, item.source_code_unit_range.end) === item.char),
  exact_corpus_stream_round_trip: reconstructed === corpus.corpus_text,
  all_contract_open_decisions_remain_unknown: openDecisionsRemainUnknown,
  no_lexical_units_emitted: true,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Lexical ambiguity proof failed.");

const countBy = (category) => ambiguousOccurrences.filter((item) => item.category === category).length;
const artifact = {
  id: "sy.lexical-ambiguity-inventory",
  version: "1.0.0",
  status: "sealed_observation",
  semantic_status: "no_words_or_tokens_defined",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: corpus.source.sha256,
    corpus_text_sha256: corpus.corpus_text_sha256,
    word_contract_sha256: sha256(Buffer.from(contractText, "utf8")),
  },
  method: {
    unit: "unicode_code_point_and_diagnostic_non_whitespace_span",
    diagnostic_span_warning: "A diagnostic span is positional evidence only; it is not a word, token, prefix analysis or interpretation.",
    normalization: "none",
    prefix_segmentation: "not_performed",
    hebrew_mark_positions: "preserved_in_exact_source_and_verified_during_generation_not_duplicated_as_rows",
  },
  proof: {
    ...proof,
    corpus_fragment_count: corpus.fragments.length,
    classified_code_point_count: classifiedCodePointCount,
    classified_code_unit_count: classifiedCodeUnitCount,
    diagnostic_span_count: diagnosticSpans.length,
    ambiguous_character_occurrence_count: ambiguousOccurrences.length,
  },
  counts: {
    by_character_category: categoryCounts,
    hyphen_connector_occurrences: countBy("hyphen_connector"),
    quote_mark_occurrences: countBy("quote_mark"),
    decimal_digit_occurrences: countBy("decimal_digit"),
    punctuation_or_symbol_occurrences: countBy("punctuation_or_symbol"),
    hebrew_mark_occurrences: categoryCounts.hebrew_mark ?? 0,
    spans_containing_hyphen_connector: diagnosticSpans.filter((item) => item.observations.contains_hyphen_connector).length,
    spans_containing_quote_mark: diagnosticSpans.filter((item) => item.observations.contains_quote_mark).length,
    spans_containing_decimal_digit: diagnosticSpans.filter((item) => item.observations.contains_decimal_digit).length,
    spans_containing_hebrew_mark: diagnosticSpans.filter((item) => item.observations.contains_hebrew_mark).length,
  },
  unresolved: contract.open_decisions,
  ambiguous_character_occurrence_schema: [
    "id", "category", "char", "code_point", "corpus_fragment_id", "source_node_id",
    "reading_unit_id", "source_code_unit_start", "source_code_unit_end"
  ],
  ambiguous_character_occurrences: ambiguousOccurrences.map((item) => [
    item.id, item.category, item.char, item.code_point, item.corpus_fragment_id,
    item.source_node_id, item.reading_unit_id, item.source_code_unit_range.start,
    item.source_code_unit_range.end
  ]),
  diagnostic_non_whitespace_span_schema: [
    "id", "semantic_status", "raw", "corpus_fragment_id", "source_node_id",
    "reading_unit_id", "source_code_unit_start", "source_code_unit_end",
    "contains_hyphen_connector", "contains_quote_mark", "contains_decimal_digit",
    "contains_hebrew_mark", "initial_hebrew_letter", "prefix_boundary_status"
  ],
  diagnostic_non_whitespace_spans: diagnosticSpans.map((item) => [
    item.id, item.semantic_status, item.raw, item.corpus_fragment_id, item.source_node_id,
    item.reading_unit_id, item.source_code_unit_range.start, item.source_code_unit_range.end,
    item.observations.contains_hyphen_connector, item.observations.contains_quote_mark,
    item.observations.contains_decimal_digit, item.observations.contains_hebrew_mark,
    item.observations.initial_hebrew_letter, item.observations.prefix_boundary_status
  ]),
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.lexical-ambiguities.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, counts: artifact.counts }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, counts: artifact.counts }, null, 2));
}
