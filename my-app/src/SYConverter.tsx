import { useMemo, useState } from "react";
import sourceText from "./SeferYetzirah.tsx?raw";
import spec from "./sy.converter.spec.json";
import { createConverter } from "./converter-engine.mjs";

const convert = createConverter(spec);
const storageKey = `sy-explorer:user-interpretations:${spec.version}`;

type Interpretation = {
  role: string;
  meaning: string;
  note: string;
  authority: "user_interpretation";
  updated_at: string;
};

type Interpretations = Record<string, Interpretation>;
type Filter = "all" | "repeated" | "single" | "interpreted";
type View = "names" | "patterns";

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

function loadInterpretations(): Interpretations {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || "{}");
    return typeof value === "object" && value ? value : {};
  } catch {
    return {};
  }
}

export function SYConverter() {
  const [corpus] = useState<any>(() => convert(sourceText));
  const [interpretations, setInterpretations] = useState<Interpretations>(loadInterpretations);
  const [selectedId, setSelectedId] = useState<string>(() => corpus.evidence.names[0]?.id || "");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("patterns");

  const names = useMemo(() => {
    const needle = query.trim();
    return [...corpus.evidence.names]
      .filter((name: any) => !needle || name.normalized.includes(needle) || name.surface_forms.some((form: string) => form.includes(needle)))
      .filter((name: any) => {
        if (filter === "repeated") return name.occurrence_count > 1;
        if (filter === "single") return name.occurrence_count === 1;
        if (filter === "interpreted") return Boolean(interpretations[name.id]);
        return true;
      })
      .sort((a: any, b: any) => b.occurrence_count - a.occurrence_count || a.normalized.localeCompare(b.normalized, "he"));
  }, [corpus, filter, interpretations, query]);

  const selected = corpus.evidence.names.find((name: any) => name.id === selectedId) || names[0];
  const selectedInterpretation = selected ? interpretations[selected.id] : undefined;
  const occurrences = selected
    ? selected.occurrence_ids.map((id: string) => corpus.evidence.occurrences.find((item: any) => item.id === id))
    : [];

  const exportedCorpus = useMemo(() => {
    const value = structuredClone(corpus);
    value.interpretations.entries = interpretations;
    value.stats.interpreted_names = Object.keys(interpretations).length;
    value.stats.uninterpreted_names = value.stats.names - value.stats.interpreted_names;
    value.evidence.names = value.evidence.names.map((name: any) => ({
      ...name,
      interpretation: interpretations[name.id] || {
        status: "uninterpreted",
        authority: "user_interpretation_only",
      },
    }));
    return value;
  }, [corpus, interpretations]);

  function saveInterpretation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const data = new FormData(event.currentTarget);
    const entry: Interpretation = {
      role: String(data.get("role") || "name"),
      meaning: String(data.get("meaning") || "").trim(),
      note: String(data.get("note") || "").trim(),
      authority: "user_interpretation",
      updated_at: new Date().toISOString(),
    };
    const next = { ...interpretations, [selected.id]: entry };
    setInterpretations(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function clearInterpretation() {
    if (!selected) return;
    const next = { ...interpretations };
    delete next[selected.id];
    setInterpretations(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
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
        <strong>סמכות המקור: ספריא</strong>
        <span>העותק המקומי טרם הושווה אוטומטית לנוסח המקוון.</span>
      </div>

      <p className="axiom">
        <b>עקרון היסוד שלך:</b> כל שם המופיע בייצוג המזערי של המערכת הוא מהותי, גם אם הופיע פעם אחת בלבד.
      </p>

      <div className="converter__actions">
        <button className="converter__primary" onClick={downloadJSON}>הורד קורפוס עם הפירוש שלי</button>
      </div>

      <div className="name-stats">
        <span><b>{corpus.stats.names}</b> שמות</span>
        <span><b>{corpus.stats.occurrences}</b> מופעים</span>
        <span><b>{corpus.stats.repeated_sequences}</b> רצפים חוזרים</span>
        <span><b>{corpus.stats.slot_candidates}</b> slots מועמדים</span>
      </div>

      <nav className="mode-tabs">
        <button aria-pressed={view === "patterns"} onClick={() => setView("patterns")}>תבניות וכפילויות</button>
        <button aria-pressed={view === "names"} onClick={() => setView("names")}>שמות ומופעים</button>
      </nav>

      {view === "names" && <>
      <div className="name-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש שם…" aria-label="חיפוש שם" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="סינון שמות">
          <option value="all">כל השמות</option>
          <option value="repeated">שמות חוזרים</option>
          <option value="single">מופע יחיד</option>
          <option value="interpreted">פירשתי</option>
        </select>
      </div>

      <div className="name-workspace">
        <nav className="name-list" aria-label="רשימת שמות">
          {names.map((name: any) => (
            <button key={name.id} className={selected?.id === name.id ? "is-selected" : ""} onClick={() => setSelectedId(name.id)}>
              <span>{name.normalized}</span>
              <small>{name.occurrence_count} {name.occurrence_count === 1 ? "מופע" : "מופעים"}</small>
              {interpretations[name.id] && <i>פורש</i>}
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
              <span className="essential-badge">שם מהותי</span>
            </header>

            <dl className="name-facts">
              <div><dt>מספר מופעים</dt><dd>{selected.occurrence_count}</dd></div>
              <div><dt>צורות מקור</dt><dd>{selected.surface_forms.join(" · ")}</dd></div>
              <div><dt>בסיס החשיבות</dt><dd>הפירוש שלך: כל שם במערכת המזערית הוא מהותי</dd></div>
            </dl>

            <form className="interpretation-form" key={selected.id} onSubmit={saveInterpretation}>
              <h4>הפירוש שלי</h4>
              <label>
                תפקיד במערכת
                <select name="role" defaultValue={selectedInterpretation?.role || "name"}>
                  {spec.interpretation.roles.map((role) => <option key={role} value={role}>{roleLabels[role] || role}</option>)}
                </select>
              </label>
              <label>
                משמעות
                <textarea name="meaning" defaultValue={selectedInterpretation?.meaning || ""} placeholder="מה משמעות השם לפי פירושך?" />
              </label>
              <label>
                הערה או כלל גזירה
                <textarea name="note" defaultValue={selectedInterpretation?.note || ""} placeholder="על מה מבוסס הפירוש ומה נגזר ממנו?" />
              </label>
              <div>
                <button className="converter__primary" type="submit">שמור כפירוש שלי</button>
                {selectedInterpretation && <button type="button" onClick={clearInterpretation}>מחק פירוש</button>}
              </div>
            </form>

            <section className="occurrences">
              <h4>כל המופעים בטקסט</h4>
              {occurrences.map((occurrence: any) => {
                const unit = corpus.units.find((item: any) => item.id === occurrence.unit_id);
                return (
                  <article key={occurrence.id}>
                    <header><b>{occurrence.id}</b><span>{occurrence.unit_id} · מיקום {occurrence.token_index + 1}</span></header>
                    <p>{unit?.source.text}</p>
                  </article>
                );
              })}
            </section>
          </main>
        )}
      </div>
      </>}

      {view === "patterns" && <PatternExplorer corpus={corpus} />}
    </section>
  );
}

function PatternExplorer({ corpus }: { corpus: any }) {
  const candidates = corpus.structure.role_candidates;
  const candidateName = (id: string) => corpus.evidence.names.find((name: any) => name.id === id)?.normalized || id;

  return (
    <div className="pattern-explorer">
      <section className="pattern-summary">
        <h3>מה נגזר מן הכפילויות</h3>
        <p>החזרה קובעת מועמדות מבנית בלבד. התפקיד הסופי — קטגוריה, קשר, בקר או ערך — נקבע בפירוש שלך.</p>
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
