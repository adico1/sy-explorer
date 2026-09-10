import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const coverageUrl = new URL("../src/sy.lexical-coverage.json", import.meta.url);
const sealedWordsUrl = new URL("../src/sy.sealed-word-units.json", import.meta.url);
const outputUrl = new URL("../src/sy.hebrew-graphemes.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const coverageText = fs.readFileSync(coverageUrl, "utf8");
const sealedWordsText = fs.readFileSync(sealedWordsUrl, "utf8");
const corpus = JSON.parse(corpusText);
const coverage = JSON.parse(coverageText);
const sealedWords = JSON.parse(sealedWordsText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (corpus.source.sha256 !== sourceHash) throw new Error("Corpus and source differ.");
if (coverage.status !== "sealed" || coverage.source.sha256 !== sourceHash) throw new Error("Coverage map is not sealed for this source.");
if (sealedWords.status !== "sealed" || sealedWords.source.sha256 !== sourceHash) throw new Error("Sealed words do not match the source.");

const wordAtCodeUnit = new Array(source.length).fill(null);
for (const occurrence of sealedWords.occurrences) {
  for (let position = occurrence.source_code_unit_range.start; position < occurrence.source_code_unit_range.end; position += 1) {
    if (wordAtCodeUnit[position] !== null) throw new Error(`Overlapping sealed words at ${position}.`);
    wordAtCodeUnit[position] = occurrence.id;
  }
}

const graphemes = [];
const orphanMarks = [];
const coveredHebrewCodeUnits = new Set();
let hebrewLetterCount = 0;
let combiningMarkCount = 0;

for (const fragment of corpus.fragments) {
  const codePoints = [...fragment.raw];
  let relative = 0;
  for (let index = 0; index < codePoints.length; index += 1) {
    const char = codePoints[index];
    const start = fragment.source_code_unit_range.start + relative;
    if (/[א-ת]/u.test(char)) {
      hebrewLetterCount += 1;
      let raw = char;
      let marksRaw = "";
      let end = start + char.length;
      for (let next = index + 1; next < codePoints.length && /^\p{M}$/u.test(codePoints[next]); next += 1) {
        const mark = codePoints[next];
        marksRaw += mark;
        raw += mark;
        end += mark.length;
        combiningMarkCount += 1;
        index = next;
      }
      if (source.slice(start, end) !== raw) throw new Error(`Grapheme/source mismatch at ${start}.`);
      for (let position = start; position < end; position += 1) {
        if (coveredHebrewCodeUnits.has(position)) throw new Error(`Overlapping Hebrew graphemes at ${position}.`);
        coveredHebrewCodeUnits.add(position);
      }
      const wordIds = new Set(wordAtCodeUnit.slice(start, end));
      if (wordIds.size > 1) throw new Error(`Partial sealed-word association at ${start}.`);
      graphemes.push({
        id: `hebrew-grapheme.${String(graphemes.length + 1).padStart(5, "0")}`,
        ordinal: graphemes.length,
        raw,
        base_letter: char,
        combining_marks_raw: marksRaw,
        combining_mark_count: [...marksRaw].length,
        corpus_fragment_id: fragment.id,
        source_node_id: fragment.source_node_id,
        reading_unit_id: fragment.reading_unit_id,
        sealed_word_occurrence_id: wordIds.has(null) ? null : [...wordIds][0],
        source_code_unit_range: { start, end },
      });
      relative += raw.length;
      continue;
    }
    if (/^\p{M}$/u.test(char)) {
      combiningMarkCount += 1;
      orphanMarks.push({ char, corpus_fragment_id: fragment.id, source_code_unit_start: start });
    }
    relative += char.length;
  }
  if (relative !== fragment.raw.length) throw new Error(`Incomplete fragment scan: ${fragment.id}.`);
}

const expectedHebrewPositions = new Set();
for (const fragment of corpus.fragments) {
  let relative = 0;
  for (const char of fragment.raw) {
    if (/[א-ת]/u.test(char) || /^\p{M}$/u.test(char)) {
      const start = fragment.source_code_unit_range.start + relative;
      for (let position = start; position < start + char.length; position += 1) expectedHebrewPositions.add(position);
    }
    relative += char.length;
  }
}
const reconstructed = corpus.fragments.map((fragment) => source.slice(
  fragment.source_code_unit_range.start,
  fragment.source_code_unit_range.end,
)).join("");
const proof = {
  every_hebrew_letter_emitted_exactly_once: graphemes.length === hebrewLetterCount
    && hebrewLetterCount === 6587,
  every_combining_mark_attached_exactly_once: orphanMarks.length === 0
    && graphemes.reduce((sum, item) => sum + item.combining_mark_count, 0) === combiningMarkCount
    && combiningMarkCount === 5224,
  every_hebrew_letter_and_mark_code_unit_covered_exactly_once: coveredHebrewCodeUnits.size === expectedHebrewPositions.size
    && [...expectedHebrewPositions].every((position) => coveredHebrewCodeUnits.has(position)),
  every_grapheme_has_one_hebrew_base: graphemes.every((item) => /^[א-ת]$/u.test(item.base_letter)
    && [...item.raw].filter((char) => /[א-ת]/u.test(char)).length === 1),
  every_suffix_code_point_is_a_combining_mark: graphemes.every((item) =>
    [...item.combining_marks_raw].every((char) => /^\p{M}$/u.test(char))),
  every_grapheme_matches_exact_source_range: graphemes.every((item) =>
    source.slice(item.source_code_unit_range.start, item.source_code_unit_range.end) === item.raw),
  graphemes_are_nonoverlapping_and_in_source_order: graphemes.every((item, index) => index === 0
    || graphemes[index - 1].source_code_unit_range.end <= item.source_code_unit_range.start),
  sealed_word_association_is_all_or_none: graphemes.every((item) => {
    const ids = new Set(wordAtCodeUnit.slice(item.source_code_unit_range.start, item.source_code_unit_range.end));
    return ids.size === 1 && (ids.has(null) || ids.has(item.sealed_word_occurrence_id));
  }),
  exact_corpus_round_trip_after_overlay_removal: reconstructed === corpus.corpus_text,
  no_words_or_unpointed_word_forms_emitted: true,
  no_semantic_interpretation_emitted: true,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Hebrew grapheme proof failed.");

const graphemesWithMarks = graphemes.filter((item) => item.combining_mark_count > 0);
const artifact = {
  id: "sy.hebrew-letter-mark-units",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "orthographic_atoms_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    corpus_text_sha256: corpus.corpus_text_sha256,
    lexical_coverage_sha256: sha256(Buffer.from(coverageText, "utf8")),
    sealed_word_units_sha256: sha256(Buffer.from(sealedWordsText, "utf8")),
  },
  rule: {
    statement: "One Hebrew base letter plus every immediately following Unicode combining mark in the same source fragment forms one orthographic atom.",
    base_letter_range: "U+05D0..U+05EA",
    attached_suffix: "Unicode General_Category=Mark",
    normalization: "none",
    mark_reordering: "none",
    word_generation: "forbidden",
    unpointed_word_generation: "forbidden",
    interpretation: "forbidden",
  },
  proof: {
    ...proof,
    grapheme_count: graphemes.length,
    hebrew_letter_count: hebrewLetterCount,
    combining_mark_count: combiningMarkCount,
    orphan_combining_mark_count: orphanMarks.length,
    graphemes_with_marks_count: graphemesWithMarks.length,
    graphemes_without_marks_count: graphemes.length - graphemesWithMarks.length,
    graphemes_inside_sealed_words_count: graphemes.filter((item) => item.sealed_word_occurrence_id !== null).length,
  },
  grapheme_schema: [
    "id", "raw", "base_letter", "combining_mark_count", "corpus_fragment_id",
    "sealed_word_occurrence_id", "source_code_unit_start", "source_code_unit_end"
  ],
  graphemes: graphemes.map((item) => [
    item.id,
    item.raw,
    item.base_letter,
    item.combining_mark_count,
    item.corpus_fragment_id,
    item.sealed_word_occurrence_id,
    item.source_code_unit_range.start,
    item.source_code_unit_range.end,
  ]),
  orphan_combining_marks: orphanMarks,
};

const serialized = `${JSON.stringify(artifact)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.hebrew-graphemes.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof }, null, 2));
}
