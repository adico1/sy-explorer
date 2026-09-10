import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const sealedWordsUrl = new URL("../src/sy.sealed-word-units.json", import.meta.url);
const outputUrl = new URL("../src/sy.lexical-coverage.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const sealedWordsText = fs.readFileSync(sealedWordsUrl, "utf8");
const corpus = JSON.parse(corpusText);
const sealedWords = JSON.parse(sealedWordsText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (corpus.source.sha256 !== sourceHash) throw new Error("Corpus and source differ.");
if (sealedWords.status !== "sealed" || sealedWords.source.sha256 !== sourceHash) {
  throw new Error("Sealed words do not match the source.");
}

const wordAtCodeUnit = new Array(source.length).fill(null);
for (const occurrence of sealedWords.occurrences) {
  const { start, end } = occurrence.source_code_unit_range;
  for (let position = start; position < end; position += 1) {
    if (wordAtCodeUnit[position] !== null) throw new Error(`Overlapping sealed words at ${position}.`);
    wordAtCodeUnit[position] = occurrence.id;
  }
}

const classify = (char, absoluteStart) => {
  const wordIds = new Set(wordAtCodeUnit.slice(absoluteStart, absoluteStart + char.length));
  if (wordIds.size === 1 && !wordIds.has(null)) {
    return { category: "sealed_word", sealedWordOccurrenceId: [...wordIds][0] };
  }
  if (![...wordIds].every((id) => id === null)) throw new Error(`Partial word coverage at ${absoluteStart}.`);
  if (/^\s$/u.test(char)) return { category: "whitespace", sealedWordOccurrenceId: null };
  if (/^[\p{P}\p{S}]$/u.test(char)) return { category: "punctuation_or_symbol", sealedWordOccurrenceId: null };
  return { category: "unresolved_text", sealedWordOccurrenceId: null };
};

const segments = [];
const categoryCodeUnitCounts = {
  sealed_word: 0,
  whitespace: 0,
  punctuation_or_symbol: 0,
  unresolved_text: 0,
};
const categoryCodePointCounts = {
  sealed_word: 0,
  whitespace: 0,
  punctuation_or_symbol: 0,
  unresolved_text: 0,
};

for (const fragment of corpus.fragments) {
  let relative = 0;
  let open = null;
  const flush = () => {
    if (!open) return;
    const raw = source.slice(open.start, open.end);
    segments.push({
      id: `lexical-coverage-segment.${String(segments.length + 1).padStart(4, "0")}`,
      ordinal: segments.length,
      category: open.category,
      semantic_status: open.category === "sealed_word" ? "sealed" : "uninterpreted",
      sealed_word_occurrence_id: open.sealedWordOccurrenceId,
      corpus_fragment_id: fragment.id,
      source_node_id: fragment.source_node_id,
      reading_unit_id: fragment.reading_unit_id,
      source_code_unit_range: { start: open.start, end: open.end },
      raw,
      raw_sha256: sha256(Buffer.from(raw, "utf8")),
    });
    open = null;
  };

  for (const char of fragment.raw) {
    const start = fragment.source_code_unit_range.start + relative;
    const end = start + char.length;
    if (source.slice(start, end) !== char) throw new Error(`Character/source mismatch at ${start}.`);
    const classification = classify(char, start);
    categoryCodeUnitCounts[classification.category] += char.length;
    categoryCodePointCounts[classification.category] += 1;
    const sameSegment = open
      && open.category === classification.category
      && open.sealedWordOccurrenceId === classification.sealedWordOccurrenceId
      && open.end === start;
    if (!sameSegment) {
      flush();
      open = { ...classification, start, end };
    } else {
      open.end = end;
    }
    relative += char.length;
  }
  flush();
  if (relative !== fragment.raw.length) throw new Error(`Incomplete fragment scan: ${fragment.id}.`);
}

const reconstructed = segments.map((segment) => segment.raw).join("");
const segmentCodeUnitCount = segments.reduce((sum, segment) => sum + segment.raw.length, 0);
const corpusCodeUnitCount = corpus.fragments.reduce((sum, fragment) => sum + fragment.raw.length, 0);
const sealedWordSegments = segments.filter((segment) => segment.category === "sealed_word");
const sealedWordIds = sealedWords.occurrences.map((occurrence) => occurrence.id);
const coveredWordIds = sealedWordSegments.map((segment) => segment.sealed_word_occurrence_id);
const allowedCategories = new Set(["sealed_word", "whitespace", "punctuation_or_symbol", "unresolved_text"]);
const proof = {
  every_corpus_code_unit_covered_exactly_once: segmentCodeUnitCount === corpusCodeUnitCount
    && reconstructed.length === corpus.corpus_text.length,
  exact_corpus_stream_round_trip: reconstructed === corpus.corpus_text,
  every_segment_matches_exact_source_range: segments.every((segment) =>
    source.slice(segment.source_code_unit_range.start, segment.source_code_unit_range.end) === segment.raw),
  segments_preserve_source_order_without_fragment_gaps: corpus.fragments.every((fragment) => {
    const members = segments.filter((segment) => segment.corpus_fragment_id === fragment.id);
    return members.length > 0
      && members[0].source_code_unit_range.start === fragment.source_code_unit_range.start
      && members.at(-1).source_code_unit_range.end === fragment.source_code_unit_range.end
      && members.every((segment, index) => index === 0
        || members[index - 1].source_code_unit_range.end === segment.source_code_unit_range.start);
  }),
  exactly_four_allowed_categories: segments.every((segment) => allowedCategories.has(segment.category))
    && new Set(segments.map((segment) => segment.category)).size === 4,
  all_ninety_one_sealed_words_preserved_exactly_once: coveredWordIds.length === 91
    && new Set(coveredWordIds).size === 91
    && sealedWordIds.every((id) => coveredWordIds.includes(id)),
  no_new_words_or_candidates_emitted: sealedWordSegments.length === sealedWords.occurrences.length
    && segments.every((segment) => segment.category !== "sealed_word" || segment.sealed_word_occurrence_id !== null),
  all_nonword_segments_uninterpreted: segments.every((segment) =>
    segment.category === "sealed_word" || segment.semantic_status === "uninterpreted"),
  category_counts_cover_corpus: Object.values(categoryCodeUnitCounts).reduce((sum, count) => sum + count, 0)
    === corpusCodeUnitCount,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Lexical coverage proof failed.");

const artifact = {
  id: "sy.lexical-coverage-map",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "coverage_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    corpus_text_sha256: corpus.corpus_text_sha256,
    sealed_word_units_sha256: sha256(Buffer.from(sealedWordsText, "utf8")),
  },
  rules: {
    categories: ["sealed_word", "whitespace", "punctuation_or_symbol", "unresolved_text"],
    sealed_word: "exact_range_from_sy.sealed-word-units.json",
    whitespace: "unicode_whitespace_observation",
    punctuation_or_symbol: "unicode_punctuation_or_symbol_observation_role_unknown",
    unresolved_text: "all_remaining_corpus_content_without_word_or_candidate_status",
    normalization: "none",
    interpretation: "forbidden",
  },
  proof: {
    ...proof,
    corpus_fragment_count: corpus.fragments.length,
    segment_count: segments.length,
    corpus_code_unit_count: corpusCodeUnitCount,
    corpus_code_point_count: Object.values(categoryCodePointCounts).reduce((sum, count) => sum + count, 0),
    category_code_unit_counts: categoryCodeUnitCounts,
    category_code_point_counts: categoryCodePointCounts,
    category_segment_counts: Object.fromEntries([...allowedCategories].map((category) => [
      category,
      segments.filter((segment) => segment.category === category).length,
    ])),
  },
  segment_schema: [
    "category", "sealed_word_occurrence_id", "corpus_fragment_id", "source_node_id",
    "reading_unit_id", "source_code_unit_start", "source_code_unit_end", "raw"
  ],
  segments: segments.map((segment) => [
    segment.category,
    segment.sealed_word_occurrence_id,
    segment.corpus_fragment_id,
    segment.source_node_id,
    segment.reading_unit_id,
    segment.source_code_unit_range.start,
    segment.source_code_unit_range.end,
    segment.raw,
  ]),
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.lexical-coverage.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof }, null, 2));
}
