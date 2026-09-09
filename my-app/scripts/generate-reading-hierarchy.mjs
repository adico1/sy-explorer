import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const sourceMapUrl = new URL("../src/sy.source-map.json", import.meta.url);
const readingUnitsUrl = new URL("../src/sy.reading-units.json", import.meta.url);
const outputUrl = new URL("../src/sy.reading-hierarchy.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const sourceMapText = fs.readFileSync(sourceMapUrl, "utf8");
const readingUnitsText = fs.readFileSync(readingUnitsUrl, "utf8");
const sourceMap = JSON.parse(sourceMapText);
const readingUnits = JSON.parse(readingUnitsText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (sourceMap.source.sha256 !== sourceHash || readingUnits.source.sha256 !== sourceHash) {
  throw new Error("The sealed inputs do not match SeferYetzirah.tsx.");
}

const nodeById = new Map(sourceMap.nodes.map((node) => [node.id, node]));
const trackedTags = new Set(["section", "h1", "h2", "h3"]);
const counters = { section: 0, h1: 0, h2: 0, h3: 0 };
const openElements = [];
const elements = [];
const assignments = [];
let latestH1 = null;
let latestH2 = null;
let latestH3 = null;

function openElement(node) {
  if (!trackedTags.has(node.tag_name)) return;
  counters[node.tag_name] += 1;
  const prefix = node.tag_name === "section" ? "section" : `heading.${node.tag_name}`;
  openElements.push({
    id: `${prefix}.${String(counters[node.tag_name]).padStart(4, "0")}`,
    tag_name: node.tag_name,
    open_node_id: node.id,
    start: node.code_unit_range.start,
    text_node_ids: [],
    text_raw: "",
  });
}

function closeElement(node) {
  if (!trackedTags.has(node.tag_name)) return;
  const index = openElements.map((item) => item.tag_name).lastIndexOf(node.tag_name);
  if (index < 0) throw new Error(`Closing ${node.tag_name} has no tracked opening tag.`);
  const item = openElements.splice(index, 1)[0];
  const element = {
    id: item.id,
    tag_name: item.tag_name,
    semantic_status: "none",
    open_node_id: item.open_node_id,
    close_node_id: node.id,
    source_code_unit_range: { start: item.start, end: node.code_unit_range.end },
    text_node_ids: item.text_node_ids,
    text_raw: item.text_raw,
    text_raw_sha256: sha256(Buffer.from(item.text_raw, "utf8")),
  };
  elements.push(element);
  if (item.tag_name === "h1") latestH1 = item.id;
  if (item.tag_name === "h2") {
    latestH2 = item.id;
    latestH3 = null;
  }
  if (item.tag_name === "h3") latestH3 = item.id;
}

function processNode(node, sectionsSeen) {
  if (node.kind === "element_open") openElement(node);
  for (const item of openElements) {
    if (item.tag_name === "section") sectionsSeen.add(item.id);
    if (node.kind === "text" && item.tag_name.startsWith("h")) {
      item.text_node_ids.push(node.id);
      item.text_raw += node.raw;
    }
  }
  if (node.kind === "element_close") closeElement(node);
}

const processedNodeIds = [];
for (const unit of readingUnits.units) {
  const sectionsSeen = new Set();
  for (const id of unit.source_node_ids) {
    const node = nodeById.get(id);
    if (!node) throw new Error(`Missing source-map node ${id}.`);
    processNode(node, sectionsSeen);
    processedNodeIds.push(id);
  }
  const boundary = nodeById.get(unit.boundary_after.source_node_id);
  if (!boundary || boundary.kind !== "br") throw new Error(`Invalid boundary for ${unit.id}.`);
  processNode(boundary, sectionsSeen);
  processedNodeIds.push(boundary.id);
  assignments.push({
    reading_unit_id: unit.id,
    semantic_status: "none",
    containing_section_ids: [...sectionsSeen],
    latest_heading_in_source_order: {
      h1: latestH1,
      h2: latestH2,
      h3: latestH3,
    },
  });
}

for (const id of readingUnits.structural_tail.source_node_ids) {
  const node = nodeById.get(id);
  if (!node) throw new Error(`Missing structural-tail node ${id}.`);
  processNode(node, new Set());
  processedNodeIds.push(id);
}

elements.sort((a, b) => a.source_code_unit_range.start - b.source_code_unit_range.start);
const allNodesProcessedOnce = processedNodeIds.length === sourceMap.nodes.length
  && new Set(processedNodeIds).size === sourceMap.nodes.length
  && sourceMap.nodes.every((node) => processedNodeIds.includes(node.id));
const everyTrackedElementClosed = openElements.length === 0
  && elements.length === Object.values(counters).reduce((sum, value) => sum + value, 0);
const everyUnitAssignedOnce = assignments.length === readingUnits.units.length
  && new Set(assignments.map((item) => item.reading_unit_id)).size === readingUnits.units.length;
const referencesValid = assignments.every((assignment) => [
  ...assignment.containing_section_ids,
  ...Object.values(assignment.latest_heading_in_source_order).filter(Boolean),
].every((id) => elements.some((element) => element.id === id)));

if (!allNodesProcessedOnce || !everyTrackedElementClosed || !everyUnitAssignedOnce || !referencesValid) {
  throw new Error("Reading-hierarchy proof failed.");
}

const artifact = {
  id: "sy.jsx-reading-hierarchy",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "none",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    source_map_sha256: sha256(Buffer.from(sourceMapText, "utf8")),
    reading_units_sha256: sha256(Buffer.from(readingUnitsText, "utf8")),
  },
  rules: {
    containment: "literal_open_and_close_jsx_tags",
    heading_context: "latest_preceding_closed_heading_in_source_order",
    h3_reset: "on_each_closed_h2",
    interpretation: "forbidden",
  },
  proof: {
    every_source_map_node_processed_exactly_once: allNodesProcessedOnce,
    every_tracked_element_closed: everyTrackedElementClosed,
    every_reading_unit_assigned_exactly_once: everyUnitAssignedOnce,
    every_reference_resolves: referencesValid,
    deterministic_output: true,
    section_count: counters.section,
    h1_count: counters.h1,
    h2_count: counters.h2,
    h3_count: counters.h3,
    reading_unit_assignment_count: assignments.length,
  },
  elements,
  reading_unit_assignments: assignments,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.reading-hierarchy.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
}
