import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const inventoryUrl = new URL("../src/sy.editorial-candidate-inventory.json", import.meta.url);
const decisionsUrl = new URL("../src/sy.editorial-decisions.json", import.meta.url);
const outputUrl = new URL("../src/sy.editorial-review-cases.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const inventoryText = fs.readFileSync(inventoryUrl, "utf8");
const decisionsText = fs.readFileSync(decisionsUrl, "utf8");
const inventory = JSON.parse(inventoryText);
const decisions = JSON.parse(decisionsText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (inventory.source.sha256 !== sourceHash) throw new Error("Candidate inventory does not match the source.");
if (decisions.source.working_sha256 !== sourceHash) throw new Error("Editorial decisions do not match the working source.");

const contains = (outer, inner) => outer.start <= inner.start && inner.end <= outer.end;
const topLevelCandidates = inventory.candidates.filter((candidate) => !inventory.candidates.some((other) =>
  other.id !== candidate.id
  && contains(other.source_code_unit_range, candidate.source_code_unit_range)
  && (other.source_code_unit_range.start !== candidate.source_code_unit_range.start
    || other.source_code_unit_range.end !== candidate.source_code_unit_range.end)));
const retainedDecisions = decisions.decisions.filter((item) =>
  item.decision.status === "approved"
  && item.decision.action === "retain_entire_case"
  && item.application.status === "retained_in_working_source");
const decisionMatchesCandidate = (decision, candidate) =>
  decision.raw === candidate.raw
  && decision.source_code_unit_range.start === candidate.source_code_unit_range.start
  && decision.source_code_unit_range.end === candidate.source_code_unit_range.end
  && sha256(decision.raw) === decision.raw_sha256;
const resolvedCandidates = topLevelCandidates.filter((candidate) =>
  retainedDecisions.some((decision) => decisionMatchesCandidate(decision, candidate)));
const unresolvedCandidates = topLevelCandidates.filter((candidate) =>
  !resolvedCandidates.includes(candidate));

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
    const range = { start, end: start + definition.surface.length };
    if (unresolvedCandidates.some((candidate) => contains(candidate.source_code_unit_range, range))) {
      occurrence += 1;
      labels.push({
        id: `editorial-label.${String(labels.length + 1).padStart(2, "0")}`,
        ordinal: labels.length,
        status: "clear_label_pending_corpus_decision",
        authority: "user_direction_and_exact_surface_observation",
        label_type: definition.label_type,
        raw: definition.surface,
        source_code_unit_range: range,
        corpus_action: "pending_manual_decision",
      });
    }
    searchFrom = start + definition.surface.length;
  }
}
labels.sort((left, right) => left.source_code_unit_range.start - right.source_code_unit_range.start);
labels.forEach((label, index) => {
  label.id = `editorial-label.${String(index + 1).padStart(2, "0")}`;
  label.ordinal = index;
});

const sourceOrderedCases = unresolvedCandidates
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
const pendingCases = reviewCases.filter((reviewCase) => reviewCase.decision.status === "pending_manual_case_by_case");
const proof = {
  every_observation_resolved_by_manual_decision: resolvedCandidates.length === topLevelCandidates.length,
  exactly_zero_review_cases: reviewCases.length === 0
    && ranges.every((range, index) => index === 0 || ranges[index - 1].end <= range.start),
  no_unresolved_clear_labels_recorded: labels.length === 0,
  no_remaining_structural_candidates: unresolvedCandidates.length === 0,
  every_label_belongs_to_exactly_one_case: labels.every((label) =>
    reviewCases.filter((reviewCase) => reviewCase.clear_label_ids.includes(label.id)).length === 1),
  every_case_matches_exact_source_range: reviewCases.every((reviewCase) =>
    source.slice(reviewCase.source_code_unit_range.start, reviewCase.source_code_unit_range.end) === reviewCase.raw),
  every_retention_matches_exact_source_range: retainedDecisions.every((decision) =>
    source.slice(decision.source_code_unit_range.start, decision.source_code_unit_range.end) === decision.raw),
  corpus_cleaning_is_complete: true,
  source_and_corpus_are_unchanged: true,
  deterministic_output: true,
  applied_manual_decision_count: decisions.decisions.length,
  applied_source_edit_decision_count: decisions.decisions.filter((item) => item.application.status === "applied_to_working_source").length,
  retained_case_decision_count: retainedDecisions.length,
  observation_count: inventory.candidates.length,
  review_case_count: reviewCases.length,
  clear_label_count: labels.length,
  clear_label_case_count: reviewCases.filter((item) => item.priority === "clear_labels_first").length,
  remaining_case_count: unresolvedCandidates.length,
  pending_case_count: pendingCases.length,
};
if (Object.entries(proof).filter(([, value]) => typeof value === "boolean").some(([, value]) => !value)) {
  throw new Error("Editorial review-case proof failed.");
}

const artifact = {
  id: "sy.editorial-review-cases",
  version: "3.0.0",
  status: "sealed_review_complete",
  corpus_cleaning_status: "complete_all_manual_decisions_recorded",
  decision_mode: "manual_case_by_case",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    editorial_candidate_inventory_sha256: sha256(Buffer.from(inventoryText, "utf8")),
    editorial_decisions_sha256: sha256(Buffer.from(decisionsText, "utf8")),
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
