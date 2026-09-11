export type RevisionEntityType = "interpretation" | "relationship";
export type RevisionAction = "create" | "update" | "delete" | "rollback";

export type WorkspaceRevision = {
  id: string;
  entity_type: RevisionEntityType;
  entity_id: string;
  action: RevisionAction;
  before: unknown | null;
  after: unknown | null;
  created_at: string;
  rollback_of?: string;
};

const actionLabels: Record<RevisionAction, string> = {
  create: "נוצר",
  update: "עודכן",
  delete: "נמחק",
  rollback: "שוחזר",
};

const statusLabels: Record<string, string> = {
  draft: "טיוטה",
  accepted: "מאושר",
  rejected: "נדחה",
  unresolved: "לא הוכרע",
};

export function RevisionHistory({ corpus, revisions, onRollback }: {
  corpus: any;
  revisions: WorkspaceRevision[];
  onRollback: (revision: WorkspaceRevision) => void;
}) {
  const nameById = new Map<string, string>(corpus.evidence.names.map((name: any) => [name.id, name.normalized]));

  function titleFor(revision: WorkspaceRevision) {
    if (revision.entity_type === "interpretation") return nameById.get(revision.entity_id) || revision.entity_id;
    const snapshot = (revision.after || revision.before) as any;
    return snapshot
      ? `${nameById.get(snapshot.from_name_id) || snapshot.from_name_id} ← ${snapshot.relation} ← ${nameById.get(snapshot.to_name_id) || snapshot.to_name_id}`
      : revision.entity_id;
  }

  function statusFor(snapshot: unknown | null) {
    if (!snapshot || typeof snapshot !== "object") return "אינו קיים";
    const status = (snapshot as any).status || "draft";
    return statusLabels[status] || status;
  }

  return (
    <div className="revision-history">
      <section className="history-intro">
        <h3>היסטוריית שינויים</h3>
        <p>כל יצירה, עריכה, מחיקה ושחזור של פירוש או קשר נשמרים מקומית ונכללים בגיבוי העבודה.</p>
        <span><b>{revisions.length}</b> שינויים מתועדים</span>
      </section>
      {!revisions.length && <p className="history-empty">ההיסטוריה תתחיל בשינוי הבא.</p>}
      <section className="history-list">
        {revisions.map((revision) => (
          <article key={revision.id}>
            <header>
              <div><span>{revision.entity_type === "interpretation" ? "פירוש" : "קשר"}</span><strong>{titleFor(revision)}</strong></div>
              <time dateTime={revision.created_at}>{new Date(revision.created_at).toLocaleString("he-IL")}</time>
            </header>
            <p>{actionLabels[revision.action]} · {statusFor(revision.before)} ← {statusFor(revision.after)}</p>
            {revision.rollback_of && <small>שחזור של {revision.rollback_of}</small>}
            <button onClick={() => onRollback(revision)}>חזור למצב שלפני שינוי זה</button>
          </article>
        ))}
      </section>
    </div>
  );
}
