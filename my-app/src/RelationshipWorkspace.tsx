import { useMemo, useState, type FormEvent } from "react";

export type UserRelationship = {
  id: string;
  from_name_id: string;
  relation: string;
  to_name_id: string;
  note: string;
  authority: "user_interpretation";
  created_at: string;
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

  const nameById = useMemo<Map<string, string>>(() => new Map(names.map((name: any) => [name.id, name.normalized])), [names]);

  function addRelationship(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromId || !toId || fromId === toId) return;
    const data = new FormData(event.currentTarget);
    const relationship: UserRelationship = {
      id: `user-relation.${Date.now()}`,
      from_name_id: fromId,
      relation: String(data.get("relation") || "related_to"),
      to_name_id: toId,
      note: String(data.get("note") || "").trim(),
      authority: "user_interpretation",
      created_at: new Date().toISOString(),
    };
    onChange([...relationships, relationship]);
    event.currentTarget.reset();
  }

  return (
    <div className="relationship-workspace">
      <section className="relationship-builder">
        <h3>יצירת קשר ידני</h3>
        <p>רק קשרים שאתה יוצר נכנסים לגרף. המערכת אינה מסיקה משמעות בעצמה.</p>
        <form onSubmit={addRelationship}>
          <label>מקור<select value={fromId} onChange={(event) => setFromId(event.target.value)}>{names.map((name: any) => <option key={name.id} value={name.id}>{name.normalized}</option>)}</select></label>
          <label>יחס<select name="relation" defaultValue="related_to">{Object.entries(relationLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>יעד<select value={toId} onChange={(event) => setToId(event.target.value)}>{names.map((name: any) => <option key={name.id} value={name.id}>{name.normalized}</option>)}</select></label>
          <label className="relationship-note">הערה<input name="note" placeholder="מדוע הקשר קיים ומה מקורו" /></label>
          <button className="converter__primary" type="submit" disabled={!fromId || !toId || fromId === toId}>הוסף קשר</button>
        </form>
      </section>
      <RelationshipGraph relationships={relationships} nameById={nameById} onSelectName={onSelectName} />
      <section className="relationship-list">
        <h3>קשרים מאושרים על ידך</h3>
        {!relationships.length && <p>עדיין לא הוגדרו קשרים.</p>}
        {relationships.map((item) => (
          <article key={item.id}>
            <button onClick={() => onSelectName(item.from_name_id)}>{nameById.get(item.from_name_id)}</button>
            <span>{relationLabels[item.relation] || item.relation}</span>
            <button onClick={() => onSelectName(item.to_name_id)}>{nameById.get(item.to_name_id)}</button>
            {item.note && <small>{item.note}</small>}
            <button className="relationship-delete" onClick={() => onChange(relationships.filter((relationship) => relationship.id !== item.id))}>מחק</button>
          </article>
        ))}
      </section>
    </div>
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
      <h3>גרף קשרים</h3>
      {!relationships.length ? <p>הגרף יופיע לאחר יצירת הקשר הראשון.</p> : (
        <svg viewBox="0 0 600 340" role="img" aria-label="גרף הקשרים שהוגדרו על ידי המשתמש">
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
