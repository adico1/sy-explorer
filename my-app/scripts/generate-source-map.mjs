import crypto from "node:crypto";
import fs from "node:fs";

const sourceUrl = new URL("../src/SeferYetzirah.tsx", import.meta.url);
const outputUrl = new URL("../src/sy.source-map.json", import.meta.url);
const source = fs.readFileSync(sourceUrl, "utf8");
const sourceBytes = Buffer.from(source, "utf8");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const byteOffset = (codeUnitOffset) => Buffer.byteLength(source.slice(0, codeUnitOffset), "utf8");

const rootStart = source.indexOf("<main>");
const rootCloseStart = source.lastIndexOf("</main>");
if (rootStart < 0 || rootCloseStart < rootStart) throw new Error("The JSX <main> root was not found.");
const rootEnd = rootCloseStart + "</main>".length;

const nodes = [];
let cursor = rootStart;
while (cursor < rootEnd) {
  const start = cursor;
  if (source[cursor] === "<") {
    const close = source.indexOf(">", cursor);
    if (close < 0 || close >= rootEnd) throw new Error(`Unclosed JSX tag at ${cursor}.`);
    cursor = close + 1;
  } else {
    const nextTag = source.indexOf("<", cursor);
    cursor = nextTag < 0 || nextTag > rootEnd ? rootEnd : nextTag;
  }

  const raw = source.slice(start, cursor);
  const tag = raw.startsWith("<") ? raw.match(/^<\s*(\/)?\s*([A-Za-z][A-Za-z0-9.]*)/) : null;
  const tagName = tag?.[2] || null;
  let kind = "text";
  if (tagName === "br") kind = "br";
  else if (tag?.[1]) kind = "element_close";
  else if (tagName && /\/\s*>$/.test(raw)) kind = "element_self_closing";
  else if (tagName) kind = "element_open";

  nodes.push({
    id: `jsx.${String(nodes.length + 1).padStart(5, "0")}`,
    ordinal: nodes.length,
    kind,
    tag_name: tagName,
    code_unit_range: { start, end: cursor },
    byte_range: { start: byteOffset(start), end: byteOffset(cursor) },
    raw,
    raw_sha256: sha256(Buffer.from(raw, "utf8")),
  });
}

let boundaryRun = 0;
for (let index = 0; index < nodes.length; index += 1) {
  if (nodes[index].kind !== "br") continue;
  const members = [index];
  let scan = index + 1;
  while (scan < nodes.length) {
    if (nodes[scan].kind === "text" && /^\s*$/.test(nodes[scan].raw)) {
      scan += 1;
      continue;
    }
    if (nodes[scan].kind !== "br") break;
    members.push(scan);
    scan += 1;
  }
  boundaryRun += 1;
  for (let ordinal = 0; ordinal < members.length; ordinal += 1) {
    nodes[members[ordinal]].boundary = {
      authority: "user_interpretation",
      run_id: `br-run.${String(boundaryRun).padStart(4, "0")}`,
      ordinal_in_run: ordinal,
      run_length: members.length,
      reading_boundary: true,
      reading_group_boundary: members.length > 1,
    };
  }
  index = scan - 1;
}

const rootRaw = source.slice(rootStart, rootEnd);
const reconstructed = nodes.map((node) => node.raw).join("");
const contiguous = nodes.every((node, index) => index === 0
  ? node.code_unit_range.start === rootStart
  : node.code_unit_range.start === nodes[index - 1].code_unit_range.end);
const uniqueCoverage = contiguous
  && nodes.at(-1)?.code_unit_range.end === rootEnd
  && reconstructed.length === rootRaw.length;
const exactRoundTrip = reconstructed === rootRaw;
if (!uniqueCoverage || !exactRoundTrip) throw new Error("Source-map coverage or round-trip verification failed.");

const map = {
  id: "sy.jsx-source-map",
  version: "1.0.0",
  status: "sealed",
  semantic_status: "none",
  source: {
    file: "src/SeferYetzirah.tsx",
    sha256: sha256(sourceBytes),
    byte_length: sourceBytes.length,
    root_code_unit_range: { start: rootStart, end: rootEnd },
    root_byte_range: { start: byteOffset(rootStart), end: byteOffset(rootEnd) },
    root_sha256: sha256(Buffer.from(rootRaw, "utf8")),
  },
  rules: {
    map_scope: "exact_jsx_main_source_slice",
    ordering: "source_order",
    preservation: "exact_utf8_raw_substrings",
    interpretation: "forbidden",
    br_authority: "user_interpretation",
    consecutive_br: "reading_group_boundary",
  },
  proof: {
    every_root_code_unit_covered_exactly_once: uniqueCoverage,
    exact_root_round_trip: exactRoundTrip,
    deterministic_output: true,
    node_count: nodes.length,
    br_count: nodes.filter((node) => node.kind === "br").length,
    br_run_count: boundaryRun,
  },
  nodes,
};

const serialized = `${JSON.stringify(map, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = fs.readFileSync(outputUrl, "utf8");
  if (existing !== serialized) throw new Error("sy.source-map.json is stale or non-deterministic.");
  console.log(JSON.stringify({ valid: true, ...map.proof, source_sha256: map.source.sha256 }, null, 2));
} else {
  fs.writeFileSync(outputUrl, serialized);
  console.log(JSON.stringify({ written: true, ...map.proof, source_sha256: map.source.sha256 }, null, 2));
}
