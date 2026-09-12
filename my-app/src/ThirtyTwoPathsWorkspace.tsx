import { useMemo, useState } from "react";

type LetterWorkspace = "atlas" | "gates" | "mothers" | "doubles" | "simples";

type Sefirah = {
  number: number;
  label: string;
  detail: string;
  sourceUnitId: string;
};

const sefirot: Sefirah[] = [
  { number: 1, label: "רוּחַ אֱלֹהִים חַיִּים", detail: "קול, רוח ודיבור; רוח הקודש", sourceUnitId: "sy.0010" },
  { number: 2, label: "רוּחַ מֵרוּחַ", detail: "בה נחקקו ונחצבו עשרים ושתיים אותיות היסוד", sourceUnitId: "sy.0011" },
  { number: 3, label: "מַיִם מֵרוּחַ", detail: "תהו ובהו, רפש וטיט", sourceUnitId: "sy.0012" },
  { number: 4, label: "אֵשׁ מִמַּיִם", detail: "כיסא הכבוד, שרפים, אופנים וחיות הקודש", sourceUnitId: "sy.0013" },
  { number: 5, label: "רוּם", detail: "חתם רום ופנה למעלה", sourceUnitId: "sy.0014" },
  { number: 6, label: "תַּחַת", detail: "חתם תחת ופנה למטה", sourceUnitId: "sy.0015" },
  { number: 7, label: "מִזְרָח", detail: "חתם מזרח ופנה לפניו", sourceUnitId: "sy.0016" },
  { number: 8, label: "מַעֲרָב", detail: "חתם מערב ופנה לאחריו", sourceUnitId: "sy.0017" },
  { number: 9, label: "דָּרוֹם", detail: "חתם דרום ופנה לימינו", sourceUnitId: "sy.0018" },
  { number: 10, label: "צָפוֹן", detail: "חתם צפון ופנה לשמאלו", sourceUnitId: "sy.0019" },
];

const letterGroups = [
  { count: 3, title: "שלוש אמות", letters: "אמ״ש", workspace: "mothers" as const, note: "קטבים ומכריע" },
  { count: 7, title: "שבע כפולות", letters: "בג״ד כפר״ת", workspace: "doubles" as const, note: "תמורות וזוגות" },
  { count: 12, title: "שתים־עשרה פשוטות", letters: "ה״ו ז״ח ט״י ל״נ ס״ע צ״ק", workspace: "simples" as const, note: "גבולים ומנהיגים" },
];

const sourceUnitIds = ["sy.0001", "sy.0002", "sy.0020", "sy.0021"];

function navigateToUnit(unit: any) {
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function ThirtyTwoPathsWorkspace({ corpus, onOpenWorkspace }: {
  corpus: any;
  onOpenWorkspace: (workspace: LetterWorkspace) => void;
}) {
  const [selectedNumber, setSelectedNumber] = useState(1);
  const selected = sefirot.find((sefirah) => sefirah.number === selectedNumber) || sefirot[0];
  const units = useMemo(() => new Map(corpus.units.map((unit: any) => [unit.id, unit])), [corpus]);
  const selectedUnit = units.get(selected.sourceUnitId) as any;

  return (
    <div className="paths-workspace">
      <header className="paths-intro">
        <div>
          <small>פרק 1, פסוקים 1–9 · פרק 2, יחידה 1</small>
          <h3>מפת ל״ב נתיבות החכמה</h3>
          <p>מפת מבנה מקורית־טקסטואלית: עשר ספירות בלי־מה לצד עשרים ושתיים אותיות יסוד. היא אינה מניחה חיבורים פרטניים שהספר אינו מונה.</p>
        </div>
        <div className="certainty-legend" aria-label="דרגות ודאות">
          <span className="certainty certainty--explicit">מפורש</span>
          <span className="certainty certainty--derived">חישוב נגזר</span>
          <span className="certainty certainty--interpretive">לא מוכרע</span>
        </div>
      </header>

      <section className="paths-equation" aria-label="מבנה ל״ב הנתיבות">
        <article><strong>10</strong><b>ספירות בלי־מה</b><span className="certainty certainty--explicit">מפורש</span></article>
        <i>+</i>
        <article><strong>22</strong><b>אותיות יסוד</b><span className="certainty certainty--explicit">מפורש</span></article>
        <i>=</i>
        <article className="paths-equation__total"><strong>32</strong><b>נתיבות פליאות חכמה</b><span className="certainty certainty--derived">חיבור חשבוני</span></article>
      </section>

      <section className="paths-map">
        <div className="paths-sefirot">
          <header><h3>עשר הספירות</h3><small>בחר ספירה לעיון במקור</small></header>
          <div className="paths-sefirot__grid">
            {sefirot.map((sefirah) => (
              <button key={sefirah.number} className={selected.number === sefirah.number ? "is-selected" : ""} onClick={() => setSelectedNumber(sefirah.number)}>
                <b>{sefirah.number}</b><span>{sefirah.label}</span>
              </button>
            ))}
          </div>
          <article className="paths-selection">
            <header><span>ספירה {selected.number}</span><small>{selected.sourceUnitId}</small></header>
            <h4>{selected.label}</h4>
            <p>{selected.detail}</p>
            <button disabled={!selectedUnit} onClick={() => selectedUnit && navigateToUnit(selectedUnit)}>פתח את היחידה בטקסט</button>
          </article>
        </div>

        <div className="paths-divider" aria-hidden="true"><span>לצד</span></div>

        <div className="paths-letters">
          <header><h3>עשרים ושתיים האותיות</h3><button onClick={() => onOpenWorkspace("atlas")}>פתח את מפת 22 האותיות</button></header>
          <div>
            {letterGroups.map((group) => (
              <button key={group.workspace} data-group={group.workspace} onClick={() => onOpenWorkspace(group.workspace)}>
                <strong>{group.count}</strong>
                <span><b>{group.title}</b><small>{group.note}</small></span>
                <em>{group.letters}</em>
              </button>
            ))}
          </div>
          <button className="paths-gates-link" onClick={() => onOpenWorkspace("gates")}>
            <span><b>רל״א השערים</b><small>מרחב הצירופים של 22 האותיות</small></span><strong>231</strong>
          </button>
        </div>
      </section>

      <section className="paths-boundaries">
        <h3>מה המפה יודעת — ומה לא</h3>
        <div>
          <article><span className="certainty certainty--explicit">מפורש</span><b>שני מרכיבי היסוד</b><p>הספר מונה עשר ספירות ועשרים ושתיים אותיות, ומחלק את האותיות ל־3, 7 ו־12.</p></article>
          <article><span className="certainty certainty--derived">נגזר</span><b>10 + 22 = 32</b><p>החיבור החשבוני מתאים לכותרת ל״ב הנתיבות; הוא מוצג כחישוב ולא כציטוט של נוסחה.</p></article>
          <article><span className="certainty certainty--interpretive">פתוח</span><b>אין מפת קווים מפורשת</b><p>הטקסט אינו משייך כל אות לספירה מסוימת. לכן לא צוירו 22 נתיבים גאומטריים ביניהן.</p></article>
        </div>
      </section>

      <section className="paths-journey">
        <h3>מסלול חקירה מוצע</h3>
        <ol>
          <li><button onClick={() => navigateToUnit(units.get("sy.0001"))}><b>1</b><span>פתח את הכרזת ל״ב הנתיבות</span></button></li>
          <li><button onClick={() => navigateToUnit(units.get("sy.0002"))}><b>2</b><span>ראה את החלוקה לעשר ולעשרים ושתיים</span></button></li>
          <li><button onClick={() => setSelectedNumber(1)}><b>3</b><span>עבור בעשר הספירות לפי סדר הטקסט</span></button></li>
          <li><button onClick={() => onOpenWorkspace("atlas")}><b>4</b><span>המשך למפת האותיות ולהקבלותיהן</span></button></li>
        </ol>
      </section>

      <section className="paths-sources">
        <h3>יחידות המקור</h3>
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
