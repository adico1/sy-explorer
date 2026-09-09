import { useMemo, useState } from "react";
import sourceText from "./SeferYetzirah.tsx?raw";
import spec from "./sy.converter.spec.json";
import { createConverter } from "./converter-engine.mjs";

const convert = createConverter(spec);
const reviewKey = `sy-explorer:reviews:${spec.version}`;

type ReviewStatus = "pending" | "approved" | "rejected";
type ReviewPart = "subject" | "operation" | "object";
type Decision = { status: ReviewStatus; decided_at: string | null };
type RelationDecision = Partial<Record<ReviewPart, Decision>>;
type Decisions = Record<string, RelationDecision>;
type Tab = "reviewable" | "incomplete" | "contracts" | "json";

const operationLabels: Record<string, string> = {
  engrave: "חקק", carve: "חצב", weigh: "שקל", permute: "המיר",
  combine: "צירף", form: "יצר", crown: "המליך", bind: "קשר",
  seal: "חתם", create: "ברא", establish: "יסד", examine: "בחן",
  investigate: "חקר", stabilize: "העמיד",
};

const evidenceLabels: Record<string, string> = {
  observed: "מופיע בטקסט",
  derived: "נגזר לפי כלל",
  hypothesis: "השערת הממיר",
  unknown: "לא ידוע",
};

const typeLabels: Record<string, string> = {
  entity: "ישות", letter: "אות", relation: "יחס", state: "מצב",
  domain: "תחום", operation: "פעולה", quality: "תכונה",
};

const contractText: Record<string, string> = {
  engrave: "מסמן או רושם ישות.",
  carve: "מבדיל צורה מתוך חומר או ישות.",
  weigh: "משווה, מסדר או מאזן בין ישויות.",
  permute: "משנה את סדר האותיות או הישויות.",
  combine: "מחבר מספר קלטים לצירוף.",
  form: "יוצר צורה מתוך חומר או הקשר.",
  crown: "ממנה אות לשליטה בתכונה או בתחום.",
  bind: "יוצר קשר בין ישויות.",
  seal: "מקבע או סוגר יעד.",
  create: "מכניס ישות חדשה למערכת.",
  establish: "מייסד או מקבע מצב.",
  examine: "מפיק תצפית על ישות.",
  investigate: "מפיק חקירה על ישות.",
  stabilize: "מעמיד יעד במצב מוגדר.",
};

const failureLabels: Record<string, string> = {
  unknown_semantics: "משמעות הפעולה עדיין אינה מוכחת.",
  comparison_not_observed: "לא זוהו ישויות שאפשר להשוות ביניהן.",
  ordering_not_observed: "סדר הקלטים לא זוהה בטקסט.",
  members_not_observed: "חברי הצירוף לא זוהו.",
  material_unknown: "החומר שממנו נוצרת הצורה אינו ידוע.",
  letter_missing: "לא זוהתה אות קלט.",
  participants_unknown: "המשתתפים בקשר אינם ידועים.",
  target_missing: "יעד הפעולה לא זוהה.",
  object_missing: "מושא הפעולה לא זוהה.",
  criteria_unknown: "קריטריון הבדיקה אינו ידוע.",
};

function pending(): Decision {
  return { status: "pending", decided_at: null };
}

function loadDecisions(): Decisions {
  try {
    const parsed = JSON.parse(localStorage.getItem(reviewKey) || "{}");
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function isIncomplete(relation: any) {
  return !relation.subject?.text || !relation.object?.text;
}

function statusFor(decisions: Decisions, relationId: string, part: ReviewPart): Decision {
  return decisions[relationId]?.[part] || pending();
}

function aggregateStatus(parts: Record<ReviewPart, Decision>): ReviewStatus {
  const values = Object.values(parts).map((x) => x.status);
  if (values.includes("rejected")) return "rejected";
  if (values.every((x) => x === "approved")) return "approved";
  return "pending";
}

export function SYConverter() {
  const [corpus] = useState<any>(() => convert(sourceText));
  const [tab, setTab] = useState<Tab>("reviewable");
  const [decisions, setDecisions] = useState<Decisions>(loadDecisions);

  const reviewedCorpus = useMemo(() => {
    const value = structuredClone(corpus);
    value.review.decisions = decisions;
    value.review.granularity = "relation_component";
    value.graph.relations = value.graph.relations.map((relation: any) => {
      const components = {
        subject: statusFor(decisions, relation.id, "subject"),
        operation: statusFor(decisions, relation.id, "operation"),
        object: statusFor(decisions, relation.id, "object"),
      };
      return { ...relation, review: { status: aggregateStatus(components), components } };
    });
    value.stats.approved_relations = value.graph.relations.filter((x: any) => x.review.status === "approved").length;
    value.stats.rejected_relations = value.graph.relations.filter((x: any) => x.review.status === "rejected").length;
    value.stats.pending_relations = value.stats.relations - value.stats.approved_relations - value.stats.rejected_relations;
    value.stats.incomplete_relations = value.graph.relations.filter(isIncomplete).length;
    return value;
  }, [corpus, decisions]);

  function decide(id: string, part: ReviewPart, status: ReviewStatus) {
    const relation = { ...(decisions[id] || {}) };
    if (status === "pending") delete relation[part];
    else relation[part] = { status, decided_at: new Date().toISOString() };
    const next = { ...decisions };
    if (Object.keys(relation).length) next[id] = relation;
    else delete next[id];
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

  const relations = reviewedCorpus.graph.relations.filter((relation: any) =>
    tab === "incomplete" ? isIncomplete(relation) : !isIncomplete(relation),
  );

  return (
    <section className="converter" dir="rtl" aria-label="SY Explorer">
      <header className="converter__header">
        <div>
          <small>SY EXPLORER · v{corpus.version}</small>
          <h2>בדיקת פירושי הטקסט</h2>
        </div>
        <span className={corpus.validation.valid ? "converter__valid" : "converter__invalid"}>
          {corpus.validation.valid ? "מבנה הנתונים תקין" : "נמצאו שגיאות מבניות"}
        </span>
      </header>

      <details className="converter__guide">
        <summary>כיצד בודקים פירוש?</summary>
        <p>בכל כרטיס מופיע תחילה המשפט המקורי. מתחתיו מוצעת חלוקה לנושא, פעולה ומושא. יש לאשר או לדחות כל רכיב בנפרד.</p>
        <ul>
          <li><b>מופיע בטקסט</b> — זוהה ישירות.</li>
          <li><b>נגזר לפי כלל</b> — הופק באמצעות כלל מוגדר.</li>
          <li><b>השערת הממיר</b> — דורש שיקול אנושי.</li>
          <li><b>לא ידוע</b> — אין די מידע.</li>
        </ul>
      </details>

      <div className="converter__actions">
        <button className="converter__primary" onClick={downloadJSON}>הורד JSON עם הביקורת</button>
      </div>

      <p className="converter__stats">
        {corpus.stats.relations} פירושים · {reviewedCorpus.stats.incomplete_relations} דורשים השלמה
        <br />
        {reviewedCorpus.stats.approved_relations} אושרו במלואם · {reviewedCorpus.stats.rejected_relations} נדחו
      </p>

      <nav className="converter__tabs" aria-label="תצוגות">
        <button aria-pressed={tab === "reviewable"} onClick={() => setTab("reviewable")}>מוכן לבדיקה</button>
        <button aria-pressed={tab === "incomplete"} onClick={() => setTab("incomplete")}>דורש השלמה</button>
        <button aria-pressed={tab === "contracts"} onClick={() => setTab("contracts")}>מילון פעולות</button>
        <button aria-pressed={tab === "json"} onClick={() => setTab("json")}>JSON</button>
      </nav>

      {(tab === "reviewable" || tab === "incomplete") && (
        <div className="review-list">
          <p className="review-note">
            {tab === "reviewable"
              ? "מוצגים רק פירושים שבהם זוהו גם נושא וגם מושא."
              : "יחסים אלה אינם מוכנים לאישור מלא. הרכיב החסר מסומן במפורש."}
          </p>
          {relations.map((relation: any) => {
            const statement = reviewedCorpus.graph.statements.find((x: any) => x.id === relation.statement_id);
            return (
              <article className="relation-card" key={relation.id}>
                <div className="relation-card__meta">
                  <span>{relation.unit_id} · {relation.id}</span>
                  <span className={`evidence evidence--${relation.evidence}`}>{evidenceLabels[relation.evidence]}</span>
                </div>
                <blockquote className="relation-card__source">{statement?.text}</blockquote>
                <div className="relation-card__triple" aria-label="נושא פעולה מושא">
                  <ReviewField label="נושא" value={relation.subject.text} type={relation.subject.type} evidence={relation.subject.evidence} status={relation.review.components.subject.status} onDecision={(status) => decide(relation.id, "subject", status)} />
                  <span className="relation-card__arrow" aria-hidden="true">←</span>
                  <ReviewField label="פעולה" value={operationLabels[relation.operation] || relation.operation} type="operation" evidence="observed" status={relation.review.components.operation.status} onDecision={(status) => decide(relation.id, "operation", status)} />
                  <span className="relation-card__arrow" aria-hidden="true">←</span>
                  <ReviewField label="מושא" value={relation.object.text} type={relation.object.type} evidence={relation.object.evidence} status={relation.review.components.object.status} onDecision={(status) => decide(relation.id, "object", status)} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === "contracts" && (
        <div className="review-list">
          <p className="review-note">זהו מילון העבודה של הממיר. הוא מתאר מה אנו מניחים שכל פעולה עושה; השערה אינה עובדה בטקסט.</p>
          {corpus.operation_contracts.map((contract: any) => (
            <article className="relation-card contract-card" key={contract.operation}>
              <div className="relation-card__meta">
                <strong>{operationLabels[contract.operation] || contract.operation}</strong>
                <span className={`evidence evidence--${contract.evidence}`}>{evidenceLabels[contract.evidence]}</span>
              </div>
              <p>{contractText[contract.operation]}</p>
              <dl>
                <div><dt>מקבל</dt><dd>{contract.input_types.map((x: string) => typeLabels[x] || x).join(", ")}</dd></div>
                <div><dt>מפיק</dt><dd>{contract.output_types.map((x: string) => typeLabels[x] || x).join(", ")}</dd></div>
                <div><dt>אם חסר מידע</dt><dd>{failureLabels[contract.failure] || contract.failure}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}

      {tab === "json" && (
        <div className="json-panel">
          <p>תצוגה טכנית מלאה למפתחים. אין צורך לקרוא אותה כדי לבדוק פירושים.</p>
          <pre className="converter__output" dir="ltr">{JSON.stringify(reviewedCorpus, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}

function ReviewField({ label, value, type, evidence, status, onDecision }: {
  label: string;
  value: string | null;
  type: string;
  evidence: string;
  status: ReviewStatus;
  onDecision: (status: ReviewStatus) => void;
}) {
  return (
    <section className={`review-field ${!value ? "review-field--missing" : ""}`}>
      <header>
        <span>{label}</span>
        <small>{typeLabels[type] || type} · {evidenceLabels[evidence]}</small>
      </header>
      <strong>{value || "לא זוהה"}</strong>
      <div className="review-field__actions">
        <button className={status === "approved" ? "is-approved" : ""} disabled={!value} onClick={() => onDecision("approved")} aria-label={`אישור ${label}`}>✓</button>
        <button className={status === "rejected" ? "is-rejected" : ""} onClick={() => onDecision("rejected")} aria-label={`דחיית ${label}`}>×</button>
        {status !== "pending" && <button onClick={() => onDecision("pending")} aria-label={`איפוס ${label}`}>↶</button>}
      </div>
    </section>
  );
}
