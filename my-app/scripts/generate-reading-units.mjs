import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const sourceMapUrl = new URL("../src/sy.source-map.json", import.meta.url);
const outputUrl = new URL("../src/sy.reading-units.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const sourceMapText = fs.readFileSync(sourceMapUrl, "utf8");
const sourceMap = JSON.parse(sourceMapText);
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sourceHash = sha256(Buffer.from(source, "utf8"));

if (sourceMap.source.sha256 !== sourceHash) throw new Error("The source map does not match SeferYetzirah.tsx.");
if (!sourceMap.proof.exact_root_round_trip) throw new Error("The source map is not round-trip sealed.");

const units = [];
let currentNodes = [];
let groupOrdinal = 0;

function finishUnit(boundaryNode) {
  const first = currentNodes[0];
  const last = currentNodes.at(-1);
  const start = first?.code_unit_range.start ?? boundaryNode.code_unit_range.start;
  const end = last?.code_unit_range.end ?? start;
  const raw = currentNodes.map((node) => node.raw).join("");
  const textFragments = currentNodes.filter((node) => node.kind === "text");
  const groupBreakAfter = Boolean(
    boundaryNode?.boundary?.reading_group_boundary
    && boundaryNode.boundary.ordinal_in_run === boundaryNode.boundary.run_length - 1,
  );

  units.push({
    id: `reading-unit.${String(units.length + 1).padStart(4, "0")}`,
    ordinal: units.length,
    group_id: `reading-group.${String(groupOrdinal + 1).padStart(4, "0")}`,
    semantic_status: "none",
    source_node_ids: currentNodes.map((node) => node.id),
    source_code_unit_range: { start, end },
    raw,
    raw_sha256: sha256(Buffer.from(raw, "utf8")),
    text_fragments: textFragments.map((node) => ({
      source_node_id: node.id,
      raw: node.raw,
      code_unit_range: node.code_unit_range,
      byte_range: node.byte_range,
    })),
    boundary_after: {
      source_node_id: boundaryNode.id,
      raw: boundaryNode.raw,
      code_unit_range: boundaryNode.code_unit_range,
      byte_range: boundaryNode.byte_range,
      authority: boundaryNode.boundary.authority,
      run_id: boundaryNode.boundary.run_id,
      ordinal_in_run: boundaryNode.boundary.ordinal_in_run,
      run_length: boundaryNode.boundary.run_length,
      reading_group_boundary: groupBreakAfter,
    },
  });

  if (groupBreakAfter) groupOrdinal += 1;
  currentNodes = [];
}

for (const node of sourceMap.nodes) {
  if (node.kind === "br") finishUnit(node);
  else currentNodes.push(node);
}

const tailRaw = currentNodes.map((node) => node.raw).join("");
const structuralTail = {
  kind: "structural_tail",
  semantic_status: "none",
  source_node_ids: currentNodes.map((node) => node.id),
  source_code_unit_range: {
    start: currentNodes[0]?.code_unit_range.start ?? sourceMap.source.root_code_unit_range.end,
    end: currentNodes.at(-1)?.code_unit_range.end ?? sourceMap.source.root_code_unit_range.end,
  },
  raw: tailRaw,
  raw_sha256: sha256(Buffer.from(tailRaw, "utf8")),
};

const reconstructed = units.map((unit) => unit.raw + unit.boundary_after.raw).join("") + structuralTail.raw;
const rootRaw = source.slice(
  sourceMap.source.root_code_unit_range.start,
  sourceMap.source.root_code_unit_range.end,
);
const assignedIds = units.flatMap((unit) => [
  ...unit.source_node_ids,
  unit.boundary_after.source_node_id,
]).concat(structuralTail.source_node_ids);
const uniqueNodeCoverage = assignedIds.length === sourceMap.nodes.length
  && new Set(assignedIds).size === sourceMap.nodes.length
  && sourceMap.nodes.every((node) => assignedIds.includes(node.id));
const allBrUsedAsBoundaries = units.length === sourceMap.proof.br_count;
const exactRoundTrip = reconstructed === rootRaw;
const stableIds = units.every((unit, index) => unit.id === `reading-unit.${String(index + 1).padStart(4, "0")}`);

if (!uniqueNodeCoverage || !allBrUsedAsBoundaries || !exactRoundTrip || !stableIds) {
  throw new Error("Reading-unit proof failed.");
}

const groupIds = [...new Set(units.map((unit) => unit.group_id))];
const artifact = {
  id: "sy.br-reading-units",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "none",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sourceHash,
    source_map_file: "src/sy.source-map.json",
    source_map_sha256: sha256(Buffer.from(sourceMapText, "utf8")),
    root_sha256: sourceMap.source.root_sha256,
  },
  rules: {
    unit_end: "every_br",
    group_end: "last_br_in_a_consecutive_br_run_of_length_greater_than_one",
    ordering: "source_order",
    preservation: "exact_raw_source_ranges",
    interpretation: "forbidden",
  },
  proof: {
    every_source_map_node_assigned_exactly_once: uniqueNodeCoverage,
    every_br_used_exactly_once_as_a_boundary: allBrUsedAsBoundaries,
    exact_root_round_trip: exactRoundTrip,
    deterministic_output: true,
    stable_ordinal_ids: stableIds,
    unit_count: units.length,
    boundary_count: units.length,
    group_count: groupIds.length,
    group_boundary_count: units.filter((unit) => unit.boundary_after?.reading_group_boundary).length,
  },
  groups: groupIds.map((id, index) => ({
    id,
    ordinal: index,
    unit_ids: units.filter((unit) => unit.group_id === id).map((unit) => unit.id),
  })),
  units,
  structural_tail: structuralTail,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.reading-units.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
}
