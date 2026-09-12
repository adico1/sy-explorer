import { useMemo, useState } from "react";

type WorkspaceTarget = "paths" | "sefirot" | "atlas" | "mothers" | "doubles" | "simples";

const hierarchy = [
  { count: 1, title: "אחד", note: "מושל בכולם; זהותו בשורת המבנה אינה מוגדרת", target: "sefirot" as const, certainty: "interpretive" },
  { count: 3, title: "שלושה אבות", note: "אש, מים ורוח", target: "mothers" as const, certainty: "explicit" },
  { count: 7, title: "שבעה", note: "שבעה כוכבים; שלושה מול שלושה וחוק מכריע", target: "doubles" as const, certainty: "explicit" },
  { count: 12, title: "שנים־עשר", note: "גבולי אלכסונין; עומדים במלחמה", target: "simples" as const, certainty: "explicit" },
];

const domains = [
  { name: "עולם", governor: "תלי", image: "כמלך על כיסאו" },
  { name: "שנה", governor: "גלגל", image: "כמלך במדינה" },
  { name: "נפש", governor: "לב", image: "כמלך במלחמה" },
];

const groups = [
  { title: "שלושה אוהבים", members: "הלב · האוזניים · הפה", status: "members" },
  { title: "שלושה שונאים", members: "הכבד · המרה · הלשון", status: "members" },
  { title: "שלושה מחיים", members: "הקבוצה נמנית, אך חבריה אינם מפורטים ביחידה", status: "open" },
  { title: "שלושה ממיתים", members: "הקבוצה נמנית, אך חבריה אינם מפורטים ביחידה", status: "open" },
];

const abrahamStages = ["צפה", "הביט", "ראה", "חקר", "הבין", "חקק", "חצב", "צירף", "צר", "עלתה בידו"];
const sourceUnitIds = ["sy.0047", "sy.0048", "sy.0049"];

function navigateToUnit(unit: any) {
  if (!unit) return;
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function ChapterSixSynthesisWorkspace({ corpus, onOpenWorkspace }: {
  corpus: any;
  onOpenWorkspace: (workspace: WorkspaceTarget) => void;
}) {
  const [selectedDomain, setSelectedDomain] = useState(0);
  const units = useMemo(() => new Map(corpus.units.map((unit: any) => [unit.id, unit])), [corpus]);
  const domain = domains[selectedDomain];

  return (
    <div className="synthesis-workspace">
      <header className="synthesis-intro">
        <div>
          <small>פרק 6 · sy.0047–sy.0049</small>
          <h3>מפת הסינתזה של ספר יצירה</h3>
          <p>מסך מסכם המחבר את המספרים, עולם־שנה־נפש ותהליך החקירה של אברהם. החיבורים נשמרים מילוליים ואינם נהפכים לגאומטריה שאינה כתובה.</p>
        </div>
        <button onClick={() => onOpenWorkspace("paths")}>פתח את מפת ל״ב הנתיבות</button>
      </header>

      <section className="synthesis-hierarchy">
        <header><h3>אחד על גבי שלושה על גבי שבעה על גבי שנים־עשר</h3><span className="certainty certainty--explicit">הסדר מפורש</span></header>
        <div>
          {hierarchy.map((layer, index) => (
            <span className="synthesis-layer-wrap" key={layer.count}>
              <button onClick={() => onOpenWorkspace(layer.target)}>
                <strong>{layer.count}</strong><span><b>{layer.title}</b><small>{layer.note}</small></span>
                <em className={`certainty certainty--${layer.certainty}`}>{layer.certainty === "explicit" ? "מפורש" : "פתוח"}</em>
              </button>
              {index < hierarchy.length - 1 && <i>על גבי</i>}
            </span>
          ))}
        </div>
        <p>„וכולן אדוקין זה בזה” קובע קשר בין השכבות, אך אינו מתאר את צורתו.</p>
      </section>

      <section className="synthesis-domains">
        <header><h3>שלושת מרחבי העדות</h3><small>עולם · שנה · נפש</small></header>
        <nav>{domains.map((item, index) => <button key={item.name} aria-pressed={selectedDomain === index} onClick={() => setSelectedDomain(index)}>{item.name}</button>)}</nav>
        <article>
          <span>{domain.name}</span><strong>{domain.governor}</strong><i>{domain.image}</i>
        </article>
        <div className="synthesis-domain-links">
          <button onClick={() => onOpenWorkspace("atlas")}>מפת ההקבלות עולם־שנה־נפש</button>
          <button onClick={() => navigateToUnit(units.get("sy.0048"))}>פתח את היחידה במקור</button>
        </div>
      </section>

      <section className="synthesis-polarity">
        <header><h3>זה לעומת זה</h3><span className="certainty certainty--explicit">טוב לעומת רע</span></header>
        <div className="synthesis-good-evil"><article><strong>טוב</strong><span>טוב מטוב</span><small>הטוב מבחין את הרע</small></article><i>לעומת</i><article><strong>רע</strong><span>רע מרע</span><small>הרע מבחין את הטוב</small></article></div>
        <div className="synthesis-groups">{groups.map((group) => <article key={group.title} data-status={group.status}><span className={`certainty certainty--${group.status === "members" ? "explicit" : "interpretive"}`}>{group.status === "members" ? "מפורש" : "חברים לא פורטו"}</span><b>{group.title}</b><p>{group.members}</p></article>)}</div>
      </section>

      <section className="synthesis-abraham">
        <header><h3>מסלול החקירה של אברהם</h3><small>סדר הפעלים ביחידה 3</small></header>
        <ol>{abrahamStages.map((stage, index) => <li key={stage}><b>{index + 1}</b><span>{stage}</span></li>)}</ol>
        <div><p>המסלול נע מתצפית והבנה אל חקיקה, חציבה, צירוף ויצירה; זהו תיאור סדר לשוני, לא מודל סיבתי מוכרע.</p><button onClick={() => navigateToUnit(units.get("sy.0049"))}>פתח את סיפור אברהם</button></div>
      </section>

      <section className="synthesis-open-cases">
        <h3>מקרים שהסינתזה אינה מכריעה</h3>
        <div>
          <article><span>אחד</span><b>זהות השכבה העליונה</b><p>„אחד על גבי שלושה” מופיע לאחר „אל מלך נאמן מושל בכולן”, אך היחידה אינה נותנת הגדרה פורמלית ל„אחד”.</p></article>
          <article><span>נ״א</span><b>חלופות בתוך יחידה 1</b><p>„כוכבים נ״א כבשן צבאותיהן” ו„שנים עשר נ״א עשרה” נשמרים כחלופות נוסח ללא בחירה.</p></article>
          <article><span>קבוצות</span><b>מחיים וממיתים</b><p>שתי הקבוצות נמנות כשלשות, אך בניגוד לאוהבים ולשונאים חבריהן אינם מפורטים.</p></article>
        </div>
      </section>

      <section className="synthesis-sources">
        <h3>שלוש יחידות המקור</h3>
        <div>{sourceUnitIds.map((id) => units.get(id)).filter(Boolean).map((unit: any) => (
          <article key={unit.id}>
            <header><b>{unit.chapter_label} · {unit.unit_label}</b><button onClick={() => navigateToUnit(unit)}>פתח בטקסט</button></header>
            <p>{unit.source.text}</p><small>{unit.id}</small>
          </article>
        ))}</div>
      </section>
    </div>
  );
}
