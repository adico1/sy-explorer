import { useEffect, useMemo, useRef, useState } from "react";
import { ComparisonWorkspace } from "./ComparisonWorkspace";
import { InterpretationForm } from "./InterpretationForm";
import { RelationshipWorkspace, type UserRelationship } from "./RelationshipWorkspace";
import { RevisionHistory, type WorkspaceRevision } from "./RevisionHistory";
import { ThreeMothersWorkspace } from "./ThreeMothersWorkspace";
import sourceText from "./SeferYetzirah.tsx?raw";
import editorialDecisions from "./sy.editorial-decisions.json";
import spec from "./sy.converter.spec.json";
import trailingApostropheCases from "./sy.trailing-apostrophe-cases.json";
import { createConverter } from "./converter-engine.mjs";

const convert = createConverter(spec);
const storageKey = `sy-explorer:user-interpretations:${spec.version}`;
const apostropheStorageKey = `sy-explorer:apostrophe-decisions:${spec.version}`;
const relationshipStorageKey = `sy-explorer:user-relationships:${spec.version}`;
const revisionStorageKey = `sy-explorer:revision-history:${spec.version}`;

type Interpretation = {
  role: string;
  meaning: string;
  note: string;
  fields?: Record<string, string>;
  status: InterpretationStatus;
  evidence_occurrence_ids: string[];
  authority: "user_interpretation";
  updated_at: string;
};

type Interpretations = Record<string, Interpretation>;
type InterpretationStatus = "draft" | "accepted" | "rejected" | "unresolved";
type ApostropheDecision = {
  role: string;
  note: string;
  authority: "user_interpretation";
  updated_at: string;
};
type ApostropheDecisions = Record<string, ApostropheDecision>;
type Filter = "all" | "repeated" | "single" | "interpreted" | "uninterpreted" | InterpretationStatus;
type View = "reading" | "mothers" | "names" | "compare" | "relations" | "review" | "history" | "patterns";

const roleLabels: Record<string, string> = {
  name: "שם",
  operation: "פעולה",
  entity: "ישות",
  number: "מספר",
  domain: "תחום",
  class: "מחלקה",
  representation: "ייצוג",
  state: "מצב",
  relation: "יחס",
  category: "קטגוריה",
  controller: "בקר",
  value: "ערך",
};

const statusLabels: Record<InterpretationStatus, string> = {
  draft: "טיוטה",
  accepted: "מאושר",
  rejected: "נדחה",
  unresolved: "לא הוכרע",
};

function interpretationStatus(interpretation?: Partial<Interpretation>): InterpretationStatus {
  return ["draft", "accepted", "rejected", "unresolved"].includes(interpretation?.status || "")
    ? interpretation!.status as InterpretationStatus
    : "draft";
}

function relationshipStatus(relationship?: Partial<UserRelationship>): InterpretationStatus {
  return ["draft", "accepted", "rejected", "unresolved"].includes(relationship?.status || "")
    ? relationship!.status as InterpretationStatus
    : "draft";
}

function loadInterpretations(): Interpretations {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return typeof value === "object" && value ? value : {};
  } catch {
    return {};
  }
}

function loadApostropheDecisions(): ApostropheDecisions {
  try {
    const value = JSON.parse(localStorage.getItem(apostropheStorageKey) || "{}");
    return typeof value === "object" && value ? value : {};
  } catch {
    return {};
  }
}

function loadRelationships(): UserRelationship[] {
  try {
    const value = JSON.parse(localStorage.getItem(relationshipStorageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function loadRevisionHistory(): WorkspaceRevision[] {
  try {
    const value = JSON.parse(localStorage.getItem(revisionStorageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function highlightedText(text: string, surface: string) {
  const index = text.indexOf(surface);
  if (index < 0) return text;
  return <>{text.slice(0, index)}<mark>{surface}</mark>{text.slice(index + surface.length)}</>;
}

export function SYConverter() {
  return null;
}

export function SYConverterWorkbench() {
  const [corpus] = useState<any>(() => convert(sourceText));
  const [interpretations, setInterpretations] = useState<Interpretations>(loadInterpretations);
  const [apostropheDecisions, setApostropheDecisions] = useState<ApostropheDecisions>(loadApostropheDecisions);
  const [relationships, setRelationships] = useState<UserRelationship[]>(loadRelationships);
  const [revisionHistory, setRevisionHistory] = useState<WorkspaceRevision[]>(loadRevisionHistory);
  const [selectedId, setSelectedId] = useState<string>(() => corpus.evidence.names[0]?.id || "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("reading");
  const [storageMessage, setStorageMessage] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function selectName(event: Event) {
      const normalized = (event as CustomEvent<{ normalized: string }>).detail.normalized;
      const name = corpus.evidence.names.find((item: any) => item.normalized === normalized);
      if (!name) return;
      setSelectedId(name.id);
      setQuery("");
      setFilter("all");
      setView("names");
    }
    window.addEventListener("sy:select-name", selectName);
    return () => window.removeEventListener("sy:select-name", selectName);
  }, [corpus]);

  const names = useMemo(() => {
    const needle = query.trim();
    return [...corpus.evidence.names]
      .filter((name: any) => !needle || name.normalized.includes(needle) || name.surface_forms.some((form: string) => form.includes(needle)))
      .filter((name: any) => {
        if (filter === "repeated") return name.occurrence_count > 1;
        if (filter === "single") return name.occurrence_count === 1;
        if (filter === "interpreted") return Boolean(interpretations[name.id]);
        if (filter === "uninterpreted") return !interpretations[name.id];
        if (["draft", "accepted", "rejected", "unresolved"].includes(filter)) return interpretationStatus(interpretations[name.id]) === filter && Boolean(interpretations[name.id]);
        return true;
      })
      .sort((a: any, b: any) => b.occurrence_count - a.occurrence_count || a.normalized.localeCompare(b.normalized, "he"));
  }, [corpus, filter, interpretations, query]);

  const selected = corpus.evidence.names.find((name: any) => name.id === selectedId) || names[0];
  const selectedInterpretation = selected ? interpretations[selected.id] : undefined;
  const occurrences = selected
    ? selected.occurrence_ids.map((id: string) => corpus.evidence.occurrences.find((item: any) => item.id === id))
    : [];
  const interpretationCounts = useMemo(() => Object.values(interpretations).reduce((counts, interpretation) => {
    counts[interpretationStatus(interpretation)] += 1;
    return counts;
  }, { draft: 0, accepted: 0, rejected: 0, unresolved: 0 } as Record<InterpretationStatus, number>), [interpretations]);

  const exportedCorpus = useMemo(() => {
    const value = structuredClone(corpus);
    value.interpretations.entries = interpretations;
    value.interpretations.accepted_entries = Object.fromEntries(Object.entries(interpretations).filter(([, interpretation]) => interpretationStatus(interpretation) === "accepted"));
    value.interpretations.relationships = relationships;
    value.interpretations.accepted_relationships = relationships.filter((relationship) => relationshipStatus(relationship) === "accepted" && relationship.evidence_occurrence_ids?.length);
    value.interpretations.revision_history = revisionHistory;
    value.stats.interpreted_names = Object.keys(interpretations).length;
    value.stats.accepted_interpretations = interpretationCounts.accepted;
    value.stats.draft_interpretations = interpretationCounts.draft;
    value.stats.unresolved_interpretations = interpretationCounts.unresolved;
    value.stats.rejected_interpretations = interpretationCounts.rejected;
    value.stats.accepted_relationships = value.interpretations.accepted_relationships.length;
    value.stats.relationships_in_review = relationships.filter((relationship) => ["draft", "unresolved"].includes(relationshipStatus(relationship))).length;
    value.stats.uninterpreted_names = value.stats.names - value.stats.interpreted_names;
    value.evidence.names = value.evidence.names.map((name: any) => ({
      ...name,
      interpretation: interpretations[name.id] || {
        status: "uninterpreted",
        authority: "user_interpretation_only",
      },
    }));
    return value;
  }, [corpus, interpretationCounts, interpretations, relationships, revisionHistory]);

  function recordRevision(revision: Omit<WorkspaceRevision, "id" | "created_at">) {
    const entry: WorkspaceRevision = {
      ...revision,
      id: `revision.${crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
      before: revision.before ? structuredClone(revision.before) : null,
      after: revision.after ? structuredClone(revision.after) : null,
    };
    setRevisionHistory((current) => {
      const next = [entry, ...current].slice(0, 1000);
      localStorage.setItem(revisionStorageKey, JSON.stringify(next));
      return next;
    });
  }

  function saveInterpretation(value: Pick<Interpretation, "role" | "meaning" | "note" | "fields" | "status" | "evidence_occurrence_ids">) {
    if (!selected) return;
    const entry: Interpretation = {
      ...value,
      authority: "user_interpretation",
      updated_at: new Date().toISOString(),
    };
    recordRevision({
      entity_type: "interpretation",
      entity_id: selected.id,
      action: selectedInterpretation ? "update" : "create",
      before: selectedInterpretation || null,
      after: entry,
    });
    const next = { ...interpretations, [selected.id]: entry };
    setInterpretations(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function clearInterpretation() {
    if (!selected) return;
    const previous = interpretations[selected.id];
    if (!previous) return;
    const next = { ...interpretations };
    delete next[selected.id];
    setInterpretations(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    recordRevision({ entity_type: "interpretation", entity_id: selected.id, action: "delete", before: previous, after: null });
  }

  function saveRelationships(next: UserRelationship[]) {
    const previousById = new Map(relationships.map((relationship) => [relationship.id, relationship]));
    const nextById = new Map(next.map((relationship) => [relationship.id, relationship]));
    const ids = new Set([...previousById.keys(), ...nextById.keys()]);
    for (const id of ids) {
      const before = previousById.get(id) || null;
      const after = nextById.get(id) || null;
      if (JSON.stringify(before) === JSON.stringify(after)) continue;
      recordRevision({
        entity_type: "relationship",
        entity_id: id,
        action: !before ? "create" : !after ? "delete" : "update",
        before,
        after,
      });
    }
    setRelationships(next);
    localStorage.setItem(relationshipStorageKey, JSON.stringify(next));
  }

  function rollbackRevision(revision: WorkspaceRevision) {
    if (revision.entity_type === "interpretation") {
      const current = interpretations[revision.entity_id] || null;
      const target = revision.before as Interpretation | null;
      const next = { ...interpretations };
      if (target) next[revision.entity_id] = target;
      else delete next[revision.entity_id];
      setInterpretations(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      recordRevision({ entity_type: "interpretation", entity_id: revision.entity_id, action: "rollback", before: current, after: target, rollback_of: revision.id });
      return;
    }
    const current = relationships.find((relationship) => relationship.id === revision.entity_id) || null;
    const target = revision.before as UserRelationship | null;
    const next = relationships.filter((relationship) => relationship.id !== revision.entity_id);
    if (target) next.push(target);
    setRelationships(next);
    localStorage.setItem(relationshipStorageKey, JSON.stringify(next));
    recordRevision({ entity_type: "relationship", entity_id: revision.entity_id, action: "rollback", before: current, after: target, rollback_of: revision.id });
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(exportedCorpus, null, 2) + "\n"], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sy.evidence-corpus-${exportedCorpus.version}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function downloadInterpretations() {
    const backup = {
      format: "sy-explorer-workspace",
      corpus_version: corpus.version,
      exported_at: new Date().toISOString(),
      interpretations,
      apostrophe_decisions: apostropheDecisions,
      relationships,
      revision_history: revisionHistory,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sy-workspace-${corpus.version}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setStorageMessage("הפירושים גובו לקובץ.");
  }

  async function importInterpretations(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const importedInterpretations = backup.format === "sy-explorer-interpretations" ? backup.entries : backup.interpretations;
      if (!["sy-explorer-interpretations", "sy-explorer-workspace"].includes(backup.format) || typeof importedInterpretations !== "object" || !importedInterpretations) {
        throw new Error("invalid_format");
      }
      const knownIds = new Set(corpus.evidence.names.map((name: any) => name.id));
      const occurrenceIdsByName = new Map(corpus.evidence.names.map((name: any) => [name.id, new Set(name.occurrence_ids)]));
      const next = Object.fromEntries(Object.entries(importedInterpretations).flatMap(([id, entry]) => {
        if (!knownIds.has(id) || typeof entry !== "object" || !entry) return [];
        const value = entry as Partial<Interpretation>;
        if (typeof value.role !== "string" || typeof value.meaning !== "string" || typeof value.note !== "string") return [];
        const validOccurrenceIds = occurrenceIdsByName.get(id) as Set<string>;
        return [[id, {
          ...value,
          status: interpretationStatus(value),
          evidence_occurrence_ids: (Array.isArray(value.evidence_occurrence_ids) ? value.evidence_occurrence_ids : []).filter((occurrenceId) => validOccurrenceIds.has(occurrenceId)),
        }]];
      })) as Interpretations;
      setInterpretations(next);
      localStorage.setItem(storageKey, JSON.stringify(next));
      const validCaseIds = new Set(trailingApostropheCases.cases.map((item) => item.id));
      const nextApostropheDecisions = Object.fromEntries(Object.entries(backup.apostrophe_decisions || {}).filter(([id, entry]) => {
        if (!validCaseIds.has(id) || typeof entry !== "object" || !entry) return false;
        const value = entry as Partial<ApostropheDecision>;
        return typeof value.role === "string" && typeof value.note === "string";
      })) as ApostropheDecisions;
      setApostropheDecisions(nextApostropheDecisions);
      localStorage.setItem(apostropheStorageKey, JSON.stringify(nextApostropheDecisions));
      const nextRelationships = (Array.isArray(backup.relationships) ? backup.relationships : []).flatMap((item: Partial<UserRelationship>) => {
        if (typeof item.id !== "string"
          || !knownIds.has(item.from_name_id)
          || !knownIds.has(item.to_name_id)
          || typeof item.relation !== "string"
          || typeof item.note !== "string") return [];
        const sourceOccurrences = occurrenceIdsByName.get(item.from_name_id!) as Set<string>;
        const targetOccurrences = occurrenceIdsByName.get(item.to_name_id!) as Set<string>;
        const validOccurrenceIds = new Set([...sourceOccurrences, ...targetOccurrences]);
        const createdAt = typeof item.created_at === "string" ? item.created_at : new Date().toISOString();
        return [{
          ...item,
          status: relationshipStatus(item),
          evidence_occurrence_ids: (Array.isArray(item.evidence_occurrence_ids) ? item.evidence_occurrence_ids : []).filter((occurrenceId) => validOccurrenceIds.has(occurrenceId)),
          created_at: createdAt,
          updated_at: typeof item.updated_at === "string" ? item.updated_at : createdAt,
        } as UserRelationship];
      });
      setRelationships(nextRelationships);
      localStorage.setItem(relationshipStorageKey, JSON.stringify(nextRelationships));
      const nextRevisionHistory = (Array.isArray(backup.revision_history) ? backup.revision_history : revisionHistory).filter((item: Partial<WorkspaceRevision>) =>
        typeof item.id === "string"
        && ["interpretation", "relationship"].includes(item.entity_type || "")
        && typeof item.entity_id === "string"
        && ["create", "update", "delete", "rollback"].includes(item.action || "")
        && typeof item.created_at === "string");
      setRevisionHistory(nextRevisionHistory);
      localStorage.setItem(revisionStorageKey, JSON.stringify(nextRevisionHistory));
      setStorageMessage(`שוחזרו ${Object.keys(next).length} פירושים, ${nextRelationships.length} קשרים, ${nextRevisionHistory.length} גרסאות ו־${Object.keys(nextApostropheDecisions).length} הכרעות כתיב${backup.corpus_version === corpus.version ? "" : " מגרסת קורפוס אחרת"}.`);
    } catch {
      setStorageMessage("הקובץ אינו גיבוי פירושים תקין.");
    }
  }

  return (
    <section className="converter name-explorer" dir="rtl" aria-label="SY Evidence Corpus">
      <header className="converter__header">
        <div>
          <small>SY EVIDENCE CORPUS · v{corpus.version}</small>
          <h2>שמות ומופעים בספר יצירה</h2>
        </div>
        <span className={corpus.validation.valid ? "converter__valid" : "converter__invalid"}>
          {corpus.validation.valid ? "המקור נשמר בשלמותו" : "נמצאה שגיאת מקור"}
        </span>
      </header>

      <div className="source-authority">
        <strong>מהדורת העבודה חתומה</strong>
        <span>נוסח ספריא אומת ידנית; הניקוד וגבולות הקריאה נוספו ואושרו על ידך.</span>
      </div>

      <p className="axiom">
        <b>עקרון היסוד שלך:</b> כל שם המופיע בייצוג המזערי של המערכת הוא מהותי, גם אם הופיע פעם אחת בלבד.
      </p>

      <div className="converter__actions">
        <button className="converter__primary" onClick={downloadJSON}>הורד קורפוס עם הפירוש שלי</button>
        <button onClick={downloadInterpretations}>גיבוי עבודה</button>
        <button onClick={() => importRef.current?.click()}>שחזור</button>
        <input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importInterpretations} />
      </div>
      {storageMessage && <p className="storage-message" role="status">{storageMessage}</p>}

      <div className="name-stats">
        <span><b>{corpus.stats.names}</b> שמות</span>
        <span><b>{corpus.stats.occurrences}</b> מופעים</span>
        <span><b>{interpretationCounts.accepted}</b> אושרו</span>
        <span><b>{interpretationCounts.draft}</b> טיוטות</span>
        <span><b>{interpretationCounts.unresolved}</b> לא הוכרעו</span>
        <span><b>{corpus.stats.names - Object.keys(interpretations).length}</b> ממתינים</span>
      </div>
      <div className="interpretation-progress" aria-label={`${interpretationCounts.accepted} מתוך ${corpus.stats.names} פירושים אושרו`}>
        <span style={{ width: `${interpretationCounts.accepted / corpus.stats.names * 100}%` }} />
      </div>

      <nav className="mode-tabs">
        <button aria-pressed={view === "reading"} onClick={() => setView("reading")}>אפיון הקריאה</button>
        <button aria-pressed={view === "mothers"} onClick={() => setView("mothers")}>שלוש האמות</button>
        <button aria-pressed={view === "names"} onClick={() => setView("names")}>שמות ומופעים</button>
        <button aria-pressed={view === "compare"} onClick={() => setView("compare")}>השוואה</button>
        <button aria-pressed={view === "relations"} onClick={() => setView("relations")}>קשרים</button>
        <button aria-pressed={view === "review"} onClick={() => setView("review")}>תור וביקורת</button>
        <button aria-pressed={view === "history"} onClick={() => setView("history")}>היסטוריה</button>
        <button aria-pressed={view === "patterns"} onClick={() => setView("patterns")}>ניסוי 0.11 שנדחה</button>
      </nav>

      {view === "reading" && <ReadingSpecification corpus={corpus} />}
      {view === "mothers" && <ThreeMothersWorkspace corpus={corpus} />}
      {view === "names" && <>
      <div className="name-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש שם…" aria-label="חיפוש שם" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="סינון שמות">
          <option value="all">כל השמות</option>
          <option value="repeated">שמות חוזרים</option>
          <option value="single">מופע יחיד</option>
          <option value="interpreted">פירשתי</option>
          <option value="uninterpreted">טרם פירשתי</option>
          <option value="draft">טיוטות</option>
          <option value="accepted">מאושרים</option>
          <option value="unresolved">לא הוכרעו</option>
          <option value="rejected">נדחו</option>
        </select>
      </div>

      <div className="name-workspace">
        <nav className="name-list" aria-label="רשימת שמות">
          {names.map((name: any) => (
            <button key={name.id} className={selected?.id === name.id ? "is-selected" : ""} onClick={() => setSelectedId(name.id)}>
              <span>{name.normalized}</span>
              <small>{name.occurrence_count} {name.occurrence_count === 1 ? "מופע" : "מופעים"}</small>
              {interpretations[name.id] && <i className={`interpretation-status interpretation-status--${interpretationStatus(interpretations[name.id])}`}>{statusLabels[interpretationStatus(interpretations[name.id])]}</i>}
            </button>
          ))}
          {!names.length && <p>לא נמצאו שמות מתאימים.</p>}
        </nav>

        {selected && (
          <main className="name-detail">
            <header className="name-detail__header">
              <div>
                <small>{selected.id}</small>
                <h3>{selected.normalized}</h3>
              </div>
              <div className="name-detail__badges">
                {selectedInterpretation && <span className={`workflow-badge workflow-badge--${interpretationStatus(selectedInterpretation)}`}>{statusLabels[interpretationStatus(selectedInterpretation)]}</span>}
                <span className="essential-badge">שם מהותי</span>
              </div>
            </header>

            <dl className="name-facts">
              <div><dt>מספר מופעים</dt><dd>{selected.occurrence_count}</dd></div>
              <div><dt>צורות מקור</dt><dd>{selected.surface_forms.join(" · ")}</dd></div>
              <div><dt>בסיס החשיבות</dt><dd>הפירוש שלך: כל שם במערכת המזערית הוא מהותי</dd></div>
            </dl>

            <InterpretationForm
              key={selected.id}
              roles={spec.interpretation.roles}
              roleLabels={roleLabels}
              evidenceOptions={occurrences.map((occurrence: any) => {
                const unit = corpus.units.find((item: any) => item.id === occurrence.unit_id);
                return {
                  id: occurrence.id,
                  label: `${unit?.chapter_label || ""} · ${unit?.unit_label || occurrence.unit_id}`,
                  text: unit?.source.text || "",
                };
              })}
              value={selectedInterpretation}
              onSave={saveInterpretation}
              onClear={clearInterpretation}
            />

            <section className="occurrences">
              <h4>כל המופעים בטקסט</h4>
              <div className="occurrence-grid">
              {occurrences.map((occurrence: any) => {
                const unit = corpus.units.find((item: any) => item.id === occurrence.unit_id);
                return (
                  <article
                    key={occurrence.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => window.dispatchEvent(new CustomEvent("sy:navigate-unit", { detail: { chapterLabel: unit?.chapter_label, unitLabel: unit?.unit_label } }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        window.dispatchEvent(new CustomEvent("sy:navigate-unit", { detail: { chapterLabel: unit?.chapter_label, unitLabel: unit?.unit_label } }));
                      }
                    }}
                  >
                    <header><b>{unit?.chapter_label} · {unit?.unit_label}</b><span>{occurrence.unit_id} · מיקום {occurrence.token_index + 1}</span></header>
                    <p>{highlightedText(unit?.source.text || "", occurrence.surface)}</p>
                  </article>
                );
              })}
              </div>
            </section>
          </main>
        )}
      </div>
      </>}

      {view === "patterns" && <PatternExplorer corpus={corpus} />}
      {view === "compare" && (
        <ComparisonWorkspace
          key={selectedId}
          corpus={corpus}
          interpretations={interpretations}
          relationships={relationships}
          selectedNameId={selectedId}
          onSelectName={(id) => {
            setSelectedId(id);
            setView("names");
          }}
        />
      )}
      {view === "relations" && (
        <RelationshipWorkspace
          key={selectedId}
          corpus={corpus}
          selectedNameId={selectedId}
          relationships={relationships}
          onChange={saveRelationships}
          onSelectName={(id) => {
            setSelectedId(id);
            setView("names");
          }}
        />
      )}
      {view === "history" && <RevisionHistory corpus={corpus} revisions={revisionHistory} onRollback={rollbackRevision} />}
      {view === "review" && (
        <CorpusReview
          corpus={corpus}
          interpretations={interpretations}
          relationships={relationships}
          apostropheDecisions={apostropheDecisions}
          onOpenInterpretation={(id) => {
            setSelectedId(id);
            setView("names");
          }}
          onOpenRelationship={(id) => {
            setSelectedId(id);
            setView("relations");
          }}
          onDecide={(id, role) => {
            const next = {
              ...apostropheDecisions,
              [id]: { role, note: "", authority: "user_interpretation" as const, updated_at: new Date().toISOString() },
            };
            setApostropheDecisions(next);
            localStorage.setItem(apostropheStorageKey, JSON.stringify(next));
          }}
        />
      )}
    </section>
  );
}

function CorpusReview({ corpus, interpretations, relationships, apostropheDecisions, onOpenInterpretation, onOpenRelationship, onDecide }: {
  corpus: any;
  interpretations: Interpretations;
  relationships: UserRelationship[];
  apostropheDecisions: ApostropheDecisions;
  onOpenInterpretation: (id: string) => void;
  onOpenRelationship: (id: string) => void;
  onDecide: (id: string, role: string) => void;
}) {
  const actionLabels: Record<string, string> = {
    remove_entire_case: "הוסר במלואו",
    remove_structural_markup_retain_text: "הוסרה עטיפה, התוכן נשמר",
    retain_entire_case: "נשמר במלואו",
  };
  const resolvedCount = Object.values(apostropheDecisions).filter((item) => item.role !== "unknown").length;
  const nameById = new Map<string, string>(corpus.evidence.names.map((name: any) => [name.id, name.normalized]));
  const interpretationQueue = Object.entries(interpretations).filter(([, interpretation]) => {
    const status = interpretationStatus(interpretation);
    return ["draft", "unresolved"].includes(status) || (status === "accepted" && !interpretation.evidence_occurrence_ids?.length);
  });
  const relationshipQueue = relationships.filter((relationship) => {
    const status = relationshipStatus(relationship);
    return ["draft", "unresolved"].includes(status) || (status === "accepted" && !relationship.evidence_occurrence_ids?.length);
  });
  const apostropheQueue = trailingApostropheCases.cases.filter((item) => !apostropheDecisions[item.id] || apostropheDecisions[item.id].role === "unknown");
  const queueCount = interpretationQueue.length + relationshipQueue.length + apostropheQueue.length;
  return (
    <div className="corpus-review">
      <section className="review-queue">
        <h3>תור העבודה</h3>
        <p>טיוטות, מקרים לא מוכרעים וטענות חסרות ראיה מרוכזים כאן. פריטים שנדחו נשמרים בהיסטוריה אך אינם דורשים פעולה.</p>
        <div className="review-queue__summary">
          <span><b>{interpretationQueue.length}</b> פירושים</span>
          <span><b>{relationshipQueue.length}</b> קשרים</span>
          <span><b>{apostropheQueue.length}</b> מקרי כתיב</span>
        </div>
        {!queueCount && <p className="review-queue__empty">אין כרגע פריטים הממתינים לביקורת.</p>}
        <div className="review-queue__list">
          {interpretationQueue.map(([id, interpretation]) => {
            const status = interpretationStatus(interpretation);
            const reason = status === "accepted" && !interpretation.evidence_occurrence_ids?.length ? "מאושר ללא ראיה" : statusLabels[status];
            return (
              <article key={`interpretation:${id}`}>
                <span className="review-kind">פירוש</span>
                <div><strong>{nameById.get(id) || id}</strong><small>{reason} · {interpretation.evidence_occurrence_ids?.length || 0} ראיות</small></div>
                <button onClick={() => onOpenInterpretation(id)}>פתח</button>
              </article>
            );
          })}
          {relationshipQueue.map((relationship) => {
            const status = relationshipStatus(relationship);
            const reason = status === "accepted" && !relationship.evidence_occurrence_ids?.length ? "מאושר ללא ראיה" : statusLabels[status];
            return (
              <article key={`relationship:${relationship.id}`}>
                <span className="review-kind">קשר</span>
                <div><strong>{nameById.get(relationship.from_name_id)} ← {relationship.relation} ← {nameById.get(relationship.to_name_id)}</strong><small>{reason} · {relationship.evidence_occurrence_ids?.length || 0} ראיות</small></div>
                <button onClick={() => onOpenRelationship(relationship.from_name_id)}>פתח</button>
              </article>
            );
          })}
          {apostropheQueue.map((item) => (
            <article key={`apostrophe:${item.id}`}>
              <span className="review-kind">כתיב</span>
              <div><strong>{item.raw}</strong><small>טרם הוכרע</small></div>
              <button onClick={() => document.getElementById("apostrophe-review")?.scrollIntoView({ behavior: "smooth" })}>פתח</button>
            </article>
          ))}
        </div>
      </section>
      <section className="review-summary">
        <h3>מצב ביקורת הקורפוס</h3>
        <div>
          <span><b>{editorialDecisions.decisions.length}</b> הכרעות עריכה חתומות</span>
          <span><b>0</b> מקרי עריכה ממתינים</span>
          <span><b>{resolvedCount}/{trailingApostropheCases.cases.length}</b> מקרי גרש הוכרעו</span>
        </div>
      </section>
      <section className="review-section" id="apostrophe-review">
        <h3>היסטוריית העריכה</h3>
        <p>כל שינוי או שימור מוצג עם הנוסח המקורי והכרעת המשתמש.</p>
        <div className="decision-grid">
          {editorialDecisions.decisions.map((item) => (
            <article key={item.id}>
              <header><code>{item.id}</code><span>{actionLabels[item.decision.action] || item.decision.action}</span></header>
              <p>{item.raw}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="review-section">
        <h3>מקרי גרש שעדיין דורשים הכרעה</h3>
        <p>המערכת אינה מנחשת. כל בחירה נשמרת כהכרעת משתמש ונכללת בגיבוי העבודה.</p>
        <div className="apostrophe-list">
          {trailingApostropheCases.cases.map((item) => (
            <article key={item.id}>
              <div><strong>{item.raw}</strong><small>{item.context_raw}</small></div>
              <select value={apostropheDecisions[item.id]?.role || "unknown"} onChange={(event) => onDecide(item.id, event.target.value)} aria-label={`הכרעה עבור ${item.raw}`}>
                <option value="unknown">לא הוכרע</option>
                <option value="abbreviation">קיצור / ראשי תיבות</option>
                <option value="number">מספר</option>
                <option value="letter_name">שם אות</option>
                <option value="punctuation">פיסוק</option>
                <option value="other">תפקיד אחר</option>
              </select>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function PatternExplorer({ corpus }: { corpus: any }) {
  const candidates = corpus.structure.role_candidates;
  const candidateName = (id: string) => corpus.evidence.names.find((name: any) => name.id === id)?.normalized || id;

  return (
    <div className="pattern-explorer">
      <section className="pattern-summary">
        <h3>ניסוי 0.11 — נדחה כקורא סמנטי</h3>
        <p>הנתונים נשמרים כאבחון בלבד. ספי שכיחות ו־n-grams אינם קובעים קטגוריה, קשר, בקר או ערך.</p>
        <div>
          <span><b>{candidates.filter((item: any) => item.candidate === "category_relation_or_controller").length}</b> מועמדי מבנה</span>
          <span><b>{candidates.filter((item: any) => item.candidate === "single_unit_value_or_name").length}</b> שמות הקיימים ביחידה אחת</span>
          <span><b>{corpus.structure.records.length}</b> רשומות מקור</span>
        </div>
      </section>

      <section className="pattern-section">
        <h3>Slots בין עוגנים חוזרים</h3>
        <p>כל שורה מציגה שני שמות חוזרים, ואת הערכים המשתנים שנמצאו ביניהם ברשומות שונות.</p>
        {corpus.structure.slots.slice(0, 100).map((slot: any) => (
          <article className="slot-card" key={slot.id}>
            <header>
              <code>{slot.id}</code>
              <span>{slot.record_count} רשומות · מספר ערכים: {slot.cardinality.join(" או ")}</span>
            </header>
            <div className="slot-shape">
              <b>{slot.right_anchor}</b>
              <span>← {slot.cardinality.length === 1 && slot.cardinality[0] === 1 ? "ערך יחיד אפשרי" : "ערך או צירוף אפשרי"} ←</span>
              <b>{slot.left_anchor}</b>
            </div>
            <div className="slot-values">
              {slot.values.slice(0, 12).map((value: any) => (
                <span key={value.record_id}>{value.surface} <small>{value.record_id}</small></span>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="pattern-section">
        <h3>רצפים חוזרים</h3>
        <div className="sequence-grid">
          {corpus.structure.repeated_sequences.slice(0, 80).map((sequence: any) => (
            <article key={sequence.id}>
              <strong>{sequence.member_name_ids.map(candidateName).join(" → ")}</strong>
              <span>{sequence.occurrence_count} מופעים</span>
            </article>
          ))}
        </div>
      </section>

      <section className="pattern-section">
        <h3>מועמדויות לפי היקף הכפילות</h3>
        <div className="candidate-grid">
          {candidates
            .sort((a: any, b: any) => b.record_presence - a.record_presence || b.occurrence_count - a.occurrence_count)
            .slice(0, 120)
            .map((candidate: any) => (
              <article key={candidate.name_id}>
                <b>{candidateName(candidate.name_id)}</b>
                <span>{candidate.occurrence_count} מופעים · {candidate.record_presence} רשומות</span>
                <small>
                  {candidate.candidate === "category_relation_or_controller"
                    ? "מועמד: קטגוריה / קשר / בקר"
                    : candidate.candidate === "single_unit_value_or_name"
                      ? `מועמד: ערך / שם של יחידה יחידה · קרדינליות ${candidate.cardinality_in_single_unit}`
                      : "מועמד: ערך חוזר / מבנה מקומי"}
                </small>
              </article>
            ))}
        </div>
      </section>
    </div>
  );
}

function ReadingSpecification({ corpus }: { corpus: any }) {
  const reading = corpus.reading_specification;
  return (
    <div className="reading-spec">
      <section className="seal-card">
        <header><span>SEALED SOURCE</span><strong>מהדורת הקריאה המקומית</strong></header>
        <dl>
          <div><dt>SHA-256</dt><dd><code>{corpus.seal.source_sha256}</code></dd></div>
          <div><dt>אימות נוסח</dt><dd>אומת ידנית מול ספריא על ידך</dd></div>
          <div><dt>ניקוד</dt><dd>מידע קריאה מוסמך — נשמר לפני כל נרמול</dd></div>
          <div><dt>כל br</dt><dd>גבול קריאה מוסמך</dd></div>
          <div><dt>br רצופים</dt><dd>גבול של קבוצת קריאה</dd></div>
        </dl>
      </section>

      <RuleGroup title="כללים חתומים" state="sealed" rules={reading.sealed_rules} />
      <RuleGroup title="כללים בתהליך גילוי" state="discovery" rules={reading.discovery_rules} />
      <RuleGroup title="מודלי קריאה שנדחו" state="rejected" rules={reading.rejected_rules} />
    </div>
  );
}

function RuleGroup({ title, state, rules }: { title: string; state: string; rules: any[] }) {
  return (
    <section className="rule-group">
      <h3>{title} <span className={`rule-state rule-state--${state}`}>{state}</span></h3>
      {rules.map((rule) => (
        <article key={rule.id}>
          <code>{rule.id}</code>
          <p>{rule.statement || rule.reason}</p>
          {rule.pattern && <small>{rule.pattern.join(" → ")}</small>}
        </article>
      ))}
    </section>
  );
}
