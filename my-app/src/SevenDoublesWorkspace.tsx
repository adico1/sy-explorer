type DoubleMapping = {
  letter: string;
  tongues: string;
  quality: string;
  qualityCertainty: "explicit" | "derived";
  world: string;
  year: string;
  soul: string;
};

const mappings: DoubleMapping[] = [
  { letter: "ב׳", tongues: "ב / בּ", quality: "חיים ↔ מוות", qualityCertainty: "explicit", world: "שבתי", year: "יום ראשון", soul: "עין ימין" },
  { letter: "ג׳", tongues: "ג / גּ", quality: "שלום ↔ רע", qualityCertainty: "derived", world: "צדק", year: "יום שני", soul: "עין שמאל" },
  { letter: "ד׳", tongues: "ד / דּ", quality: "חכמה ↔ אולת", qualityCertainty: "derived", world: "מאדים", year: "יום שלישי", soul: "אוזן ימין" },
  { letter: "כ׳", tongues: "כ / כּ", quality: "עושר ↔ עוני", qualityCertainty: "derived", world: "חמה", year: "יום רביעי", soul: "אוזן שמאל" },
  { letter: "פ׳", tongues: "פ / פּ", quality: "חן ↔ כיעור", qualityCertainty: "derived", world: "נוגה", year: "יום חמישי", soul: "נחיר ימין" },
  { letter: "ר׳", tongues: "ר / רּ", quality: "זרע ↔ שממה", qualityCertainty: "derived", world: "כוכב", year: "יום שישי", soul: "נחיר שמאל" },
  { letter: "ת׳", tongues: "ת / תּ", quality: "ממשלה ↔ עבדות", qualityCertainty: "derived", world: "לבנה", year: "יום שבת", soul: "פה" },
];

const sourceUnitIds = ["sy.0036", "sy.0037", "sy.0038", "sy.0039", "sy.0040", "sy.0041"];

function navigateToUnit(unit: any) {
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function SevenDoublesWorkspace({ corpus }: { corpus: any }) {
  const sources = sourceUnitIds
    .map((id) => corpus.units.find((unit: any) => unit.id === id))
    .filter(Boolean);

  return (
    <div className="seven-doubles-workspace">
      <header className="doubles-intro">
        <div>
          <small>פרק 4 · יחידות 1–6</small>
          <h3>שבע הכפולות בג״ד כפר״ת</h3>
          <p>הפרדה בין ההמלכות המפורשות לבין התאמות הנובעות מסדר רשימת התמורות.</p>
        </div>
        <div className="certainty-legend" aria-label="דרגות ודאות">
          <span className="certainty certainty--explicit">מפורש</span>
          <span className="certainty certainty--derived">נגזר</span>
          <span className="certainty certainty--interpretive">פרשני</span>
        </div>
      </header>

      <section className="doubles-space">
        <h3>שישה קצוות והיכל הקודש באמצע</h3>
        <div className="doubles-axes" aria-label="שלושת צירי המרחב והמרכז">
          <div><span>מעלה</span><i>↔</i><strong>היכל הקודש</strong><i>↔</i><span>מטה</span></div>
          <div><span>מזרח</span><i>↔</i><strong>היכל הקודש</strong><i>↔</i><span>מערב</span></div>
          <div><span>צפון</span><i>↔</i><strong>היכל הקודש</strong><i>↔</i><span>דרום</span></div>
        </div>
        <p><span className="certainty certainty--explicit">מפורש</span> שבע הכפולות עומדות כנגד שבעת הקצוות; שיוך אות מסוימת לכיוון מסוים אינו מפורט כאן.</p>
      </section>

      <section className="doubles-map">
        <h3>מפת ההקבלות</h3>
        <div className="doubles-table-wrap">
          <table>
            <thead>
              <tr>
                <th>אות</th>
                <th>שתי לשונות</th>
                <th>איכות ותמורה</th>
                <th>ודאות האיכות</th>
                <th>עולם · כוכב</th>
                <th>שנה · יום</th>
                <th>נפש · שער</th>
                <th>ודאות ההמלכה</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.letter}>
                  <td className="double-letter">{mapping.letter}</td>
                  <td>{mapping.tongues}</td>
                  <td>{mapping.quality}</td>
                  <td><span className={`certainty certainty--${mapping.qualityCertainty}`}>{mapping.qualityCertainty === "explicit" ? "מפורש" : "נגזר מסדר"}</span></td>
                  <td>{mapping.world}</td>
                  <td>{mapping.year}</td>
                  <td>{mapping.soul}</td>
                  <td><span className="certainty certainty--explicit">מפורש</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="doubles-claims">
        <h3>טענות המבנה ונקודות פתוחות</h3>
        <div>
          <article>
            <span className="certainty certainty--explicit">מפורש</span>
            <b>שתי לשונות ושתי תמורות</b>
            <p>הכפילות מתוארת כרך וקשה, גיבור וחלש, וכזוגות של איכויות מנוגדות.</p>
          </article>
          <article>
            <span className="certainty certainty--explicit">מפורש</span>
            <b>עולם, שנה ונפש</b>
            <p>כל אות מומלכת בנפרד ומחוברת במפורש לכוכב, יום ושער גופני.</p>
          </article>
          <article>
            <span className="certainty certainty--derived">נגזר</span>
            <b>רוב שיוכי האיכויות</b>
            <p>רק ב׳ מומלכת במפורש בחיים. יתר האיכויות משויכות לאותיות לפי סדר שתי הרשימות.</p>
          </article>
          <article>
            <span className="certainty certainty--interpretive">פתוח</span>
            <b>אות מול כיוון</b>
            <p>הטקסט קובע יחס בין שבע האותיות לשבעת הקצוות, אך אינו נותן כאן התאמה פרטנית.</p>
          </article>
          <article>
            <span className="certainty certainty--explicit">מפורש</span>
            <b>ריבוי באמצעות צירוף</b>
            <p>שבע אבנים בונות 5,040 בתים; סדר האותיות עצמו נעשה מרחב של אפשרויות.</p>
          </article>
          <article>
            <span className="certainty certainty--interpretive">זהירות</span>
            <b>רשימת הכוכבים המסכמת</b>
            <p>סדרהּ שונה מסדר ההמלכות ולכן אינה משמשת כאן להחלפת המיפוי הפרטני המפורש.</p>
          </article>
        </div>
      </section>

      <section className="doubles-sources">
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
