import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const sourceMapUrl = new URL("../src/sy.source-map.json", import.meta.url);
const textProjectionUrl = new URL("../src/sy.text-projection.json", import.meta.url);
const outputUrl = new URL("../src/sy.text-context.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const sourceMapText = fs.readFileSync(sourceMapUrl, "utf8");
const textProjectionText = fs.readFileSync(textProjectionUrl, "utf8");
const sourceMap = JSON.parse(sourceMapText);
const textProjection = JSON.parse(textProjectionText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (sourceMap.source.sha256 !== sourceHash || textProjection.source.sha256 !== sourceHash) {
  throw new Error("The sealed inputs do not match SeferYetzirah.tsx.");
}

const projectionLocation = new Map();
for (const unit of textProjection.units) {
  for (const fragment of unit.fragments) {
    if (projectionLocation.has(fragment.source_node_id)) throw new Error(`Duplicate projection ${fragment.source_node_id}.`);
    projectionLocation.set(fragment.source_node_id, { reading_unit_id: unit.reading_unit_id, location: "reading_unit" });
  }
}
for (const fragment of textProjection.structural_tail.fragments) {
  if (projectionLocation.has(fragment.source_node_id)) throw new Error(`Duplicate projection ${fragment.source_node_id}.`);
  projectionLocation.set(fragment.source_node_id, { reading_unit_id: null, location: "structural_tail" });
}

const counters = new Map();
const stack = [];
const elements = [];
const textNodes = [];

for (const node of sourceMap.nodes) {
  if (node.kind === "element_open") {
    const count = (counters.get(node.tag_name) || 0) + 1;
    counters.set(node.tag_name, count);
    stack.push({
      id: `element.${node.tag_name}.${String(count).padStart(4, "0")}`,
      tag_name: node.tag_name,
      parent_element_id: stack.at(-1)?.id || null,
      open_node_id: node.id,
      start: node.code_unit_range.start,
    });
    continue;
  }

  if (node.kind === "element_close") {
    const open = stack.pop();
    if (!open || open.tag_name !== node.tag_name) {
      throw new Error(`JSX nesting mismatch at ${node.id}.`);
    }
    elements.push({
      id: open.id,
      tag_name: open.tag_name,
      parent_element_id: open.parent_element_id,
      open_node_id: open.open_node_id,
      close_node_id: node.id,
      source_code_unit_range: { start: open.start, end: node.code_unit_range.end },
    });
    continue;
  }

  if (node.kind !== "text") continue;
  const projection = projectionLocation.get(node.id);
  if (!projection) throw new Error(`Text node ${node.id} is missing from the sealed projection.`);
  const ancestorTags = stack.map((element) => element.tag_name);
  textNodes.push({
    source_node_id: node.id,
    reading_unit_id: projection.reading_unit_id,
    projection_location: projection.location,
    source_code_unit_range: node.code_unit_range,
    immediate_parent_element_id: stack.at(-1)?.id || null,
    ancestor_element_ids: stack.map((element) => element.id),
    ancestor_tags: ancestorTags,
    context_flags: {
      whitespace_only: /^\s*$/.test(node.raw),
      inside_section: ancestorTags.includes("section"),
      inside_h1: ancestorTags.includes("h1"),
      inside_h2: ancestorTags.includes("h2"),
      inside_h3: ancestorTags.includes("h3"),
      inside_small: ancestorTags.includes("small"),
    },
    corpus_inclusion: {
      status: "undecided",
      authority: "requires_user_decision",
    },
  });
}

elements.sort((a, b) => a.source_code_unit_range.start - b.source_code_unit_range.start);
const sourceTextNodes = sourceMap.nodes.filter((node) => node.kind === "text");
const everyTextNodeMappedOnce = textNodes.length === sourceTextNodes.length
  && new Set(textNodes.map((node) => node.source_node_id)).size === sourceTextNodes.length
  && sourceTextNodes.every((node) => textNodes.some((mapped) => mapped.source_node_id === node.id));
const everyElementClosed = stack.length === 0
  && elements.length === [...counters.values()].reduce((sum, count) => sum + count, 0);
const everyAncestorReferenceResolves = textNodes.every((node) => node.ancestor_element_ids
  .every((id) => elements.some((element) => element.id === id)));
const everyProjectionReferenceResolves = textNodes.every((node) => projectionLocation.has(node.source_node_id));
const everyCorpusDecisionUnset = textNodes.every((node) => node.corpus_inclusion.status === "undecided");

if (!everyTextNodeMappedOnce || !everyElementClosed || !everyAncestorReferenceResolves
  || !everyProjectionReferenceResolves || !everyCorpusDecisionUnset) {
  throw new Error("Text-context proof failed.");
}

const countFlag = (flag) => textNodes.filter((node) => node.context_flags[flag]).length;
const artifact = {
  id: "sy.literal-jsx-text-context",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "none",
  corpus_scope_status: "undecided",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    source_map_sha256: sha256(Buffer.from(sourceMapText, "utf8")),
    text_projection_sha256: sha256(Buffer.from(textProjectionText, "utf8")),
  },
  rules: {
    context: "literal_jsx_ancestor_stack",
    whitespace_flag: "raw_text_matches_only_whitespace",
    corpus_inclusion: "undecided_for_every_text_node",
    normalization: "none",
    interpretation: "forbidden",
  },
  proof: {
    every_text_node_mapped_exactly_once: everyTextNodeMappedOnce,
    every_jsx_element_closed: everyElementClosed,
    every_ancestor_reference_resolves: everyAncestorReferenceResolves,
    every_projection_reference_resolves: everyProjectionReferenceResolves,
    every_corpus_decision_remains_unset: everyCorpusDecisionUnset,
    deterministic_output: true,
    text_node_count: textNodes.length,
    jsx_element_count: elements.length,
    whitespace_only_count: countFlag("whitespace_only"),
    inside_section_count: countFlag("inside_section"),
    inside_h1_count: countFlag("inside_h1"),
    inside_h2_count: countFlag("inside_h2"),
    inside_h3_count: countFlag("inside_h3"),
    inside_small_count: countFlag("inside_small"),
  },
  elements,
  text_nodes: textNodes,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.text-context.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
}
