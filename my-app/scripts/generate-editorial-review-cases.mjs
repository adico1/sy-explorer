import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const inventoryUrl = new URL("../src/sy.editorial-candidate-inventory.json", import.meta.url);
const outputUrl = new URL("../src/sy.editorial-review-cases.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const inventoryText = fs.readFileSync(inventoryUrl, "utf8");
const inventory = JSON.parse(inventoryText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (inventory.source.sha256 !== sourceHash) throw new Error("Candidate inventory does not match the source.");

const contains = (outer, inner) => outer.start <= inner.start && inner.end <= outer.end;
const topLevelCandidates = inventory.candidates.filter((candidate) => !inventory.candidates.some((other) =>
  other.id !== candidate.id
  && contains(other.source_code_unit_range, candidate.source_code_unit_range)
  && (other.source_code_unit_range.start !== candidate.source_code_unit_range.start
    || other.source_code_unit_range.end !== candidate.source_code_unit_range.end)));

const explicitLabelDefinitions = [
  {
    label_type: "variant_claim_label",
    surface: "הַנֻּסְחָא הַנְּכוֹנָה:",
  },
  {
    label_type: "source_witness_note",
    surface: "בִּדְפוּס מַנְטוֹבָה (שכ\"ב) הֵגַי' כמ\"ש בְּאוֹצַר ה'",
  },
  {
    label_type: "addition_source_label",
    surface: "בִּדְפוּס מַנְטוֹבָה נוֹסָף בַּמִּשְׁנָה זוֹ:",
  },
  {
    label_type: "source_witness_abbreviation",
    surface: "(כ\"ה בנ\"י)",
  },
  {
    label_type: "variant_reading_abbreviation",
    surface: "נ\"א",
    expected_occurrences: 2,
  },
];

const labels = [];
for (const definition of explicitLabelDefinitions) {
  let searchFrom = 0;
  let occurrence = 0;
  while (true) {
    const start = source.indexOf(definition.surface, searchFrom);
    if (start < 0) break;
    occurrence += 1;
    labels.push({
      id: `editorial-label.${String(labels.length + 1).padStart(2, "0")}`,
      ordinal: labels.length,
      status: "clear_label_pending_corpus_decision",
      authority: "user_direction_and_exact_surface_observation",
      label_type: definition.label_type,
      raw: definition.surface,
      source_code_unit_range: { start, end: start + definition.surface.length },
      corpus_action: "pending_manual_decision",
    });
    searchFrom = start + definition.surface.length;
  }
  const expected = definition.expected_occurrences ?? 1;
  if (occurrence !== expected) throw new Error(`Expected ${expected} occurrence(s) of ${definition.surface}, found ${occurrence}.`);
}
labels.sort((left, right) => left.source_code_unit_range.start - right.source_code_unit_range.start);
labels.forEach((label, index) => {
  label.id = `editorial-label.${String(index + 1).padStart(2, "0")}`;
  label.ordinal = index;
});

const sourceOrderedCases = topLevelCandidates
  .sort((left, right) => left.source_code_unit_range.start - right.source_code_unit_range.start)
  .map((candidate, sourceOrder) => {
    const members = inventory.candidates.filter((item) => contains(candidate.source_code_unit_range, item.source_code_unit_range));
    const caseLabels = labels.filter((label) => contains(candidate.source_code_unit_range, label.source_code_unit_range));
    return {
      source_order: sourceOrder,
      priority: caseLabels.length ? "clear_labels_first" : "remaining_structural_candidate",
      source_candidate_id: candidate.id,
      member_candidate_ids: members.map((item) => item.id),
      clear_label_ids: caseLabels.map((item) => item.id),
      marker_kind: candidate.marker_kind,
      source_code_unit_range: candidate.source_code_unit_range,
      raw: candidate.raw,
      immediate_context: candidate.immediate_context,
      decision: {
        status: "pending_manual_case_by_case",
        corpus_role: "unknown",
        action: "none",
        authority: "user_required",
        allowed_actions: [
          "retain_entire_case",
          "remove_label_only_retain_content",
          "remove_entire_case",
          "keep_unknown",
        ],
      },
    };
  });

const reviewCases = [...sourceOrderedCases]
  .sort((left, right) => {
    const priority = Number(right.priority === "clear_labels_first") - Number(left.priority === "clear_labels_first");
    return priority || left.source_order - right.source_order;
  })
  .map((reviewCase, index) => ({
    id: `editorial-review-case.${String(index + 1).padStart(2, "0")}`,
    review_order: index,
    ...reviewCase,
  }));

const ranges = sourceOrderedCases.map((item) => item.source_code_unit_range);
const proof = {
  twenty_three_observations_consolidated_exactly_once: inventory.candidates.every((candidate) =>
    reviewCases.filter((reviewCase) => reviewCase.member_candidate_ids.includes(candidate.id)).length === 1),
  exactly_fourteen_nonoverlapping_review_cases: reviewCases.length === 14
    && ranges.every((range, index) => index === 0 || ranges[index - 1].end <= range.start),
  exactly_six_clear_labels_recorded: labels.length === 6,
  clear_label_cases_are_first: reviewCases.every((reviewCase, index) => index < 6
    ? reviewCase.priority === "clear_labels_first"
    : reviewCase.priority === "remaining_structural_candidate"),
  every_label_belongs_to_exactly_one_case: labels.every((label) =>
    reviewCases.filter((reviewCase) => reviewCase.clear_label_ids.includes(label.id)).length === 1),
  every_case_matches_exact_source_range: reviewCases.every((reviewCase) =>
    source.slice(reviewCase.source_code_unit_range.start, reviewCase.source_code_unit_range.end) === reviewCase.raw),
  every_decision_remains_pending_manual: reviewCases.every((reviewCase) =>
    reviewCase.decision.status === "pending_manual_case_by_case"
    && reviewCase.decision.corpus_role === "unknown"
    && reviewCase.decision.action === "none"),
  corpus_cleaning_is_stopped: true,
  source_and_corpus_are_unchanged: true,
  deterministic_output: true,
  observation_count: inventory.candidates.length,
  review_case_count: reviewCases.length,
  clear_label_count: labels.length,
  clear_label_case_count: reviewCases.filter((item) => item.priority === "clear_labels_first").length,
  remaining_case_count: reviewCases.filter((item) => item.priority === "remaining_structural_candidate").length,
};
if (Object.entries(proof).filter(([, value]) => typeof value === "boolean").some(([, value]) => !value)) {
  throw new Error("Editorial review-case proof failed.");
}

const artifact = {
  id: "sy.editorial-review-cases",
  version: "1.0.0",
  status: "sealed_review_queue",
  corpus_cleaning_status: "stopped_pending_manual_decisions",
  decision_mode: "manual_case_by_case",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    editorial_candidate_inventory_sha256: sha256(Buffer.from(inventoryText, "utf8")),
  },
  rules: {
    consolidation: "maximal_noncontained_structural_candidate_ranges",
    ordering: "cases_with_clear_labels_first_then_remaining_cases_in_source_order",
    label_status: "clear_label_pending_corpus_decision",
    automatic_removal: "forbidden",
    automatic_corpus_decision: "forbidden",
    source_mutation: "none",
  },
  proof,
  clear_labels: labels,
  review_cases: reviewCases,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.editorial-review-cases.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...proof, source_sha256: sourceHash }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...proof, source_sha256: sourceHash }, null, 2));
}
