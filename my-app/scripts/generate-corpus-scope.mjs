import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const textContextUrl = new URL("../src/sy.text-context.json", import.meta.url);
const outputUrl = new URL("../src/sy.corpus-scope.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const textContextText = fs.readFileSync(textContextUrl, "utf8");
const textContext = JSON.parse(textContextText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (textContext.source.sha256 !== sourceHash) {
  throw new Error("The sealed text context does not match SeferYetzirah.tsx.");
}

function decide(node) {
  const flags = node.context_flags;
  if (flags.whitespace_only) {
    return { status: "excluded", class: "jsx_whitespace", authority: "user" };
  }
  if (flags.inside_h1 || flags.inside_h2 || flags.inside_h3) {
    return {
      status: "excluded",
      class: "structural_heading",
      authority: "user",
      structural_purpose: "distinguish_topics_verse_parts_and_subverses",
    };
  }
  if (flags.inside_small) {
    return { status: "included_temporarily", class: "small_text", authority: "user" };
  }
  if (flags.inside_section) {
    return { status: "included", class: "section_body", authority: "user" };
  }
  return { status: "unresolved", class: "outside_defined_scope", authority: "none" };
}

const decisions = textContext.text_nodes.map((node, index) => ({
  id: `scope-decision.${String(index + 1).padStart(4, "0")}`,
  ordinal: index,
  source_node_id: node.source_node_id,
  reading_unit_id: node.reading_unit_id,
  decision: decide(node),
}));

const count = (predicate) => decisions.filter(predicate).length;
const included = decisions.filter((item) => ["included", "included_temporarily"].includes(item.decision.status));
const everyTextNodeDecidedOnce = decisions.length === textContext.text_nodes.length
  && new Set(decisions.map((item) => item.source_node_id)).size === textContext.text_nodes.length
  && textContext.text_nodes.every((node) => decisions.some((item) => item.source_node_id === node.source_node_id));
const everyDecisionExclusive = decisions.every((item) => [
  "included",
  "included_temporarily",
  "excluded",
  "unresolved",
].includes(item.decision.status));
const noUnresolvedNodes = decisions.every((item) => item.decision.status !== "unresolved");
const countsMatchUserDecision = count((item) => item.decision.class === "section_body") === 353
  && count((item) => item.decision.class === "small_text") === 8
  && count((item) => item.decision.class === "structural_heading") === 27
  && count((item) => item.decision.class === "jsx_whitespace") === 41
  && included.length === 361;
const includedOrderPreserved = included.every((item, index) => index === 0
  || item.ordinal > included[index - 1].ordinal);

if (!everyTextNodeDecidedOnce || !everyDecisionExclusive || !noUnresolvedNodes
  || !countsMatchUserDecision || !includedOrderPreserved) {
  throw new Error("Corpus-scope proof failed.");
}

const artifact = {
  id: "sy.user-defined-corpus-scope",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "scope_only",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    text_context_sha256: sha256(Buffer.from(textContextText, "utf8")),
  },
  policy: {
    section_body: { status: "included", authority: "user" },
    small_text: { status: "included_temporarily", authority: "user" },
    headings: {
      status: "excluded_from_corpus_text",
      retained_as: "structural_separators",
      purpose: "distinguish_topics_verse_parts_and_subverses",
      authority: "user",
    },
    jsx_whitespace: { status: "excluded", authority: "user" },
    normalization: "none",
    tokenization: "forbidden",
  },
  proof: {
    every_text_node_decided_exactly_once: everyTextNodeDecidedOnce,
    every_decision_exclusive: everyDecisionExclusive,
    no_unresolved_text_nodes: noUnresolvedNodes,
    counts_match_user_decision: countsMatchUserDecision,
    included_source_order_preserved: includedOrderPreserved,
    deterministic_output: true,
    total_text_node_count: decisions.length,
    included_section_body_count: count((item) => item.decision.class === "section_body"),
    included_temporarily_small_count: count((item) => item.decision.class === "small_text"),
    total_included_count: included.length,
    excluded_heading_count: count((item) => item.decision.class === "structural_heading"),
    excluded_whitespace_count: count((item) => item.decision.class === "jsx_whitespace"),
  },
  corpus_text_node_ids: included.map((item) => item.source_node_id),
  decisions,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.corpus-scope.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
}
