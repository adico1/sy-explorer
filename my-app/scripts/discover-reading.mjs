import fs from "node:fs";
import spec from "../src/sy.converter.spec.json" with { type: "json" };
import { createConverter } from "../src/converter-engine.mjs";

const source = fs.readFileSync(new URL("../src/SeferYetzirah.tsx", import.meta.url), "utf8");
const corpus = createConverter(spec)(source);

const stripMarks = (value) => value
  .normalize("NFD")
  .replace(/[\u0591-\u05C7]/g, "")
  .normalize("NFC");

const tokens = (value) => stripMarks(value)
  .replace(/[״׳"']/g, "")
  .match(/[א-ת]+|\d+/g) || [];

const numberForms = [
  { words: ["עשרים", "ושתים"], value: 22 },
  { words: ["עשרים", "ושתיים"], value: 22 },
  { words: ["שתים", "עשרה"], value: 12 },
  { words: ["שתיים", "עשרה"], value: 12 },
  { words: ["שנים", "עשר"], value: 12 },
  { words: ["שלש"], value: 3 },
  { words: ["שלוש"], value: 3 },
  { words: ["שלשה"], value: 3 },
  { words: ["שלושה"], value: 3 },
  { words: ["שבע"], value: 7 },
  { words: ["שבעה"], value: 7 },
  { words: ["עשר"], value: 10 },
].sort((a, b) => b.words.length - a.words.length);

const withoutConjunction = (value) => value.replace(/^ו(?=[א-ת])/, "");

function cardinalPrefix(values) {
  for (const form of numberForms) {
    const actual = values.slice(0, form.words.length).map(withoutConjunction);
    if (form.words.every((word, index) => actual[index] === withoutConjunction(word))) {
      return { value: form.value, width: form.words.length, surface: values.slice(0, form.words.length) };
    }
  }
  return null;
}

function encodedMemberSet(text) {
  const clean = stripMarks(text).replace(/[^א-ת]/g, "");
  const wordLengths = tokens(text).map((word) => withoutConjunction(word).length);
  const hasHebrewQuote = /[״׳"']/.test(text);
  const quotedLetterTokens = hasHebrewQuote
    && wordLengths.length > 0
    && wordLengths.every((length) => length <= 4);
  const separatedSingleLetters = wordLengths.length > 1
    && wordLengths.every((length) => length === 1);
  const visiblyEncoded = quotedLetterTokens || separatedSingleLetters;
  if (!visiblyEncoded || clean.length === 0) return null;
  return [...clean];
}

const records = corpus.structure.records;
const declarations = [];
for (let index = 0; index < records.length; index += 1) {
  const record = records[index];
  const values = tokens(record.text);
  const cardinal = cardinalPrefix(values);
  if (!cardinal || values.length <= cardinal.width) continue;

  const category = values[cardinal.width];
  const currentPayload = values.slice(cardinal.width + 1).join(" ");
  const next = records[index + 1];
  const nextIsSameGroup = next?.unit_id === record.unit_id;
  const payloadSource = currentPayload
    ? record.text.split(/\s+/).slice(cardinal.width + 1).join(" ")
    : nextIsSameGroup ? next.text : "";
  const encodedMembers = encodedMemberSet(payloadSource);
  const members = encodedMembers?.length === cardinal.value ? encodedMembers : null;

  declarations.push({
    id: `candidate.category.${String(declarations.length + 1).padStart(4, "0")}`,
    rule_id: members ? "declaration.explicit_member_set" : "declaration.cardinality_noun",
    status: "discovery",
    source: {
      record_id: record.id,
      unit_id: record.unit_id,
      text: record.text,
      payload_record_id: !currentPayload && nextIsSameGroup ? next.id : null,
    },
    parse: {
      cardinality: cardinal.value,
      category_name: category,
      member_set: members,
      encoded_member_count: encodedMembers?.length ?? null,
    },
    evidence: {
      cardinality: "standard_hebrew_number",
      category_name: "syntactic_position_after_cardinality",
      member_set: members ? "orthographically_encoded_and_count_matches" : "not_established",
    },
  });
}

const complete = declarations.filter((item) => item.parse.member_set);
const cardinalityOnly = declarations.filter((item) => item.parse.encoded_member_count === null);
const malformedExplicitMemberSets = declarations.filter((item) =>
  item.parse.encoded_member_count !== null && item.parse.member_set === null
);

const categoryCardinalities = new Map();
for (const item of complete) {
  const key = withoutConjunction(item.parse.category_name);
  if (!categoryCardinalities.has(key)) categoryCardinalities.set(key, new Set());
  categoryCardinalities.get(key).add(item.parse.cardinality);
}

const contradictions = [...categoryCardinalities.entries()]
  .filter(([, values]) => values.size > 1)
  .map(([category_name, values]) => ({
    type: "category_has_multiple_declared_cardinalities",
    category_name,
    values: [...values],
  }));

const counterexamples = malformedExplicitMemberSets
  .map((item) => ({
    candidate_id: item.id,
    reason: "explicitly_encoded_member_count_does_not_match_cardinality",
    declared_cardinality: item.parse.cardinality,
    encoded_member_count: item.parse.encoded_member_count,
    source: item.source,
  }));

const report = {
  id: "sy.systemic-reading.discovery.explicit-member-set.2",
  status: "discovery",
  corpus_version: corpus.version,
  source_sha256: corpus.seal.source_sha256,
  rule: spec.reading_specification.discovery_rules.find((rule) => rule.id === "declaration.explicit_member_set"),
  contract: spec.reading_specification.discovery_contract,
  coverage: {
    authoritative_records: records.length,
    cardinality_noun_matches: declarations.length,
    explicit_member_set_matches: complete.length,
    cardinality_only_matches: cardinalityOnly.length,
    malformed_explicit_member_sets: counterexamples.length,
    contradictions: contradictions.length,
  },
  complete_declarations: complete,
  cardinality_only_matches: cardinalityOnly,
  malformed_explicit_member_sets: counterexamples,
  contradictions,
  decision: {
    can_seal: contradictions.length === 0 && counterexamples.length === 0 && complete.length > 0,
    reason: counterexamples.length
      ? "An explicitly encoded member set disagrees with its cardinality; the rule remains discovery."
      : contradictions.length
        ? "Contradictions were found; the rule remains discovery."
        : "Every explicitly encoded member-set match is complete and contradiction-free; cardinality-only statements are outside this narrow rule.",
  },
};

console.log(JSON.stringify(report, null, 2));
