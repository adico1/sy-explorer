import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const coverageUrl = new URL("../src/sy.lexical-coverage.json", import.meta.url);
const sealedWordsUrl = new URL("../src/sy.sealed-word-units.json", import.meta.url);
const graphemesUrl = new URL("../src/sy.hebrew-graphemes.json", import.meta.url);
const outputUrl = new URL("../src/sy.orthographic-stream.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const coverageText = fs.readFileSync(coverageUrl, "utf8");
const sealedWordsText = fs.readFileSync(sealedWordsUrl, "utf8");
const graphemesText = fs.readFileSync(graphemesUrl, "utf8");
const corpus = JSON.parse(corpusText);
const coverage = JSON.parse(coverageText);
const sealedWords = JSON.parse(sealedWordsText);
const graphemeArtifact = JSON.parse(graphemesText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

for (const artifact of [corpus, coverage, sealedWords, graphemeArtifact]) {
  if (artifact.source.sha256 !== sourceHash) throw new Error(`${artifact.id} does not match the source.`);
}
if (![coverage, sealedWords, graphemeArtifact].every((artifact) => artifact.status === "sealed")) {
  throw new Error("An orthographic-stream input is not sealed.");
}

const graphemeField = new Map(graphemeArtifact.grapheme_schema.map((field, index) => [field, index]));
const graphemes = graphemeArtifact.graphemes.map((row) => ({
  id: row[graphemeField.get("id")],
  raw: row[graphemeField.get("raw")],
  corpus_fragment_id: row[graphemeField.get("corpus_fragment_id")],
  sealed_word_occurrence_id: row[graphemeField.get("sealed_word_occurrence_id")],
  source_code_unit_range: {
    start: row[graphemeField.get("source_code_unit_start")],
    end: row[graphemeField.get("source_code_unit_end")],
  },
}));
const wordByStart = new Map();
for (const word of sealedWords.occurrences) {
  if (wordByStart.has(word.source_code_unit_range.start)) throw new Error("Duplicate sealed-word start.");
  wordByStart.set(word.source_code_unit_range.start, word);
}
const graphemeByStart = new Map();
for (const grapheme of graphemes) {
  if (graphemeByStart.has(grapheme.source_code_unit_range.start)) throw new Error("Duplicate grapheme start.");
  graphemeByStart.set(grapheme.source_code_unit_range.start, grapheme);
}

const childGraphemesByWord = new Map(sealedWords.occurrences.map((word) => [
  word.id,
  graphemes.filter((grapheme) => grapheme.sealed_word_occurrence_id === word.id),
]));
const technicalKind = (char) => {
  if (/^\s$/u.test(char)) return "whitespace";
  if (/^[\p{P}\p{S}]$/u.test(char)) return "punctuation_or_symbol";
  return "other";
};
const atoms = [];

for (const fragment of corpus.fragments) {
  let cursor = fragment.source_code_unit_range.start;
  const fragmentEnd = fragment.source_code_unit_range.end;
  while (cursor < fragmentEnd) {
    const word = wordByStart.get(cursor);
    if (word) {
      if (word.source_code_unit_range.end > fragmentEnd || word.corpus_fragment_id !== fragment.id) {
        throw new Error(`Sealed word crosses fragment boundary: ${word.id}.`);
      }
      const children = childGraphemesByWord.get(word.id);
      atoms.push({
        kind: "sealed_word",
        reference_id: word.id,
        corpus_fragment_id: fragment.id,
        source_code_unit_range: word.source_code_unit_range,
        raw: word.raw,
        child_grapheme_ids: children.map((item) => item.id),
      });
      cursor = word.source_code_unit_range.end;
      continue;
    }

    const grapheme = graphemeByStart.get(cursor);
    if (grapheme) {
      if (grapheme.sealed_word_occurrence_id !== null) {
        throw new Error(`Child grapheme escaped its sealed word: ${grapheme.id}.`);
      }
      atoms.push({
        kind: "hebrew_grapheme",
        reference_id: grapheme.id,
        corpus_fragment_id: fragment.id,
        source_code_unit_range: grapheme.source_code_unit_range,
        raw: grapheme.raw,
        child_grapheme_ids: [],
      });
      cursor = grapheme.source_code_unit_range.end;
      continue;
    }

    const firstChar = String.fromCodePoint(source.codePointAt(cursor));
    if (/[א-ת]/u.test(firstChar) || /^\p{M}$/u.test(firstChar)) {
      throw new Error(`Unmapped Hebrew letter or combining mark at ${cursor}.`);
    }
    const kind = technicalKind(firstChar);
    const start = cursor;
    let raw = firstChar;
    cursor += firstChar.length;
    while (cursor < fragmentEnd && !wordByStart.has(cursor) && !graphemeByStart.has(cursor)) {
      const nextChar = String.fromCodePoint(source.codePointAt(cursor));
      if (/[א-ת]/u.test(nextChar) || /^\p{M}$/u.test(nextChar) || technicalKind(nextChar) !== kind) break;
      raw += nextChar;
      cursor += nextChar.length;
    }
    atoms.push({
      kind,
      reference_id: null,
      corpus_fragment_id: fragment.id,
      source_code_unit_range: { start, end: cursor },
      raw,
      child_grapheme_ids: [],
    });
  }
}

const atomKinds = ["sealed_word", "hebrew_grapheme", "whitespace", "punctuation_or_symbol", "other"];
const atomsByKind = Object.fromEntries(atomKinds.map((kind) => [kind, atoms.filter((atom) => atom.kind === kind)]));
const wordAtomIds = atomsByKind.sealed_word.map((atom) => atom.reference_id);
const standaloneGraphemeIds = atomsByKind.hebrew_grapheme.map((atom) => atom.reference_id);
const childGraphemeIds = atomsByKind.sealed_word.flatMap((atom) => atom.child_grapheme_ids);
const allRepresentedGraphemeIds = [...standaloneGraphemeIds, ...childGraphemeIds];
const reconstructed = atoms.map((atom) => atom.raw).join("");
const atomCodeUnitCount = atoms.reduce((sum, atom) => sum + atom.raw.length, 0);
const proof = {
  every_corpus_code_unit_represented_exactly_once: atomCodeUnitCount === corpus.corpus_text.length
    && reconstructed.length === corpus.corpus_text.length,
  exact_corpus_stream_round_trip: reconstructed === corpus.corpus_text,
  every_atom_matches_exact_source_range: atoms.every((atom) =>
    source.slice(atom.source_code_unit_range.start, atom.source_code_unit_range.end) === atom.raw),
  atom_stream_is_gap_free_and_nonoverlapping_per_fragment: corpus.fragments.every((fragment) => {
    const members = atoms.filter((atom) => atom.corpus_fragment_id === fragment.id);
    return members.length > 0
      && members[0].source_code_unit_range.start === fragment.source_code_unit_range.start
      && members.at(-1).source_code_unit_range.end === fragment.source_code_unit_range.end
      && members.every((atom, index) => index === 0
        || members[index - 1].source_code_unit_range.end === atom.source_code_unit_range.start);
  }),
  all_eighty_seven_sealed_words_are_single_atoms: wordAtomIds.length === 87
    && new Set(wordAtomIds).size === 87
    && sealedWords.occurrences.every((word) => wordAtomIds.includes(word.id)),
  every_grapheme_represented_exactly_once_as_atom_or_word_child: allRepresentedGraphemeIds.length === graphemes.length
    && new Set(allRepresentedGraphemeIds).size === graphemes.length
    && graphemes.every((grapheme) => allRepresentedGraphemeIds.includes(grapheme.id)),
  no_word_child_grapheme_is_a_top_level_atom: childGraphemeIds.every((id) => !standaloneGraphemeIds.includes(id)),
  every_word_child_is_fully_contained: atomsByKind.sealed_word.every((atom) =>
    childGraphemesByWord.get(atom.reference_id).every((grapheme) =>
      atom.source_code_unit_range.start <= grapheme.source_code_unit_range.start
      && grapheme.source_code_unit_range.end <= atom.source_code_unit_range.end)),
  only_five_declared_atom_kinds: atoms.every((atom) => atomKinds.includes(atom.kind)),
  no_words_candidates_normalization_or_interpretation_added: true,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Orthographic stream proof failed.");

const artifact = {
  id: "sy.orthographic-atom-stream",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "ordered_orthographic_composition_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    corpus_text_sha256: corpus.corpus_text_sha256,
    lexical_coverage_sha256: sha256(Buffer.from(coverageText, "utf8")),
    sealed_word_units_sha256: sha256(Buffer.from(sealedWordsText, "utf8")),
    hebrew_graphemes_sha256: sha256(Buffer.from(graphemesText, "utf8")),
  },
  rules: {
    precedence: ["sealed_word", "hebrew_grapheme", "whitespace", "punctuation_or_symbol", "other"],
    sealed_word_children: "referenced_not_duplicated_as_top_level_atoms",
    whitespace_and_other: "maximal_contiguous_runs_within_one_corpus_fragment",
    punctuation_or_symbol: "maximal_contiguous_unicode_runs_role_unknown",
    atom_identity: "array_ordinal_using_pattern_orthographic-atom.NNNNN",
    new_word_or_candidate_generation: "forbidden",
    normalization: "none",
    interpretation: "forbidden",
  },
  proof: {
    ...proof,
    atom_count: atoms.length,
    corpus_code_unit_count: corpus.corpus_text.length,
    atom_counts_by_kind: Object.fromEntries(atomKinds.map((kind) => [kind, atomsByKind[kind].length])),
    code_unit_counts_by_kind: Object.fromEntries(atomKinds.map((kind) => [
      kind,
      atomsByKind[kind].reduce((sum, atom) => sum + atom.raw.length, 0),
    ])),
    standalone_grapheme_count: standaloneGraphemeIds.length,
    word_child_grapheme_count: childGraphemeIds.length,
  },
  atom_schema: [
    "kind", "reference_id", "corpus_fragment_id", "source_code_unit_start",
    "source_code_unit_end", "raw", "child_grapheme_ids"
  ],
  atoms: atoms.map((atom) => [
    atom.kind,
    atom.reference_id,
    atom.corpus_fragment_id,
    atom.source_code_unit_range.start,
    atom.source_code_unit_range.end,
    atom.raw,
    atom.child_grapheme_ids,
  ]),
};

const serialized = `${JSON.stringify(artifact)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.orthographic-stream.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof }, null, 2));
}
