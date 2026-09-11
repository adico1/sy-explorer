type MotherMapping = {
  letter: string;
  principle: string;
  world: string;
  year: string;
  soul: string;
  function: string;
  permutations: string;
};

const mappings: MotherMapping[] = [
  {
    letter: "א׳",
    principle: "רוח",
    world: "אוויר",
    year: "רווה",
    soul: "גוויה",
    function: "מכריע בין אש למים",
    permutations: "זכר: אמ״ש · נקבה: אש״ם",
  },
  {
    letter: "מ׳",
    principle: "מים",
    world: "ארץ",
    year: "קור",
    soul: "בטן",
    function: "הקוטב המימי",
    permutations: "זכר: מא״ש · נקבה: מש״א",
  },
  {
    letter: "ש׳",
    principle: "אש",
    world: "שמים",
    year: "חום",
    soul: "ראש",
    function: "הקוטב האשי",
    permutations: "זכר: שא״מ · נקבה: שמ״א",
  },
];

const sourceUnitIds = ["sy.0029", "sy.0030", "sy.0031", "sy.0032", "sy.0033", "sy.0034", "sy.0035"];

function navigateToUnit(unit: any) {
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function ThreeMothersWorkspace({ corpus }: { corpus: any }) {
  const sources = sourceUnitIds
    .map((id) => corpus.units.find((unit: any) => unit.id === id))
    .filter(Boolean);

  return (
    <div className="three-mothers-workspace">
      <header className="mothers-intro">
        <div>
          <small>פרק 3 · יחידות 1–7</small>
          <h3>שלוש האמות אמ״ש</h3>
          <p>מיפוי מקור לפני פרשנות: כל הקבלה בטבלה נאמרת במפורש ביחידת ההמלכה.</p>
        </div>
        <div className="certainty-legend" aria-label="דרגות ודאות">
          <span className="certainty certainty--explicit">מפורש</span>
          <span className="certainty certainty--derived">נגזר</span>
          <span className="certainty certainty--interpretive">פרשני</span>
        </div>
      </header>

      <section className="mothers-balance" aria-label="מבנה האיזון">
        <article>
          <b>ש׳ · אש</b>
          <span>שמים · חום · ראש</span>
        </article>
        <div className="mothers-balance__axis">
          <span>מכריע־בינתיים</span>
          <strong>א׳ · רוח</strong>
          <small>אוויר · רווה · גוויה</small>
        </div>
        <article>
          <b>מ׳ · מים</b>
          <span>ארץ · קור · בטן</span>
        </article>
      </section>

      <section className="mothers-map">
        <h3>מפת ההקבלות המפורשות</h3>
        <div className="mothers-table-wrap">
          <table>
            <thead>
              <tr>
                <th>אות</th>
                <th>יסוד</th>
                <th>עולם</th>
                <th>שנה</th>
                <th>נפש</th>
                <th>תפקיד</th>
                <th>צירופי זכר ונקבה</th>
                <th>ודאות</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.letter}>
                  <td className="mother-letter">{mapping.letter}</td>
                  <td>{mapping.principle}</td>
                  <td>{mapping.world}</td>
                  <td>{mapping.year}</td>
                  <td>{mapping.soul}</td>
                  <td>{mapping.function}</td>
                  <td>{mapping.permutations}</td>
                  <td><span className="certainty certainty--explicit">מפורש</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mothers-claims">
        <h3>טענות המבנה</h3>
        <div>
          <article>
            <span className="certainty certainty--explicit">מפורש</span>
            <b>שני קטבים ומכריע ביניהם</b>
            <p>אש ומים מתחלקים; אוויר, רווה וגוויה מתוארים כמכריעים בין הקטבים.</p>
          </article>
          <article>
            <span className="certainty certainty--explicit">מפורש</span>
            <b>אותה תבנית בשלושה מישורים</b>
            <p>עולם, שנה ונפש נחתמים באותן שלוש אמות.</p>
          </article>
          <article>
            <span className="certainty certainty--derived">נגזר</span>
            <b>א׳ היא פעולת התיווך</b>
            <p>הטקסט מזהה את א׳ עם רוח ואת האוויר עם המכריע; החיבור ביניהם נגזר משתי הקבלות מפורשות.</p>
          </article>
          <article>
            <span className="certainty certainty--interpretive">פרשני</span>
            <b>כף חובה וכף זכות</b>
            <p>השלישייה נאמרת במפורש, אך שיוכה המדויק למ׳ ולש׳ אינו מפורט ביחידת ההמלכה ולכן נשאר פתוח.</p>
          </article>
        </div>
      </section>

      <section className="mothers-sources">
        <h3>כל קטעי המקור</h3>
        <div>
          {sources.map((unit: any) => (
            <article key={unit.id}>
              <header>
                <b>{unit.chapter_label} · {unit.unit_label}</b>
                <button onClick={() => navigateToUnit(unit)}>פתח בטקסט</button>
              </header>
              <p>{unit.source.text}</p>
              <small>{unit.id}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
