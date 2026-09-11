import { useMemo, useState, type FormEvent } from "react";

export type WorkflowStatus = "draft" | "accepted" | "rejected" | "unresolved";

export type UserRelationship = {
  id: string;
  from_name_id: string;
  relation: string;
  to_name_id: string;
  note: string;
  status: WorkflowStatus;
  evidence_occurrence_ids: string[];
  authority: "user_interpretation";
  created_at: string;
  updated_at: string;
};

type EvidenceOption = { id: string; label: string; text: string };

const relationLabels: Record<string, string> = {
  related_to: "קשור אל",
  produces: "יוצר",
  contains: "מכיל",
  transforms_to: "משתנה אל",
  governs: "שולט על",
  corresponds_to: "מקביל אל",
  contrasts_with: "מנוגד אל",
  precedes: "קודם ל־",
};

const statusLabels: Record<WorkflowStatus, string> = {
  draft: "טיוטה",
  accepted: "מאושר",
  rejected: "נדחה",
  unresolved: "לא הוכרע",
};

function relationshipStatus(relationship?: Partial<UserRelationship>): WorkflowStatus {
  return ["draft", "accepted", "rejected", "unresolved"].includes(relationship?.status || "")
    ? relationship!.status as WorkflowStatus
    : "draft";
}

export function RelationshipWorkspace({ corpus, selectedNameId, relationships, onChange, onSelectName }: {
  corpus: any;
  selectedNameId: string;
  relationships: UserRelationship[];
  onChange: (relationships: UserRelationship[]) => void;
  onSelectName: (id: string) => void;
}) {
  const names = corpus.evidence.names;
  const [fromId, setFromId] = useState(selectedNameId || names[0]?.id || "");
  const [toId, setToId] = useState(names.find((item: any) => item.id !== fromId)?.id || "");
  const [status, setStatus] = useState<WorkflowStatus>("draft");
  const [error, setError] = useState("");

  const nameById = useMemo<Map<string, string>>(() => new Map(names.map((name: any) => [name.id, name.normalized])), [names]);

  function evidenceOptionsFor(sourceId: string, targetId: string): EvidenceOption[] {
    const occurrenceIds = new Set<string>();
    for (const nameId of [sourceId, targetId]) {
      const name = names.find((item: any) => item.id === nameId);
      for (const occurrenceId of name?.occurrence_ids || []) occurrenceIds.add(occurrenceId);
    }
    return [...occurrenceIds].flatMap((occurrenceId) => {
      const occurrence = corpus.evidence.occurrences.find((item: any) => item.id === occurrenceId);
      if (!occurrence) return [];
      const unit = corpus.units.find((item: any) => item.id === occurrence.unit_id);
      return [{
        id: occurrence.id,
        label: `${unit?.chapter_label || ""} · ${unit?.unit_label || occurrence.unit_id}`,
        text: unit?.source.text || "",
      }];
    });
  }

  function addRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromId || !toId || fromId === toId) return;
    const data = new FormData(event.currentTarget);
    const evidenceOccurrenceIds = data.getAll("evidence").map(String);
    if (status === "accepted" && !evidenceOccurrenceIds.length) {
      setError("קשר מאושר חייב להיות מקושר לפחות למופע אחד בטקסט.");
      return;
    }
    const now = new Date().toISOString();
    const relationship: UserRelationship = {
      id: `user-relation.${Date.now()}`,
      from_name_id: fromId,
      relation: String(data.get("relation") || "related_to"),
      to_name_id: toId,
      note: String(data.get("note") || "").trim(),
      status,
      evidence_occurrence_ids: evidenceOccurrenceIds,
      authority: "user_interpretation",
      created_at: now,
      updated_at: now,
    };
    onChange([...relationships, relationship]);
    setError("");
    event.currentTarget.reset();
  }

  function updateRelationship(id: string, change: Partial<UserRelationship>) {
    onChange(relationships.map((relationship) => relationship.id === id
      ? { ...relationship, ...change, updated_at: new Date().toISOString() }
      : relationship));
  }

  const builderEvidenceOptions = evidenceOptionsFor(fromId, toId);
  const acceptedRelationships = relationships.filter((relationship) => relationshipStatus(relationship) === "accepted" && relationship.evidence_occurrence_ids?.length);

  return (
    <div className="relationship-workspace">
      <section className="relationship-builder">
        <h3>יצירת קשר ידני</h3>
        <p>רק קשרים מאושרים עם ראיה נכנסים לגרף. טיוטות וקשרים לא מוכרעים נשמרים לביקורת.</p>
        <form onSubmit={addRelationship}>
          <label>מקור<select value={fromId} onChange={(event) => setFromId(event.target.value)}>{names.map((name: any) => <option key={name.id} value={name.id}>{name.normalized}</option>)}</select></label>
          <label>יחס<select name="relation" defaultValue="related_to">{Object.entries(relationLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>יעד<select value={toId} onChange={(event) => setToId(event.target.value)}>{names.map((name: any) => <option key={name.id} value={name.id}>{name.normalized}</option>)}</select></label>
          <label>מצב<select value={status} onChange={(event) => {
            setStatus(event.target.value as WorkflowStatus);
            setError("");
          }}>{Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="relationship-note">הערה<input name="note" placeholder="מדוע הקשר קיים ומה מקורו" /></label>
          <fieldset className="relationship-evidence">
            <legend>ראיות מן הטקסט</legend>
            <div>{builderEvidenceOptions.map((option) => <EvidenceCheckbox key={option.id} option={option} />)}</div>
          </fieldset>
          {error && <p className="relationship-error" role="alert">{error}</p>}
          <button className="converter__primary" type="submit" disabled={!fromId || !toId || fromId === toId}>הוסף קשר</button>
        </form>
      </section>
      <RelationshipGraph relationships={acceptedRelationships} nameById={nameById} onSelectName={onSelectName} />
      <section className="relationship-list">
        <h3>כל הקשרים שהוגדרו</h3>
        {!relationships.length && <p>עדיין לא הוגדרו קשרים.</p>}
        {relationships.map((item) => {
          const evidenceOptions = evidenceOptionsFor(item.from_name_id, item.to_name_id);
          const selectedEvidence = item.evidence_occurrence_ids || [];
          const itemStatus = relationshipStatus(item);
          return (
            <article key={item.id}>
              <div className="relationship-line">
                <button onClick={() => onSelectName(item.from_name_id)}>{nameById.get(item.from_name_id)}</button>
                <span>{relationLabels[item.relation] || item.relation}</span>
                <button onClick={() => onSelectName(item.to_name_id)}>{nameById.get(item.to_name_id)}</button>
                <select
                  value={itemStatus}
                  onChange={(event) => updateRelationship(item.id, { status: event.target.value as WorkflowStatus })}
                  aria-label={`מצב הקשר ${nameById.get(item.from_name_id)} ${relationLabels[item.relation] || item.relation} ${nameById.get(item.to_name_id)}`}
                >
                  {Object.entries(statusLabels).map(([id, label]) => <option key={id} value={id} disabled={id === "accepted" && !selectedEvidence.length}>{label}</option>)}
                </select>
                <button className="relationship-delete" onClick={() => onChange(relationships.filter((relationship) => relationship.id !== item.id))}>מחק</button>
              </div>
              {item.note && <small>{item.note}</small>}
              <details>
                <summary>{selectedEvidence.length} ראיות מקושרות</summary>
                <div className="relationship-evidence-editor">
                  {evidenceOptions.map((option) => (
                    <EvidenceCheckbox
                      key={option.id}
                      option={option}
                      checked={selectedEvidence.includes(option.id)}
                      onChange={(checked) => {
                        const evidenceOccurrenceIds = checked
                          ? [...selectedEvidence, option.id]
                          : selectedEvidence.filter((id) => id !== option.id);
                        updateRelationship(item.id, {
                          evidence_occurrence_ids: evidenceOccurrenceIds,
                          status: itemStatus === "accepted" && !evidenceOccurrenceIds.length ? "draft" : itemStatus,
                        });
                      }}
                    />
                  ))}
                </div>
              </details>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function EvidenceCheckbox({ option, checked, onChange }: {
  option: EvidenceOption;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label>
      <input type="checkbox" name="evidence" value={option.id} checked={onChange ? checked : undefined} onChange={onChange ? (event) => onChange(event.target.checked) : undefined} />
      <span><b>{option.label}</b><small>{option.text}</small></span>
    </label>
  );
}

function RelationshipGraph({ relationships, nameById, onSelectName }: {
  relationships: UserRelationship[];
  nameById: Map<string, string>;
  onSelectName: (id: string) => void;
}) {
  const visibleRelationships = relationships.slice(-24);
  const nodeIds = [...new Set(visibleRelationships.flatMap((item) => [item.from_name_id, item.to_name_id]))];
  const positions = new Map(nodeIds.map((id, index) => {
    const angle = nodeIds.length ? index / nodeIds.length * Math.PI * 2 - Math.PI / 2 : 0;
    return [id, { x: 300 + Math.cos(angle) * 190, y: 170 + Math.sin(angle) * 120 }];
  }));
  return (
    <section className="relationship-graph">
      <h3>גרף קשרים מאושרים</h3>
      {!relationships.length ? <p>הגרף יציג רק קשרים שאושרו עם ראיה טקסטואלית.</p> : (
        <svg viewBox="0 0 600 340" role="img" aria-label="גרף הקשרים המאושרים עם ראיה">
          <defs><marker id="relation-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker></defs>
          {visibleRelationships.map((item) => {
            const from = positions.get(item.from_name_id)!;
            const to = positions.get(item.to_name_id)!;
            return <line key={item.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd="url(#relation-arrow)" />;
          })}
          {nodeIds.map((id) => {
            const point = positions.get(id)!;
            return (
              <g key={id} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex={0} onClick={() => onSelectName(id)} onKeyDown={(event) => event.key === "Enter" && onSelectName(id)}>
                <circle r="30" />
                <text textAnchor="middle" dominantBaseline="middle">{String(nameById.get(id) || id).slice(0, 10)}</text>
              </g>
            );
          })}
        </svg>
      )}
    </section>
  );
}
