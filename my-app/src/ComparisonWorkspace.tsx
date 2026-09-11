import { useMemo, useState } from "react";
import type { UserRelationship } from "./RelationshipWorkspace";

const statusLabels: Record<string, string> = {
  draft: "טיוטה",
  accepted: "מאושר",
  rejected: "נדחה",
  unresolved: "לא הוכרע",
};

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

export function ComparisonWorkspace({ corpus, interpretations, relationships, selectedNameId, onSelectName }: {
  corpus: any;
  interpretations: Record<string, any>;
  relationships: UserRelationship[];
  selectedNameId: string;
  onSelectName: (id: string) => void;
}) {
  const names = corpus.evidence.names;
  const [leftId, setLeftId] = useState(selectedNameId || names[0]?.id || "");
  const [rightId, setRightId] = useState(names.find((name: any) => name.id !== leftId)?.id || leftId);
  const nameById = useMemo<Map<string, string>>(() => new Map(names.map((name: any) => [name.id, name.normalized])), [names]);
  const left = names.find((name: any) => name.id === leftId);
  const right = names.find((name: any) => name.id === rightId);

  function evidenceFor(interpretation: any) {
    return (interpretation?.evidence_occurrence_ids || []).flatMap((occurrenceId: string) => {
      const occurrence = corpus.evidence.occurrences.find((item: any) => item.id === occurrenceId);
      if (!occurrence) return [];
      const unit = corpus.units.find((item: any) => item.id === occurrence.unit_id);
      return [{ id: occurrence.id, label: `${unit?.chapter_label || ""} · ${unit?.unit_label || occurrence.unit_id}`, text: unit?.source.text || "" }];
    });
  }

  function relationshipsFor(nameId: string) {
    return relationships.filter((relationship) => relationship.from_name_id === nameId || relationship.to_name_id === nameId);
  }

  const leftInterpretation = interpretations[leftId];
  const rightInterpretation = interpretations[rightId];
  const leftRelationships = relationshipsFor(leftId);
  const rightRelationships = relationshipsFor(rightId);

  return (
    <div className="comparison-workspace">
      <section className="comparison-toolbar">
        <label>שם ראשון<select value={leftId} onChange={(event) => setLeftId(event.target.value)}>{names.map((name: any) => <option key={name.id} value={name.id}>{name.normalized}</option>)}</select></label>
        <button onClick={() => {
          setLeftId(rightId);
          setRightId(leftId);
        }}>החלף צדדים</button>
        <label>שם שני<select value={rightId} onChange={(event) => setRightId(event.target.value)}>{names.map((name: any) => <option key={name.id} value={name.id}>{name.normalized}</option>)}</select></label>
      </section>
      {leftId === rightId && <p className="comparison-warning">נבחר אותו שם בשני הצדדים.</p>}
      <section className="comparison-summary">
        <span><b>{left?.occurrence_count || 0} / {right?.occurrence_count || 0}</b> מופעים</span>
        <span><b>{leftInterpretation?.role || "—"} / {rightInterpretation?.role || "—"}</b> תפקידים</span>
        <span><b>{leftInterpretation?.evidence_occurrence_ids?.length || 0} / {rightInterpretation?.evidence_occurrence_ids?.length || 0}</b> ראיות</span>
        <span><b>{leftRelationships.length} / {rightRelationships.length}</b> קשרים</span>
      </section>
      <div className="comparison-columns">
        <ComparisonPanel
          name={left}
          interpretation={leftInterpretation}
          evidence={evidenceFor(leftInterpretation)}
          relationships={leftRelationships}
          nameById={nameById}
          onOpen={() => onSelectName(leftId)}
        />
        <ComparisonPanel
          name={right}
          interpretation={rightInterpretation}
          evidence={evidenceFor(rightInterpretation)}
          relationships={rightRelationships}
          nameById={nameById}
          onOpen={() => onSelectName(rightId)}
        />
      </div>
    </div>
  );
}

function ComparisonPanel({ name, interpretation, evidence, relationships, nameById, onOpen }: {
  name: any;
  interpretation: any;
  evidence: Array<{ id: string; label: string; text: string }>;
  relationships: UserRelationship[];
  nameById: Map<string, string>;
  onOpen: () => void;
}) {
  if (!name) return <article className="comparison-panel"><p>לא נבחר שם.</p></article>;
  return (
    <article className="comparison-panel">
      <header><div><small>{name.id}</small><h3>{name.normalized}</h3></div><button onClick={onOpen}>פתח פירוש</button></header>
      <dl>
        <div><dt>מופעים</dt><dd>{name.occurrence_count}</dd></div>
        <div><dt>צורות מקור</dt><dd>{name.surface_forms.join(" · ")}</dd></div>
        <div><dt>מצב</dt><dd>{interpretation ? statusLabels[interpretation.status || "draft"] : "טרם פורש"}</dd></div>
        <div><dt>תפקיד</dt><dd>{interpretation?.role || "—"}</dd></div>
      </dl>
      <section><h4>משמעות</h4><p>{interpretation?.meaning || "טרם נכתבה משמעות."}</p></section>
      <section><h4>שדות מובנים</h4>{interpretation?.fields && Object.values(interpretation.fields).some(Boolean) ? <dl>{Object.entries(interpretation.fields).filter(([, value]) => value).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl> : <p>אין שדות מלאים.</p>}</section>
      <section><h4>ראיות</h4>{evidence.length ? evidence.map((item) => <div className="comparison-evidence" key={item.id}><b>{item.label}</b><small>{item.text}</small></div>) : <p>לא קושרו ראיות.</p>}</section>
      <section><h4>קשרים</h4>{relationships.length ? relationships.map((relationship) => <div className="comparison-relationship" key={relationship.id}><b>{nameById.get(relationship.from_name_id)} {relationLabels[relationship.relation] || relationship.relation} {nameById.get(relationship.to_name_id)}</b><small>{statusLabels[relationship.status || "draft"]} · {relationship.evidence_occurrence_ids?.length || 0} ראיות</small></div>) : <p>לא הוגדרו קשרים.</p>}</section>
    </article>
  );
}
