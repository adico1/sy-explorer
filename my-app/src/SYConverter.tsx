import { useMemo, useState } from "react";
import sourceText from "./SeferYetzirah.tsx?raw";
import spec from "./sy.converter.spec.json";
import { createConverter } from "./converter-engine.mjs";

const convert = createConverter(spec);
const reviewKey = `sy-explorer:reviews:${spec.version}`;
type ReviewStatus = "pending" | "approved" | "rejected";
type Tab = "relations" | "contracts" | "json";

function loadDecisions(): Record<string, ReviewStatus> {
  try {
    return JSON.parse(localStorage.getItem(reviewKey) || "{}");
  } catch {
    return {};
  }
}

export function SYConverter() {
  const [corpus] = useState<any>(() => convert(sourceText));
  const [tab, setTab] = useState<Tab>("relations");
  const [decisions, setDecisions] = useState<Record<string, ReviewStatus>>(loadDecisions);

  const reviewedCorpus = useMemo(() => {
    const value = structuredClone(corpus);
    value.review.decisions = decisions;
    value.graph.relations = value.graph.relations.map((relation: any) => ({
      ...relation,
      review: {
        status: decisions[relation.id] || "pending",
        decided_at: decisions[relation.id] ? new Date().toISOString() : null,
      },
    }));
    value.stats.approved_relations = Object.values(decisions).filter((x) => x === "approved").length;
    value.stats.rejected_relations = Object.values(decisions).filter((x) => x === "rejected").length;
    value.stats.pending_relations = value.stats.relations - value.stats.approved_relations - value.stats.rejected_relations;
    return value;
  }, [corpus, decisions]);

  function decide(id: string, status: ReviewStatus) {
    const next = { ...decisions };
    if (status === "pending") delete next[id];
    else next[id] = status;
    setDecisions(next);
    localStorage.setItem(reviewKey, JSON.stringify(next));
  }

  function downloadJSON() {
    const blob = new Blob([JSON.stringify(reviewedCorpus, null, 2) + "\n"], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sy.corpus-${reviewedCorpus.version}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="converter" dir="rtl" aria-label="SY Explorer">
      <header className="converter__header">
        <div>
          <small>SY EXPLORER · v{corpus.version}</small>
          <h2>מפת פירושים</h2>
        </div>
        <span className={corpus.validation.valid ? "converter__valid" : "converter__invalid"}>
          {corpus.validation.valid ? "החוזה תקין" : "נמצאו שגיאות"}
        </span>
      </header>

      <div className="converter__actions">
        <button className="converter__primary" onClick={downloadJSON}>הורד JSON מלא</button>
      </div>

      <p className="converter__stats">
        {corpus.stats.units} יחידות · {corpus.stats.statements} משפטים · {corpus.stats.relations} יחסים
        <br />
        {reviewedCorpus.stats.approved_relations} אושרו · {reviewedCorpus.stats.rejected_relations} נדחו · {reviewedCorpus.stats.pending_relations} ממתינים
      </p>

      <nav className="converter__tabs" aria-label="תצוגות">
        <button aria-pressed={tab === "relations"} onClick={() => setTab("relations")}>פירושים</button>
        <button aria-pressed={tab === "contracts"} onClick={() => setTab("contracts")}>חוזי פעולות</button>
        <button aria-pressed={tab === "json"} onClick={() => setTab("json")}>JSON</button>
      </nav>

      {tab === "relations" && (
        <div className="review-list">
          <p className="review-note">החלטות נשמרות בדפדפן זה ונכללות בקובץ המורד.</p>
          {reviewedCorpus.graph.relations.map((relation: any) => (
            <article className="relation-card" key={relation.id}>
              <div className="relation-card__meta">
                <code>{relation.id}</code>
                <span className={`evidence evidence--${relation.evidence}`}>{relation.evidence}</span>
              </div>
              <div className="relation-card__triple" dir="rtl">
                <span>{relation.subject.text || "לא ידוע"}</span>
                <strong>→ {relation.operation} →</strong>
                <span>{relation.object.text || "לא ידוע"}</span>
              </div>
              <small>{reviewedCorpus.graph.statements.find((x: any) => x.id === relation.statement_id)?.text}</small>
              <div className="relation-card__actions">
                <button className={relation.review.status === "approved" ? "is-approved" : ""} onClick={() => decide(relation.id, "approved")}>אישור</button>
                <button className={relation.review.status === "rejected" ? "is-rejected" : ""} onClick={() => decide(relation.id, "rejected")}>דחייה</button>
                <button onClick={() => decide(relation.id, "pending")}>איפוס</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {tab === "contracts" && (
        <div className="review-list">
          {corpus.operation_contracts.map((contract: any) => (
            <article className="relation-card" key={contract.operation}>
              <div className="relation-card__meta">
                <strong>{contract.operation}</strong>
                <span className={`evidence evidence--${contract.evidence}`}>{contract.evidence}</span>
              </div>
              <p>קלט: {contract.input_types.join(", ")} · פלט: {contract.output_types.join(", ")}</p>
              <small>תנאי: {contract.preconditions.join(", ")} · כשל: {contract.failure}</small>
            </article>
          ))}
        </div>
      )}

      {tab === "json" && (
        <pre className="converter__output" dir="ltr">{JSON.stringify(reviewedCorpus, null, 2)}</pre>
      )}
    </section>
  );
}
