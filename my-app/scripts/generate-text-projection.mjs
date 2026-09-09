import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const sourceMapUrl = new URL("../src/sy.source-map.json", import.meta.url);
const readingUnitsUrl = new URL("../src/sy.reading-units.json", import.meta.url);
const outputUrl = new URL("../src/sy.text-projection.json", import.meta.url);
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
const projectFragments = (ids) => ids
  .map((id) => nodeById.get(id))
  .filter((node) => node?.kind === "text")
  .map((node) => ({
    source_node_id: node.id,
    code_unit_range: node.code_unit_range,
    byte_range: node.byte_range,
    raw: node.raw,
    raw_sha256: node.raw_sha256,
  }));

const units = readingUnits.units.map((unit) => {
  const fragments = projectFragments(unit.source_node_ids);
  const rawText = fragments.map((fragment) => fragment.raw).join("");
  return {
    reading_unit_id: unit.id,
    semantic_status: "none",
    normalization: "none",
    fragment_count: fragments.length,
    fragments,
    raw_text: rawText,
    raw_text_sha256: sha256(Buffer.from(rawText, "utf8")),
  };
});

const tailFragments = projectFragments(readingUnits.structural_tail.source_node_ids);
const tailRawText = tailFragments.map((fragment) => fragment.raw).join("");
const structuralTail = {
  kind: "structural_tail_text",
  semantic_status: "none",
  normalization: "none",
  fragment_count: tailFragments.length,
  fragments: tailFragments,
  raw_text: tailRawText,
  raw_text_sha256: sha256(Buffer.from(tailRawText, "utf8")),
};

const projectedFragments = [
  ...units.flatMap((unit) => unit.fragments),
  ...structuralTail.fragments,
];
const sourceTextNodes = sourceMap.nodes.filter((node) => node.kind === "text");
const projectedIds = projectedFragments.map((fragment) => fragment.source_node_id);
const everyTextNodeProjectedOnce = projectedIds.length === sourceTextNodes.length
  && new Set(projectedIds).size === sourceTextNodes.length
  && sourceTextNodes.every((node) => projectedIds.includes(node.id));
const everyFragmentMatchesSource = projectedFragments.every((fragment) => {
  const rawFromSource = source.slice(fragment.code_unit_range.start, fragment.code_unit_range.end);
  return rawFromSource === fragment.raw
    && sha256(Buffer.from(rawFromSource, "utf8")) === fragment.raw_sha256;
});
const projectedStream = projectedFragments.map((fragment) => fragment.raw).join("");
const sourceTextNodeStream = sourceTextNodes.map((node) => node.raw).join("");
const exactTextNodeStreamRoundTrip = projectedStream === sourceTextNodeStream;
const everyUnitProjectedOnce = units.length === readingUnits.units.length
  && new Set(units.map((unit) => unit.reading_unit_id)).size === readingUnits.units.length;
const deterministicIds = units.every((unit, index) => unit.reading_unit_id === readingUnits.units[index].id);

if (!everyTextNodeProjectedOnce || !everyFragmentMatchesSource || !exactTextNodeStreamRoundTrip
  || !everyUnitProjectedOnce || !deterministicIds) {
  throw new Error("Exact text-projection proof failed.");
}

const artifact = {
  id: "sy.exact-text-node-projection",
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
    included_nodes: "source_map_nodes_with_kind_text",
    ordering: "source_order",
    preservation: "exact_raw_utf8_text_node_content",
    whitespace_normalization: "none",
    niqqud_normalization: "none",
    punctuation_normalization: "none",
    tokenization: "forbidden",
    interpretation: "forbidden",
  },
  proof: {
    every_text_node_projected_exactly_once: everyTextNodeProjectedOnce,
    every_fragment_matches_source_range: everyFragmentMatchesSource,
    exact_text_node_stream_round_trip: exactTextNodeStreamRoundTrip,
    every_reading_unit_projected_exactly_once: everyUnitProjectedOnce,
    deterministic_output: true,
    stable_reading_unit_references: deterministicIds,
    reading_unit_count: units.length,
    text_node_count: sourceTextNodes.length,
    nonempty_unit_projection_count: units.filter((unit) => unit.raw_text.length > 0).length,
    empty_unit_projection_count: units.filter((unit) => unit.raw_text.length === 0).length,
    structural_tail_text_node_count: structuralTail.fragment_count,
  },
  units,
  structural_tail: structuralTail,
};

const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.text-projection.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...artifact.proof, source_sha256: sourceHash }, null, 2));
}
