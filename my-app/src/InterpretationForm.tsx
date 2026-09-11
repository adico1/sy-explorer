import { useState, type FormEvent } from "react";

type InterpretationValue = {
  role: string;
  meaning: string;
  note: string;
  fields?: Record<string, string>;
  status: InterpretationStatus;
  evidence_occurrence_ids: string[];
};

type FieldDefinition = { id: string; label: string; placeholder: string };
type InterpretationStatus = "draft" | "accepted" | "rejected" | "unresolved";
type EvidenceOption = { id: string; label: string; text: string };

const statusLabels: Record<InterpretationStatus, string> = {
  draft: "טיוטה",
  accepted: "מאושר",
  rejected: "נדחה",
  unresolved: "לא הוכרע",
};

const commonFields: Record<string, FieldDefinition[]> = {
  name: [
    { id: "referent", label: "למה השם מתייחס", placeholder: "הישות, הפעולה או הרעיון שהשם מציין" },
    { id: "distinction", label: "מה מבדיל אותו", placeholder: "כיצד הוא נבדל משמות קרובים" },
  ],
  operation: [
    { id: "inputs", label: "קלטים", placeholder: "על מה הפעולה פועלת" },
    { id: "result", label: "תוצאה", placeholder: "מה הפעולה יוצרת או משנה" },
    { id: "conditions", label: "תנאים", placeholder: "מתי ובאילו תנאים היא חלה" },
  ],
  entity: [
    { id: "identity", label: "זהות", placeholder: "מהי הישות" },
    { id: "properties", label: "מאפיינים", placeholder: "מאפיינים הכרחיים של הישות" },
  ],
  number: [
    { id: "counts", label: "מה נמנה", placeholder: "הקבוצה או המבנה שהמספר מונה" },
    { id: "system_role", label: "תפקיד המספר", placeholder: "תפקידו במבנה המערכת" },
  ],
  domain: [
    { id: "members", label: "רכיבים", placeholder: "מה נכלל בתחום" },
    { id: "boundary", label: "גבול התחום", placeholder: "מה נכלל ומה אינו נכלל" },
  ],
  class: [
    { id: "members", label: "חברי המחלקה", placeholder: "אילו שמות או ישויות שייכים למחלקה" },
    { id: "criterion", label: "תנאי שייכות", placeholder: "מה קובע חברות במחלקה" },
  ],
  representation: [
    { id: "represents", label: "מה מיוצג", placeholder: "הדבר שהייצוג עומד במקומו" },
    { id: "notation", label: "כלל הייצוג", placeholder: "כיצד קוראים או מפענחים את הייצוג" },
  ],
  state: [
    { id: "conditions", label: "תנאי המצב", placeholder: "מה נכון כאשר המערכת במצב זה" },
    { id: "transitions", label: "מעברים", placeholder: "כיצד נכנסים למצב או יוצאים ממנו" },
  ],
  relation: [
    { id: "source", label: "מקור היחס", placeholder: "מאיזה רכיב היחס יוצא" },
    { id: "target", label: "יעד היחס", placeholder: "אל איזה רכיב היחס מכוון" },
    { id: "direction", label: "כיווניות", placeholder: "חד־כיווני, דו־כיווני או אחר" },
  ],
  category: [
    { id: "members", label: "חברי הקטגוריה", placeholder: "אילו שמות או ערכים כלולים" },
    { id: "criterion", label: "עקרון הקטגוריה", placeholder: "מה מאחד את החברים" },
  ],
  controller: [
    { id: "governs", label: "על מה הוא שולט", placeholder: "התחום, התהליך או הערכים המבוקרים" },
    { id: "rule", label: "כלל בקרה", placeholder: "כיצד השליטה מתבצעת" },
  ],
  value: [
    { id: "parameter", label: "פרמטר", placeholder: "של איזה מאפיין זהו ערך" },
    { id: "range", label: "טווח או יחידה", placeholder: "הטווח, היחידה או קבוצת הערכים האפשרית" },
  ],
};

export function InterpretationForm({ roles, roleLabels, evidenceOptions, value, onSave, onClear }: {
  roles: string[];
  roleLabels: Record<string, string>;
  evidenceOptions: EvidenceOption[];
  value?: InterpretationValue;
  onSave: (value: InterpretationValue) => void;
  onClear: () => void;
}) {
  const [role, setRole] = useState(value?.role || "name");
  const [status, setStatus] = useState<InterpretationStatus>(value?.status || "draft");
  const [error, setError] = useState("");
  const fields = commonFields[role] || commonFields.name;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const evidenceOccurrenceIds = data.getAll("evidence").map(String);
    if (status === "accepted" && !evidenceOccurrenceIds.length) {
      setError("פירוש מאושר חייב להיות מקושר לפחות למופע אחד בטקסט.");
      return;
    }
    setError("");
    onSave({
      role,
      status,
      meaning: String(data.get("meaning") || "").trim(),
      note: String(data.get("note") || "").trim(),
      fields: Object.fromEntries(fields.map((field) => [field.id, String(data.get(`field:${field.id}`) || "").trim()])),
      evidence_occurrence_ids: evidenceOccurrenceIds,
    });
  }

  return (
    <form className="interpretation-form" onSubmit={submit}>
      <h4>הפירוש שלי</h4>
      <label>
        תפקיד במערכת
        <select name="role" value={role} onChange={(event) => setRole(event.target.value)}>
          {roles.map((item) => <option key={item} value={item}>{roleLabels[item] || item}</option>)}
        </select>
      </label>
      <label>
        מצב ההשערה
        <select value={status} onChange={(event) => {
          setStatus(event.target.value as InterpretationStatus);
          setError("");
        }}>
          {Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <div className="role-fields" key={role}>
        {fields.map((field) => (
          <label key={field.id}>
            {field.label}
            <input name={`field:${field.id}`} defaultValue={value?.fields?.[field.id] || ""} placeholder={field.placeholder} />
          </label>
        ))}
      </div>
      <label>
        משמעות
        <textarea name="meaning" defaultValue={value?.meaning || ""} placeholder="מה משמעות השם לפי פירושך?" />
      </label>
      <label>
        הערה או כלל גזירה
        <textarea name="note" defaultValue={value?.note || ""} placeholder="על מה מבוסס הפירוש ומה נגזר ממנו?" />
      </label>
      <fieldset className="interpretation-evidence">
        <legend>מופעים המשמשים ראיה</legend>
        <p>בחר את המקומות המדויקים בטקסט שעליהם נשען הפירוש.</p>
        <div>
          {evidenceOptions.map((option) => (
            <label key={option.id}>
              <input
                type="checkbox"
                name="evidence"
                value={option.id}
                defaultChecked={value?.evidence_occurrence_ids?.includes(option.id)}
              />
              <span><b>{option.label}</b><small>{option.text}</small></span>
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="interpretation-error" role="alert">{error}</p>}
      <div>
        <button className="converter__primary" type="submit">שמור כפירוש שלי</button>
        {value && <button type="button" onClick={onClear}>מחק פירוש</button>}
      </div>
    </form>
  );
}
