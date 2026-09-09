export function createConverter(spec) {
  const norm = (value) => value
    .normalize("NFD")
    .replace(/[\u0591-\u05C7]/g, "")
    .normalize("NFC")
    .replace(/[״׳"']/g, "")
    .replace(/[^א-ת0-9]+/g, " ")
    .trim();

  const surfaceWords = (value) =>
    value.match(/[א-ת][א-ת\u0591-\u05C7״׳"']*|\d+/g) || [];

  const clean = (input) => input
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/<br\s*\/?\s*>/gi, "§BR§")
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, " ")
    .replace(/<h2[^>]*>/gi, "§CHAPTER§")
    .replace(/<\/h2>/gi, "§END§")
    .replace(/<h3[^>]*>/gi, "§UNIT§")
    .replace(/<\/h3>/gi, "§END§")
    .replace(/<small[^>]*>/gi, "§NOTE§")
    .replace(/<\/small>/gi, "§ENDNOTE§")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/^[\s\S]*?return\s*\(/, "")
    .replace(/\)\s*}\s*export default[\s\S]*$/, "")
    .replace(/\r?\n/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*(§(?:CHAPTER|UNIT|END|NOTE|ENDNOTE)§)\s*/g, "$1")
    .replace(/\s*§BR§\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const extractNotes = (text) => {
    const editorial = [];
    let source = text;
    for (let pass = 0; pass < 8 && source.includes("§NOTE§"); pass += 1) {
      source = source.replace(/§NOTE§([^§]*?)§ENDNOTE§/g, (_, value) => {
        editorial.push(value.trim());
        return "";
      });
    }
    source = source.replace(/§(?:END)?NOTE§/g, "").trim();
    return {
      source,
      editorial: editorial
        .map((value) => value.replace(/§(?:END)?NOTE§/g, "").trim())
        .filter(Boolean),
    };
  };

  const segment = (text) => {
    let chapter = null;
    let count = 0;
    const output = [];
    for (const part of text.split(/(?=§CHAPTER§|§UNIT§)/)) {
      if (!part.trim()) continue;
      if (part.startsWith("§CHAPTER§")) {
        const end = part.indexOf("§END§");
        chapter = part.slice(9, end).trim() || null;
        count = 0;
        const rest = part.slice(end + 5).trim();
        if (rest) {
          for (const block of rest.split(/\n\s*\n/).filter((value) => norm(value).length >= spec.structure.minimum_unit_characters)) {
            output.push({ chapter, label: `יחידה ${++count}`, text: block.trim() });
          }
        }
      } else if (part.startsWith("§UNIT§")) {
        const end = part.indexOf("§END§");
        const label = part.slice(6, end).trim();
        count += 1;
        const rest = part.slice(end + 5).trim();
        if (rest && norm(rest).length >= spec.structure.minimum_unit_characters) {
          output.push({ chapter, label: label || `יחידה ${count}`, text: rest });
        }
      }
    }
    return output;
  };

  const indexNames = (units) => {
    const occurrences = [];
    const nameMap = new Map();

    for (const unit of units) {
      unit.tokens = surfaceWords(unit.source.text).map((surface, index) => {
        const normalized = norm(surface);
        const id = `occ.${String(occurrences.length + 1).padStart(6, "0")}`;
        const occurrence = {
          id,
          unit_id: unit.id,
          token_index: index,
          surface,
          normalized,
          evidence: "observed",
        };
        occurrences.push(occurrence);
        if (!nameMap.has(normalized)) {
          nameMap.set(normalized, {
            normalized,
            surface_forms: new Set(),
            occurrence_ids: [],
          });
        }
        const name = nameMap.get(normalized);
        name.surface_forms.add(surface);
        name.occurrence_ids.push(id);
        return id;
      });
    }

    const names = [...nameMap.values()]
      .sort((a, b) => a.normalized.localeCompare(b.normalized, "he"))
      .map((name, index) => ({
        id: `name.${String(index + 1).padStart(5, "0")}`,
        normalized: name.normalized,
        surface_forms: [...name.surface_forms],
        occurrence_ids: name.occurrence_ids,
        occurrence_count: name.occurrence_ids.length,
        evidence: "observed",
        importance: {
          value: "essential",
          authority: "user_interpretation",
          rule: "every_name_in_minimal_system_representation_is_essential",
        },
        interpretation: {
          status: "uninterpreted",
          authority: "user_interpretation_only",
        },
      }));

    const nameIdByNormalized = new Map(names.map((name) => [name.normalized, name.id]));
    for (const occurrence of occurrences) {
      occurrence.name_id = nameIdByNormalized.get(occurrence.normalized);
    }

    return {
      occurrences,
      names,
      stats: {
        total_occurrences: occurrences.length,
        total_names: names.length,
        repeated_names: names.filter((name) => name.occurrence_count > 1).length,
        single_occurrence_names: names.filter((name) => name.occurrence_count === 1).length,
      },
    };
  };

  const deriveRepetitionStructure = (units, evidence) => {
    const occurrenceById = new Map(evidence.occurrences.map((item) => [item.id, item]));
    const records = [];
    const adjacency_edges = [];
    const recordsByName = new Map();

    for (const unit of units) {
      let tokenOffset = 0;
      for (const text of unit.source.text.split(/\n+/).map((value) => value.trim()).filter(Boolean)) {
        const tokenCount = surfaceWords(text).length;
        const occurrence_ids = unit.tokens.slice(tokenOffset, tokenOffset + tokenCount);
        tokenOffset += tokenCount;
        const record = {
          id: `record.${String(records.length + 1).padStart(5, "0")}`,
          unit_id: unit.id,
          text,
          occurrence_ids,
          evidence: "observed",
          boundary_basis: "source_line_break",
        };
        records.push(record);
        const seen = new Set();
        occurrence_ids.forEach((id, index) => {
          const occurrence = occurrenceById.get(id);
          occurrence.record_id = record.id;
          if (!seen.has(occurrence.name_id)) {
            if (!recordsByName.has(occurrence.name_id)) recordsByName.set(occurrence.name_id, new Set());
            recordsByName.get(occurrence.name_id).add(record.id);
            seen.add(occurrence.name_id);
          }
          if (index < occurrence_ids.length - 1) {
            adjacency_edges.push({
              id: `next.${String(adjacency_edges.length + 1).padStart(6, "0")}`,
              from: id,
              to: occurrence_ids[index + 1],
              relation: "next_in_source_record",
              evidence: "deterministic_derivation",
            });
          }
        });
      }
    }

    const nameById = new Map(evidence.names.map((name) => [name.id, name]));
    const structuralAnchors = new Set(
      evidence.names
        .filter((name) => (recordsByName.get(name.id)?.size || 0) >= spec.repetition.minimum_record_presence_for_anchor)
        .map((name) => name.id),
    );

    const role_candidates = evidence.names.map((name) => {
      const record_presence = recordsByName.get(name.id)?.size || 0;
      const unit_presence = new Set(
        name.occurrence_ids.map((id) => occurrenceById.get(id).unit_id),
      ).size;
      let candidate;
      if (unit_presence === 1) candidate = "single_unit_value_or_name";
      else if (record_presence >= spec.repetition.minimum_record_presence_for_anchor) candidate = "category_relation_or_controller";
      else candidate = "repeated_value_or_local_structure";
      return {
        name_id: name.id,
        occurrence_count: name.occurrence_count,
        unit_presence,
        cardinality_in_single_unit: unit_presence === 1 ? name.occurrence_count : null,
        record_presence,
        candidate,
        authority: "user_interpretation",
        derivation: "multiplicity_and_scope_rule",
      };
    });

    const ngramMap = new Map();
    for (const record of records) {
      const ids = record.occurrence_ids.map((id) => occurrenceById.get(id).name_id);
      for (const size of spec.repetition.ngram_sizes) {
        for (let index = 0; index <= ids.length - size; index += 1) {
          const members = ids.slice(index, index + size);
          const signature = members.join(">");
          if (!ngramMap.has(signature)) {
            ngramMap.set(signature, { size, member_name_ids: members, occurrences: [] });
          }
          ngramMap.get(signature).occurrences.push({
            record_id: record.id,
            occurrence_ids: record.occurrence_ids.slice(index, index + size),
          });
        }
      }
    }
    const repeated_sequences = [...ngramMap.values()]
      .filter((item) => item.occurrences.length > 1)
      .map((item, index) => ({
        id: `sequence.${String(index + 1).padStart(5, "0")}`,
        ...item,
        occurrence_count: item.occurrences.length,
        evidence: "deterministic_derivation",
      }))
      .sort((a, b) => b.occurrence_count - a.occurrence_count);

    const slotMap = new Map();
    for (const record of records) {
      const occurrences = record.occurrence_ids.map((id) => occurrenceById.get(id));
      for (let start = 0; start < occurrences.length; start += 1) {
        if (!structuralAnchors.has(occurrences[start].name_id)) continue;
        let end = start + 1;
        while (end < occurrences.length && !structuralAnchors.has(occurrences[end].name_id)) end += 1;
        if (end >= occurrences.length || end === start + 1) continue;
        const values = occurrences.slice(start + 1, end);
        const key = `${occurrences[start].name_id}>${occurrences[end].name_id}`;
        if (!slotMap.has(key)) {
          slotMap.set(key, {
            left_anchor_name_id: occurrences[start].name_id,
            right_anchor_name_id: occurrences[end].name_id,
            values: [],
          });
        }
        slotMap.get(key).values.push({
          record_id: record.id,
          occurrence_ids: values.map((item) => item.id),
          name_ids: values.map((item) => item.name_id),
          surface: values.map((item) => item.surface).join(" "),
        });
        start = end - 1;
      }
    }
    const slots = [...slotMap.values()]
      .filter((slot) => new Set(slot.values.map((value) => value.record_id)).size >= spec.repetition.minimum_records_per_slot)
      .map((slot, index) => ({
        id: `slot.${String(index + 1).padStart(5, "0")}`,
        ...slot,
        left_anchor: nameById.get(slot.left_anchor_name_id).normalized,
        right_anchor: nameById.get(slot.right_anchor_name_id).normalized,
        record_count: new Set(slot.values.map((value) => value.record_id)).size,
        cardinality: [...new Set(slot.values.map((value) => value.name_ids.length))],
        candidate_role: "single_value_relation_or_controller_name",
        authority: "user_interpretation",
        evidence: "deterministic_derivation",
      }))
      .sort((a, b) => b.record_count - a.record_count);

    return {
      records,
      adjacency_edges,
      same_name_groups: evidence.names
        .filter((name) => name.occurrence_count > 1)
        .map((name) => ({
          name_id: name.id,
          occurrence_ids: name.occurrence_ids,
          occurrence_count: name.occurrence_count,
          relation: "same_normalized_name",
          evidence: "deterministic_derivation",
        })),
      role_candidates,
      repeated_sequences,
      slots,
      rules: spec.repetition,
    };
  };

  const validate = (result) => {
    const errors = [];
    const unitIds = new Set();
    for (const unit of result.units) {
      if (unitIds.has(unit.id)) errors.push(`duplicate_unit_id:${unit.id}`);
      unitIds.add(unit.id);
      if (/§/.test(unit.source.text)) errors.push(`marker_leak:${unit.id}`);
    }
    const occurrenceIds = new Set(result.evidence.occurrences.map((item) => item.id));
    const referenced = result.units.flatMap((unit) => unit.tokens);
    if (occurrenceIds.size !== result.evidence.occurrences.length) errors.push("duplicate_occurrence_id");
    if (referenced.length !== result.evidence.occurrences.length || referenced.some((id) => !occurrenceIds.has(id))) {
      errors.push("incomplete_occurrence_coverage");
    }
    for (const name of result.evidence.names) {
      const actual = result.evidence.occurrences.filter((item) => item.name_id === name.id).length;
      if (actual !== name.occurrence_count) errors.push(`invalid_occurrence_count:${name.id}`);
      if (name.importance.authority !== "user_interpretation") errors.push(`invalid_importance_authority:${name.id}`);
    }
    for (const edge of result.structure.adjacency_edges) {
      if (!occurrenceIds.has(edge.from) || !occurrenceIds.has(edge.to)) errors.push(`invalid_adjacency:${edge.id}`);
    }
    for (const slot of result.structure.slots) {
      if (!slot.values.length || slot.record_count < result.structure.rules.minimum_records_per_slot) errors.push(`invalid_slot:${slot.id}`);
    }
    if (result.source.local_copy.text !== result.input) errors.push("source_not_lossless");
    if (!result.evidence.names.some((name) => name.normalized === "פליאות")) errors.push("missing_expected_name:פליאות");
    return { valid: errors.length === 0, scope: "structural_and_lossless_only", errors };
  };

  return (input) => {
    const units = segment(clean(input))
      .map((raw, index) => {
        const extracted = extractNotes(raw.text);
        return {
          id: `sy.${String(index + 1).padStart(4, "0")}`,
          chapter_label: raw.chapter,
          unit_label: raw.label,
          boundary_basis: "input_markup",
          boundary_evidence: "observed",
          source: { text: extracted.source, language: spec.language, evidence: "observed" },
          editorial_notes: extracted.editorial,
          tokens: [],
        };
      })
      .filter((unit) => norm(unit.source.text).length >= spec.structure.minimum_unit_characters);

    units.forEach((unit, index) => {
      unit.id = `sy.${String(index + 1).padStart(4, "0")}`;
    });

    const evidence = indexNames(units);
    const structure = deriveRepetitionStructure(units, evidence);
    const result = {
      converter: { spec_id: spec.id, spec_version: spec.version },
      version: spec.version,
      generated_at: new Date().toISOString(),
      input,
      scope: {
        allowed_authorities: ["sefaria_source", "user_interpretation", "deterministic_derivation"],
        excluded: ["external_commentary", "model_generated_interpretation"],
      },
      source: {
        authority: {
          id: "sefaria_source",
          name: "Sefaria",
          url: spec.source.canonical_url,
          basis: "declared_by_user",
        },
        local_copy: {
          format: "tsx",
          text: input,
          equivalence_to_canonical: "not_yet_verified",
          evidence: "observed",
        },
      },
      axiom: spec.axiom,
      stats: {
        units: units.length,
        occurrences: evidence.stats.total_occurrences,
        names: evidence.stats.total_names,
        repeated_names: evidence.stats.repeated_names,
        single_occurrence_names: evidence.stats.single_occurrence_names,
        source_records: structure.records.length,
        repeated_sequences: structure.repeated_sequences.length,
        slot_candidates: structure.slots.length,
        single_unit_name_candidates: structure.role_candidates.filter((item) => item.unit_presence === 1).length,
      },
      evidence,
      structure,
      interpretations: {
        authority: "user_interpretation",
        entries: {},
      },
      units,
    };
    result.validation = validate(result);
    return result;
  };
}
