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
      },
      evidence,
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
