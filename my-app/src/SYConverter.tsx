import { useEffect, useMemo, useRef, useState } from "react";
import sourceText from "./SeferYetzirah.tsx?raw";
import editorialDecisions from "./sy.editorial-decisions.json";
import spec from "./sy.converter.spec.json";
import trailingApostropheCases from "./sy.trailing-apostrophe-cases.json";
import { createConverter } from "./converter-engine.mjs";

const convert = createConverter(spec);
const storageKey = `sy-explorer:user-interpretations:${spec.version}`;
const apostropheStorageKey = `sy-explorer:apostrophe-decisions:${spec.version}`;

type Interpretation = {
  role: string;
  meaning: string;
  note: string;
  authority: "user_interpretation";
  updated_at: string;
};

type Interpretations = Record<string, Interpretation>;
type ApostropheDecision = {
  role: string;
  note: string;
  authority: "user_interpretation";
  updated_at: string;
};
type ApostropheDecisions = Record<string, ApostropheDecision>;
type Filter = "all" | "repeated" | "single" | "interpreted" | "uninterpreted";
type View = "reading" | "names" | "review" | "patterns";

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

function loadApostropheDecisions(): ApostropheDecisions {
  try {
    const value = JSON.parse(localStorage.getItem(apostropheStorageKey) || "{}");
    return typeof value === "object" && value ? value : {};
  } catch {
    return {};
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

  function downloadInterpretations() {
    const backup = {
      format: "sy-explorer-workspace",
      corpus_version: corpus.version,
      exported_at: new Date().toISOString(),
      interpretations,
      apostrophe_decisions: apostropheDecisions,
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
      const next = Object.fromEntries(Object.entries(importedInterpretations).filter(([id, entry]) => {
        if (!knownIds.has(id) || typeof entry !== "object" || !entry) return false;
        const value = entry as Partial<Interpretation>;
        return typeof value.role === "string" && typeof value.meaning === "string" && typeof value.note === "string";
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
      setStorageMessage(`שוחזרו ${Object.keys(next).length} פירושים ו־${Object.keys(nextApostropheDecisions).length} הכרעות כתיב${backup.corpus_version === corpus.version ? "" : " מגרסת קורפוס אחרת"}.`);
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
        <span><b>{Object.keys(interpretations).length}</b> פורשו</span>
        <span><b>{corpus.stats.names - Object.keys(interpretations).length}</b> ממתינים</span>
      </div>
      <div className="interpretation-progress" aria-label={`${Object.keys(interpretations).length} מתוך ${corpus.stats.names} שמות פורשו`}>
        <span style={{ width: `${Object.keys(interpretations).length / corpus.stats.names * 100}%` }} />
      </div>

      <nav className="mode-tabs">
        <button aria-pressed={view === "reading"} onClick={() => setView("reading")}>אפיון הקריאה</button>
        <button aria-pressed={view === "names"} onClick={() => setView("names")}>שמות ומופעים</button>
        <button aria-pressed={view === "review"} onClick={() => setView("review")}>ביקורת הקורפוס</button>
        <button aria-pressed={view === "patterns"} onClick={() => setView("patterns")}>ניסוי 0.11 שנדחה</button>
      </nav>

      {view === "reading" && <ReadingSpecification corpus={corpus} />}
      {view === "names" && <>
      <div className="name-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש שם…" aria-label="חיפוש שם" />
        <select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} aria-label="סינון שמות">
          <option value="all">כל השמות</option>
          <option value="repeated">שמות חוזרים</option>
          <option value="single">מופע יחיד</option>
          <option value="interpreted">פירשתי</option>
          <option value="uninterpreted">טרם פירשתי</option>
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
      {view === "review" && (
        <CorpusReview
          apostropheDecisions={apostropheDecisions}
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

function CorpusReview({ apostropheDecisions, onDecide }: { apostropheDecisions: ApostropheDecisions; onDecide: (id: string, role: string) => void }) {
  const actionLabels: Record<string, string> = {
    remove_entire_case: "הוסר במלואו",
    remove_structural_markup_retain_text: "הוסרה עטיפה, התוכן נשמר",
    retain_entire_case: "נשמר במלואו",
  };
  const resolvedCount = Object.values(apostropheDecisions).filter((item) => item.role !== "unknown").length;
  return (
    <div className="corpus-review">
      <section className="review-summary">
        <h3>מצב ביקורת הקורפוס</h3>
        <div>
          <span><b>{editorialDecisions.decisions.length}</b> הכרעות עריכה חתומות</span>
          <span><b>0</b> מקרי עריכה ממתינים</span>
          <span><b>{resolvedCount}/{trailingApostropheCases.cases.length}</b> מקרי גרש הוכרעו</span>
        </div>
      </section>
      <section className="review-section">
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
