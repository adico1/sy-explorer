type SimpleMapping = {
  letter: string;
  faculty: string;
  boundary: string;
  zodiac: string;
  month: string;
  organ: string;
};

const mappings: SimpleMapping[] = [
  { letter: "ה׳", faculty: "ראייה", boundary: "מזרחית־צפונית", zodiac: "טלה", month: "ניסן", organ: "יד ימין" },
  { letter: "ו׳", faculty: "שמיעה", boundary: "מזרחית־דרומית", zodiac: "שור", month: "אייר", organ: "יד שמאל" },
  { letter: "ז׳", faculty: "ריח", boundary: "מזרחית־רומית", zodiac: "תאומים", month: "סיוון", organ: "רגל ימין" },
  { letter: "ח׳", faculty: "שיחה", boundary: "מזרחית־תחתית", zodiac: "סרטן", month: "תמוז", organ: "רגל שמאל" },
  { letter: "ט׳", faculty: "לעיטה", boundary: "צפונית־רומית", zodiac: "אריה", month: "אב", organ: "כולא ימין" },
  { letter: "י׳", faculty: "תשמיש", boundary: "צפונית־תחתית", zodiac: "בתולה", month: "אלול", organ: "כולא שמאל" },
  { letter: "ל׳", faculty: "מעשה", boundary: "מערבית־דרומית", zodiac: "מאזניים", month: "תשרי", organ: "כבד" },
  { letter: "נ׳", faculty: "הלוך", boundary: "מערבית־צפונית", zodiac: "עקרב", month: "מרחשוון", organ: "טחול" },
  { letter: "ס׳", faculty: "רוגז", boundary: "מערבית־רומית", zodiac: "קשת", month: "כסלו", organ: "מרה" },
  { letter: "ע׳", faculty: "שחוק", boundary: "מערבית־תחתית", zodiac: "גדי", month: "טבת", organ: "המסס" },
  { letter: "צ׳", faculty: "הרהור", boundary: "דרומית־רומית", zodiac: "דלי", month: "שבט", organ: "קיבה" },
  { letter: "ק׳", faculty: "שינה", boundary: "דרומית־תחתית", zodiac: "דגים", month: "אדר", organ: "קורקבן" },
];

const sourceUnitIds = ["sy.0042", "sy.0043", "sy.0044", "sy.0045", "sy.0046"];

function navigateToUnit(unit: any) {
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function TwelveSimplesWorkspace({ corpus }: { corpus: any }) {
  const sources = sourceUnitIds
    .map((id) => corpus.units.find((unit: any) => unit.id === id))
    .filter(Boolean);

  return (
    <div className="twelve-simples-workspace">
      <header className="simples-intro">
        <div>
          <small>פרק 5 · יחידות 1–5</small>
          <h3>שתים־עשרה הפשוטות</h3>
          <p>ה״ו · ז״ח · ט״י · ל״נ · ס״ע · צ״ק — מיפוי המקור עם הבחנה בין המלכה מפורשת להתאמת סדר.</p>
        </div>
        <div className="certainty-legend" aria-label="דרגות ודאות">
          <span className="certainty certainty--explicit">מפורש</span>
          <span className="certainty certainty--derived">נגזר</span>
          <span className="certainty certainty--interpretive">פרשני</span>
        </div>
      </header>

      <section className="simples-space">
        <div>
          <h3>י״ב גבולי האלכסון</h3>
          <p>הטקסט מונה שנים־עשר גבולים; התרשים הקובייתי הוא מודל חזותי פרשני למספר ולמבנה הצירופים.</p>
          <span className="certainty certainty--interpretive">מודל פרשני</span>
        </div>
        <svg viewBox="0 0 360 220" role="img" aria-label="מודל קובייתי בעל שנים עשר מקצועות">
          <title>מודל קובייתי לי״ב גבולי האלכסון</title>
          <g className="cube-back">
            <rect x="118" y="28" width="150" height="130" />
          </g>
          <g className="cube-front">
            <rect x="70" y="62" width="150" height="130" />
            <line x1="70" y1="62" x2="118" y2="28" />
            <line x1="220" y1="62" x2="268" y2="28" />
            <line x1="70" y1="192" x2="118" y2="158" />
            <line x1="220" y1="192" x2="268" y2="158" />
          </g>
          <text x="170" y="214">12 מקצועות · 12 גבולים</text>
        </svg>
        <div className="boundary-groups">
          <p><b>מזרח:</b> צפון · דרום · רום · תחת</p>
          <p><b>מערב:</b> דרום · צפון · רום · תחת</p>
          <p><b>צפון/דרום:</b> צפון־רום · צפון־תחת · דרום־רום · דרום־תחת</p>
        </div>
      </section>

      <section className="simples-map">
        <h3>המפה המחוברת</h3>
        <div className="simples-table-wrap">
          <table>
            <thead>
              <tr>
                <th>אות</th>
                <th>יסוד בנפש</th>
                <th>גבול אלכסון</th>
                <th>עולם · מזל</th>
                <th>שנה · חודש</th>
                <th>נפש · מנהיג</th>
                <th>ודאות</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.letter}>
                  <td className="simple-letter">{mapping.letter}</td>
                  <td>{mapping.faculty}<span className="certainty certainty--derived">נגזר מסדר</span></td>
                  <td>{mapping.boundary}<span className="certainty certainty--derived">נגזר מסדר</span></td>
                  <td>{mapping.zodiac}</td>
                  <td>{mapping.month}</td>
                  <td>{mapping.organ}</td>
                  <td><span className="certainty certainty--explicit">מזל–חודש–איבר מפורשים</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="simples-claims">
        <h3>טענות המבנה ונקודות פתוחות</h3>
        <div>
          <article>
            <span className="certainty certainty--explicit">מפורש</span>
            <b>המלכות פרטניות</b>
            <p>לכל אות נקבעים במפורש מזל בעולם, חודש בשנה ומנהיג בנפש.</p>
          </article>
          <article>
            <span className="certainty certainty--derived">נגזר</span>
            <b>כוחות וגבולות</b>
            <p>השיוך הפרטני לאותיות נובע מהעמדת שלוש רשימות בנות שנים־עשר איברים באותו סדר.</p>
          </article>
          <article className="simples-conflict">
            <span className="certainty certainty--interpretive">פער נוסח</span>
            <b>כבד וטחול</b>
            <p>הרשימה הכללית מציבה טחול לפני כבד; ההמלכות המפורשות קובעות ל׳–כבד ונ׳–טחול. הטבלה מעדיפה את ההמלכות ואינה מוחקת את הפער.</p>
          </article>
          <article>
            <span className="certainty certainty--interpretive">פתוח</span>
            <b>זכר ונקבה</b>
            <p>הביטוי מופיע בסוף המלכת ה׳; היקפו ביחס לכל שתים־עשרה האותיות אינו מפורט כאן.</p>
          </article>
          <article>
            <span className="certainty certainty--explicit">מפורש</span>
            <b>פעולת היצירה</b>
            <p>חקקן, חצבן, שקלן, צרפן והמירן — ולאחר מכן צר בהן את מערכות העולם, השנה והנפש.</p>
          </article>
          <article>
            <span className="certainty certainty--interpretive">לא מפוענח</span>
            <b>סימן טש״ת סא״ב מע״ק גד״ד</b>
            <p>הסימן נשמר כמקור אך אינו מפוענח או משמש לשינוי המיפוי ללא עדות נוספת.</p>
          </article>
        </div>
      </section>

      <section className="simples-sources">
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
