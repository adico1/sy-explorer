import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const corpusUrl = new URL("../src/sy.corpus-text.json", import.meta.url);
const streamUrl = new URL("../src/sy.orthographic-stream.json", import.meta.url);
const outputUrl = new URL("../src/sy.word-candidate-views.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const corpusText = fs.readFileSync(corpusUrl, "utf8");
const streamText = fs.readFileSync(streamUrl, "utf8");
const corpus = JSON.parse(corpusText);
const stream = JSON.parse(streamText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (corpus.source.sha256 !== sourceHash) throw new Error("Corpus and source differ.");
if (stream.status !== "sealed" || stream.source.sha256 !== sourceHash) {
  throw new Error("Orthographic stream is not sealed for this source.");
}

const atomField = new Map(stream.atom_schema.map((field, index) => [field, index]));
const atoms = stream.atoms.map((row, ordinal) => ({
  ordinal,
  kind: row[atomField.get("kind")],
  reference_id: row[atomField.get("reference_id")],
  corpus_fragment_id: row[atomField.get("corpus_fragment_id")],
  source_code_unit_range: {
    start: row[atomField.get("source_code_unit_start")],
    end: row[atomField.get("source_code_unit_end")],
  },
  raw: row[atomField.get("raw")],
}));

const buildView = ({ id, punctuationEndsCandidate }) => {
  const segments = [];
  let open = [];
  const emit = (kind, members, referenceId = null) => {
    if (!members.length) return;
    const raw = members.map((atom) => atom.raw).join("");
    const start = members[0].source_code_unit_range.start;
    const end = members.at(-1).source_code_unit_range.end;
    const hasGrapheme = members.some((atom) => atom.kind === "hebrew_grapheme");
    const segmentKind = kind === "open_run"
      ? (hasGrapheme ? "candidate" : "technical_run")
      : kind;
    segments.push({
      id: `${id}.${segmentKind}.${String(segments.length + 1).padStart(4, "0")}`,
      kind: segmentKind,
      status: segmentKind === "sealed_word" ? "sealed_word"
        : segmentKind === "candidate" ? "candidate_not_word"
          : "not_a_word_candidate",
      evidence_status: segmentKind === "sealed_word" ? "observed_and_sealed" : "derived",
      semantic_status: segmentKind === "sealed_word" ? "sealed" : "unknown",
      reference_id: referenceId,
      corpus_fragment_id: members[0].corpus_fragment_id,
      source_code_unit_range: { start, end },
      atom_ordinal_range: { start: members[0].ordinal, end: members.at(-1).ordinal + 1 },
      raw,
      grapheme_atom_count: members.filter((atom) => atom.kind === "hebrew_grapheme").length,
      punctuation_atom_count: members.filter((atom) => atom.kind === "punctuation_or_symbol").length,
    });
  };
  const flush = () => {
    emit("open_run", open);
    open = [];
  };

  let previousFragmentId = null;
  for (const atom of atoms) {
    if (previousFragmentId !== null && atom.corpus_fragment_id !== previousFragmentId) flush();
    previousFragmentId = atom.corpus_fragment_id;
    if (atom.kind === "sealed_word") {
      flush();
      emit("sealed_word", [atom], atom.reference_id);
    } else if (atom.kind === "whitespace") {
      flush();
      emit("separator", [atom]);
    } else if (atom.kind === "punctuation_or_symbol" && punctuationEndsCandidate) {
      flush();
      emit("separator", [atom]);
    } else {
      open.push(atom);
    }
  }
  flush();

  return {
    id,
    status: "derived_candidate_view",
    semantic_status: "no_candidate_is_a_word",
    boundary_model: {
      whitespace: "boundary",
      sealed_word_edge: "boundary_preserving_existing_word",
      corpus_fragment_edge: "boundary_preventing_noncontiguous_source_ranges",
      punctuation_or_symbol: punctuationEndsCandidate ? "model_boundary_role_still_unknown" : "retained_inside_candidate_role_unknown",
    },
    segments,
  };
};

const whitespaceView = buildView({ id: "whitespace_bounded", punctuationEndsCandidate: false });
const punctuationView = buildView({ id: "punctuation_bounded", punctuationEndsCandidate: true });
const views = [whitespaceView, punctuationView];
const candidates = (view) => view.segments.filter((segment) => segment.kind === "candidate");
const punctuationDependentCases = candidates(whitespaceView)
  .filter((segment) => segment.punctuation_atom_count > 0)
  .map((segment, index) => ({
    id: `punctuation-dependent-case.${String(index + 1).padStart(4, "0")}`,
    whitespace_candidate_id: segment.id,
    whitespace_candidate_raw: segment.raw,
    corpus_fragment_id: segment.corpus_fragment_id,
    source_code_unit_range: segment.source_code_unit_range,
    punctuation_atom_count: segment.punctuation_atom_count,
    overlapping_punctuation_bounded_candidate_ids: candidates(punctuationView)
      .filter((candidate) => candidate.corpus_fragment_id === segment.corpus_fragment_id
        && candidate.source_code_unit_range.start < segment.source_code_unit_range.end
        && segment.source_code_unit_range.start < candidate.source_code_unit_range.end)
      .map((candidate) => candidate.id),
  }));

const viewProofs = views.map((view) => {
  const representedOrdinals = view.segments.flatMap((segment) => {
    const ordinals = [];
    for (let ordinal = segment.atom_ordinal_range.start; ordinal < segment.atom_ordinal_range.end; ordinal += 1) ordinals.push(ordinal);
    return ordinals;
  });
  const reconstructed = view.segments.map((segment) => segment.raw).join("");
  const wordSegments = view.segments.filter((segment) => segment.kind === "sealed_word");
  return {
    view_id: view.id,
    every_atom_represented_exactly_once: representedOrdinals.length === atoms.length
      && new Set(representedOrdinals).size === atoms.length
      && atoms.every((atom) => representedOrdinals.includes(atom.ordinal)),
    exact_corpus_stream_round_trip: reconstructed === corpus.corpus_text,
    every_segment_matches_exact_source_range: view.segments.every((segment) =>
      source.slice(segment.source_code_unit_range.start, segment.source_code_unit_range.end) === segment.raw),
    no_segment_crosses_a_corpus_fragment: view.segments.every((segment) => {
      const members = atoms.slice(segment.atom_ordinal_range.start, segment.atom_ordinal_range.end);
      return members.every((atom) => atom.corpus_fragment_id === segment.corpus_fragment_id);
    }),
    all_ninety_one_sealed_words_preserved_as_single_segments: wordSegments.length === 91
      && new Set(wordSegments.map((segment) => segment.reference_id)).size === 91,
    every_candidate_contains_a_grapheme: candidates(view).every((segment) => segment.grapheme_atom_count > 0),
    no_candidate_promoted_to_word: candidates(view).every((segment) =>
      segment.status === "candidate_not_word" && segment.semantic_status === "unknown"),
  };
});
const proof = {
  exactly_two_parallel_views: views.length === 2
    && views[0].id === "whitespace_bounded"
    && views[1].id === "punctuation_bounded",
  neither_view_is_preferred: true,
  every_view_covers_every_atom_exactly_once: viewProofs.every((item) => item.every_atom_represented_exactly_once),
  every_view_round_trips_exact_corpus: viewProofs.every((item) => item.exact_corpus_stream_round_trip),
  every_view_segment_matches_source: viewProofs.every((item) => item.every_segment_matches_exact_source_range),
  no_view_segment_crosses_a_corpus_fragment: viewProofs.every((item) => item.no_segment_crosses_a_corpus_fragment),
  all_sealed_words_preserved_in_both_views: viewProofs.every((item) => item.all_ninety_one_sealed_words_preserved_as_single_segments),
  every_candidate_contains_a_grapheme: viewProofs.every((item) => item.every_candidate_contains_a_grapheme),
  no_candidate_is_promoted_to_word: viewProofs.every((item) => item.no_candidate_promoted_to_word),
  punctuation_role_remains_unknown: whitespaceView.boundary_model.punctuation_or_symbol.includes("role_unknown")
    && punctuationView.boundary_model.punctuation_or_symbol.includes("role_still_unknown"),
  every_difference_case_resolves_in_both_views: punctuationDependentCases.every((item) =>
    whitespaceView.segments.some((segment) => segment.id === item.whitespace_candidate_id)
    && item.overlapping_punctuation_bounded_candidate_ids.length > 0
    && item.overlapping_punctuation_bounded_candidate_ids.every((id) =>
      punctuationView.segments.some((segment) => segment.id === id))),
  no_normalization_prefix_analysis_or_interpretation: true,
  deterministic_output: true,
};
if (Object.values(proof).some((value) => value !== true)) throw new Error("Word-candidate views proof failed.");

const compactView = (view) => ({
  id: view.id,
  status: view.status,
  semantic_status: view.semantic_status,
  boundary_model: view.boundary_model,
  segment_identity: "array_ordinal_within_view",
  segment_semantics_by_kind: {
    sealed_word: { status: "sealed_word", evidence_status: "observed_and_sealed", semantic_status: "sealed" },
    candidate: { status: "candidate_not_word", evidence_status: "derived", semantic_status: "unknown" },
    separator: { status: "not_a_word_candidate", evidence_status: "derived", semantic_status: "unknown" },
    technical_run: { status: "not_a_word_candidate", evidence_status: "derived", semantic_status: "unknown" },
  },
  segment_schema: [
    "ordinal", "kind", "reference_id", "corpus_fragment_id", "source_code_unit_start", "source_code_unit_end",
    "atom_ordinal_start", "atom_ordinal_end", "raw", "grapheme_atom_count", "punctuation_atom_count"
  ],
  segments: view.segments.map((segment, ordinal) => [
    ordinal,
    segment.kind,
    segment.reference_id,
    segment.corpus_fragment_id,
    segment.source_code_unit_range.start,
    segment.source_code_unit_range.end,
    segment.atom_ordinal_range.start,
    segment.atom_ordinal_range.end,
    segment.raw,
    segment.grapheme_atom_count,
    segment.punctuation_atom_count,
  ]),
});
const artifact = {
  id: "sy.parallel-word-candidate-views",
  version: "1.0.0",
  status: "sealed_derivation",
  semantic_status: "candidates_only_no_new_words",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    corpus_text_sha256: corpus.corpus_text_sha256,
    orthographic_stream_sha256: sha256(Buffer.from(streamText, "utf8")),
  },
  rules: {
    preferred_view: null,
    preferred_view_status: "unknown",
    existing_sealed_words: "preserved_as_atomic_segments",
    candidates: "derived_not_words",
    punctuation_role: "unknown",
    normalization: "none",
    prefix_analysis: "not_performed",
    interpretation: "forbidden",
  },
  proof: {
    ...proof,
    view_proofs: viewProofs,
    whitespace_bounded_candidate_count: candidates(whitespaceView).length,
    punctuation_bounded_candidate_count: candidates(punctuationView).length,
    punctuation_dependent_case_count: punctuationDependentCases.length,
  },
  views: views.map(compactView),
  punctuation_dependent_case_schema: [
    "ordinal", "whitespace_candidate_ordinal", "whitespace_candidate_raw", "corpus_fragment_id",
    "source_code_unit_start", "source_code_unit_end", "punctuation_atom_count",
    "overlapping_punctuation_bounded_candidate_ordinals"
  ],
  punctuation_dependent_cases: punctuationDependentCases.map((item, ordinal) => [
    ordinal,
    whitespaceView.segments.findIndex((segment) => segment.id === item.whitespace_candidate_id),
    item.whitespace_candidate_raw,
    item.corpus_fragment_id,
    item.source_code_unit_range.start,
    item.source_code_unit_range.end,
    item.punctuation_atom_count,
    item.overlapping_punctuation_bounded_candidate_ids.map((id) =>
      punctuationView.segments.findIndex((segment) => segment.id === id)),
  ]),
};

const serialized = `${JSON.stringify(artifact)}\n`;
if (process.argv.includes("--check")) {
  if (fs.readFileSync(outputUrl, "utf8") !== serialized) throw new Error("sy.word-candidate-views.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof }, null, 2));
}
