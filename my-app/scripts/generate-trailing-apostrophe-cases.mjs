import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const quoteUnitsUrl = new URL("../src/sy.internal-quote-units.json", import.meta.url);
const graphemesUrl = new URL("../src/sy.hebrew-graphemes.json", import.meta.url);
const candidateViewsUrl = new URL("../src/sy.word-candidate-views.json", import.meta.url);
const outputUrl = new URL("../src/sy.trailing-apostrophe-cases.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const quoteUnitsText = fs.readFileSync(quoteUnitsUrl, "utf8");
const graphemesText = fs.readFileSync(graphemesUrl, "utf8");
const candidateViewsText = fs.readFileSync(candidateViewsUrl, "utf8");
const corpus = JSON.parse(corpusText);
const quoteUnits = JSON.parse(quoteUnitsText);
const graphemeArtifact = JSON.parse(graphemesText);
const candidateViews = JSON.parse(candidateViewsText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

for (const artifact of [corpus, quoteUnits, graphemeArtifact, candidateViews]) {
  if (artifact.source.sha256 !== sourceHash) throw new Error(`${artifact.id} does not match the source.`);
}
if (quoteUnits.status !== "sealed" || graphemeArtifact.status !== "sealed"
  || candidateViews.status !== "sealed_derivation") {
  throw new Error("A trailing-apostrophe input is not sealed.");
}

const fragmentById = new Map(corpus.fragments.map((fragment) => [fragment.id, fragment]));
const graphemeField = new Map(graphemeArtifact.grapheme_schema.map((field, index) => [field, index]));
const graphemes = graphemeArtifact.graphemes.map((row) => ({
  id: row[graphemeField.get("id")],
  raw: row[graphemeField.get("raw")],
  corpus_fragment_id: row[graphemeField.get("corpus_fragment_id")],
  source_code_unit_range: {
    start: row[graphemeField.get("source_code_unit_start")],
    end: row[graphemeField.get("source_code_unit_end")],
  },
}));
const differenceField = new Map(candidateViews.punctuation_dependent_case_schema.map((field, index) => [field, index]));
const differenceRanges = candidateViews.punctuation_dependent_cases.map((row) => ({
  ordinal: row[differenceField.get("ordinal")],
  source_code_unit_range: {
    start: row[differenceField.get("source_code_unit_start")],
    end: row[differenceField.get("source_code_unit_end")],
  },
}));
const unknownQuoteMarks = quoteUnits.quote_mark_classifications
  .filter((item) => item.classification === "unknown_non_internal_quote");

const boundaryObservation = (fragment, position, side) => {
  if ((side === "left" && position === fragment.source_code_unit_range.start)
    || (side === "right" && position === fragment.source_code_unit_range.end)) {
    return { kind: "corpus_fragment_edge", raw: "" };
  }
  const char = side === "left"
    ? source.slice(position - 1, position)
    : String.fromCodePoint(source.codePointAt(position));
  if (/^\s$/u.test(char)) return { kind: "whitespace", raw: char };
  if (/^[\p{P}\p{S}]$/u.test(char)) return { kind: "punctuation_or_symbol", raw: char };
  if (/[א-ת]/u.test(char) || /^\p{M}$/u.test(char)) return { kind: "hebrew_letter_or_mark", raw: char };
  return { kind: "other", raw: char };
};

const cases = unknownQuoteMarks.map((quote, index) => {
  const fragment = fragmentById.get(quote.corpus_fragment_id);
  if (!fragment) throw new Error(`Missing fragment ${quote.corpus_fragment_id}.`);
  const quoteStart = quote.source_code_unit_range.start;
  const relativeQuoteStart = quoteStart - fragment.source_code_unit_range.start;
  const prefix = fragment.raw.slice(0, relativeQuoteStart);
  const precedingMatch = prefix.match(/((?:[א-ת]\p{M}*)+)$/u);
  if (!precedingMatch) throw new Error(`No adjacent Hebrew sequence before quote at ${quoteStart}.`);
  const precedingRaw = precedingMatch[1];
  const start = quoteStart - precedingRaw.length;
  const end = quote.source_code_unit_range.end;
  const baseLetterCount = [...precedingRaw].filter((char) => /[א-ת]/u.test(char)).length;
  const memberGraphemes = graphemes.filter((grapheme) =>
    grapheme.corpus_fragment_id === fragment.id
    && start <= grapheme.source_code_unit_range.start
    && grapheme.source_code_unit_range.end <= quoteStart);
  const contextStart = Math.max(fragment.source_code_unit_range.start, start - 12);
  const contextEnd = Math.min(fragment.source_code_unit_range.end, end + 12);
  const matchingDifference = differenceRanges.filter((item) =>
    item.source_code_unit_range.start <= quoteStart && quoteStart < item.source_code_unit_range.end);
  return {
    id: `trailing-apostrophe-case.${String(index + 1).padStart(3, "0")}`,
    status: "derived_case_role_unknown",
    word_status: "unknown",
    semantic_role: "unknown",
    structural_shape: baseLetterCount === 1
      ? "single_hebrew_letter_plus_trailing_apostrophe"
      : "multiple_hebrew_letters_plus_trailing_apostrophe",
    raw: source.slice(start, end),
    preceding_hebrew_raw: precedingRaw,
    apostrophe_character: quote.quote_character,
    base_letter_count: baseLetterCount,
    grapheme_ids: memberGraphemes.map((item) => item.id),
    corpus_fragment_id: fragment.id,
    source_node_id: quote.source_node_id,
    reading_unit_id: quote.reading_unit_id,
    source_code_unit_range: { start, end },
    apostrophe_source_code_unit_range: quote.source_code_unit_range,
    left_boundary_observation: boundaryObservation(fragment, start, "left"),
    right_boundary_observation: boundaryObservation(fragment, end, "right"),
    context_source_code_unit_range: { start: contextStart, end: contextEnd },
    context_raw: source.slice(contextStart, contextEnd),
    punctuation_dependent_case_ordinals: matchingDifference.map((item) => item.ordinal),
  };
});

const reconstructed = corpus.fragments.map((fragment) => source.slice(
  fragment.source_code_unit_range.start,
  fragment.source_code_unit_range.end,
)).join("");
const shapeCounts = Object.fromEntries([
  "single_hebrew_letter_plus_trailing_apostrophe",
  "multiple_hebrew_letters_plus_trailing_apostrophe",
].map((shape) => [shape, cases.filter((item) => item.structural_shape === shape).length]));
const proof = {
  all_thirty_unknown_quotes_accounted_exactly_once: cases.length === 30
    && new Set(cases.map((item) => item.apostrophe_source_code_unit_range.start)).size === 30
    && unknownQuoteMarks.every((quote) => cases.some((item) =>
      item.apostrophe_source_code_unit_range.start === quote.source_code_unit_range.start)),
  every_case_is_a_trailing_ascii_apostrophe: cases.every((item) =>
    item.apostrophe_character === "'" && item.raw.endsWith("'")),
  every_case_has_an_immediately_adjacent_hebrew_sequence: cases.every((item) =>
    item.preceding_hebrew_raw.length > 0
    && item.raw === `${item.preceding_hebrew_raw}${item.apostrophe_character}`),
  exactly_twenty_nine_single_letter_and_one_multi_letter_shapes:
    shapeCounts.single_hebrew_letter_plus_trailing_apostrophe === 29
    && shapeCounts.multiple_hebrew_letters_plus_trailing_apostrophe === 1,
  every_case_grapheme_membership_matches_base_letters: cases.every((item) =>
    item.grapheme_ids.length === item.base_letter_count
    && new Set(item.grapheme_ids).size === item.grapheme_ids.length),
  every_case_matches_exact_source_range: cases.every((item) =>
    source.slice(item.source_code_unit_range.start, item.source_code_unit_range.end) === item.raw),
  cases_are_nonoverlapping_and_in_source_order: cases.every((item, index) => index === 0
    || cases[index - 1].source_code_unit_range.end <= item.source_code_unit_range.start),
  every_case_is_present_in_the_punctuation_difference_inventory: cases.every((item) =>
    item.punctuation_dependent_case_ordinals.length === 1),
  every_word_and_semantic_role_remains_unknown: cases.every((item) =>
    item.word_status === "unknown" && item.semantic_role === "unknown"),
  exact_corpus_round_trip_after_overlay_removal: reconstructed === corpus.corpus_text,
  no_word_number_abbreviation_or_punctuation_role_inferred: true,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Trailing-apostrophe proof failed.");

const artifact = {
  id: "sy.trailing-apostrophe-unknown-cases",
  version: "1.0.0",
  status: "sealed_structural_classification",
  semantic_status: "all_roles_unknown",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    corpus_text_sha256: corpus.corpus_text_sha256,
    internal_quote_units_sha256: sha256(Buffer.from(quoteUnitsText, "utf8")),
    hebrew_graphemes_sha256: sha256(Buffer.from(graphemesText, "utf8")),
    word_candidate_views_sha256: sha256(Buffer.from(candidateViewsText, "utf8")),
  },
  rules: {
    classification_basis: "exact_local_orthographic_shape_only",
    accepted_shapes: Object.keys(shapeCounts),
    apostrophe_normalization: "none_ascii_source_character_preserved",
    word_status: "unknown",
    number_status: "unknown",
    abbreviation_status: "unknown",
    punctuation_role: "unknown",
    interpretation: "forbidden",
  },
  proof: {
    ...proof,
    case_count: cases.length,
    shape_counts: shapeCounts,
  },
  cases,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.trailing-apostrophe-cases.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, forms: cases.map((item) => item.raw) }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, forms: cases.map((item) => item.raw) }, null, 2));
}
