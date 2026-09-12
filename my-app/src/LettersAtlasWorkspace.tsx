import { useMemo, useState } from "react";

type LetterGroup = "mothers" | "doubles" | "simples";
type Certainty = "explicit" | "derived";
type GroupFilter = "all" | LetterGroup;

type LetterMapping = {
  letter: string;
  group: LetterGroup;
  foundation: string;
  foundationCertainty: Certainty;
  structure: string;
  world: string;
  year: string;
  soul: string;
  sourceUnitId: string;
};

const groupLabels: Record<LetterGroup, string> = {
  mothers: "שלוש האמות",
  doubles: "שבע הכפולות",
  simples: "י״ב הפשוטות",
};

const mappings: LetterMapping[] = [
  { letter: "א׳", group: "mothers", foundation: "רוח", foundationCertainty: "explicit", structure: "מכריע בין אש למים", world: "אוויר", year: "רווה", soul: "גוויה", sourceUnitId: "sy.0035" },
  { letter: "מ׳", group: "mothers", foundation: "מים", foundationCertainty: "explicit", structure: "הקוטב המימי", world: "ארץ", year: "קור", soul: "בטן", sourceUnitId: "sy.0035" },
  { letter: "ש׳", group: "mothers", foundation: "אש", foundationCertainty: "explicit", structure: "הקוטב האשי", world: "שמים", year: "חום", soul: "ראש", sourceUnitId: "sy.0035" },
  { letter: "ב׳", group: "doubles", foundation: "חיים ↔ מוות", foundationCertainty: "explicit", structure: "ב / בּ", world: "שבתי", year: "יום ראשון", soul: "עין ימין", sourceUnitId: "sy.0041" },
  { letter: "ג׳", group: "doubles", foundation: "שלום ↔ רע", foundationCertainty: "derived", structure: "ג / גּ", world: "צדק", year: "יום שני", soul: "עין שמאל", sourceUnitId: "sy.0041" },
  { letter: "ד׳", group: "doubles", foundation: "חכמה ↔ אולת", foundationCertainty: "derived", structure: "ד / דּ", world: "מאדים", year: "יום שלישי", soul: "אוזן ימין", sourceUnitId: "sy.0041" },
  { letter: "כ׳", group: "doubles", foundation: "עושר ↔ עוני", foundationCertainty: "derived", structure: "כ / כּ", world: "חמה", year: "יום רביעי", soul: "אוזן שמאל", sourceUnitId: "sy.0041" },
  { letter: "פ׳", group: "doubles", foundation: "חן ↔ כיעור", foundationCertainty: "derived", structure: "פ / פּ", world: "נוגה", year: "יום חמישי", soul: "נחיר ימין", sourceUnitId: "sy.0041" },
  { letter: "ר׳", group: "doubles", foundation: "זרע ↔ שממה", foundationCertainty: "derived", structure: "ר / רּ", world: "כוכב", year: "יום שישי", soul: "נחיר שמאל", sourceUnitId: "sy.0041" },
  { letter: "ת׳", group: "doubles", foundation: "ממשלה ↔ עבדות", foundationCertainty: "derived", structure: "ת / תּ", world: "לבנה", year: "יום שבת", soul: "פה", sourceUnitId: "sy.0041" },
  { letter: "ה׳", group: "simples", foundation: "ראייה", foundationCertainty: "derived", structure: "מזרחית־צפונית", world: "טלה", year: "ניסן", soul: "יד ימין", sourceUnitId: "sy.0046" },
  { letter: "ו׳", group: "simples", foundation: "שמיעה", foundationCertainty: "derived", structure: "מזרחית־דרומית", world: "שור", year: "אייר", soul: "יד שמאל", sourceUnitId: "sy.0046" },
  { letter: "ז׳", group: "simples", foundation: "ריח", foundationCertainty: "derived", structure: "מזרחית־רומית", world: "תאומים", year: "סיוון", soul: "רגל ימין", sourceUnitId: "sy.0046" },
  { letter: "ח׳", group: "simples", foundation: "שיחה", foundationCertainty: "derived", structure: "מזרחית־תחתית", world: "סרטן", year: "תמוז", soul: "רגל שמאל", sourceUnitId: "sy.0046" },
  { letter: "ט׳", group: "simples", foundation: "לעיטה", foundationCertainty: "derived", structure: "צפונית־רומית", world: "אריה", year: "אב", soul: "כולא ימין", sourceUnitId: "sy.0046" },
  { letter: "י׳", group: "simples", foundation: "תשמיש", foundationCertainty: "derived", structure: "צפונית־תחתית", world: "בתולה", year: "אלול", soul: "כולא שמאל", sourceUnitId: "sy.0046" },
  { letter: "ל׳", group: "simples", foundation: "מעשה", foundationCertainty: "derived", structure: "מערבית־דרומית", world: "מאזניים", year: "תשרי", soul: "כבד", sourceUnitId: "sy.0046" },
  { letter: "נ׳", group: "simples", foundation: "הלוך", foundationCertainty: "derived", structure: "מערבית־צפונית", world: "עקרב", year: "מרחשוון", soul: "טחול", sourceUnitId: "sy.0046" },
  { letter: "ס׳", group: "simples", foundation: "רוגז", foundationCertainty: "derived", structure: "מערבית־רומית", world: "קשת", year: "כסלו", soul: "מרה", sourceUnitId: "sy.0046" },
  { letter: "ע׳", group: "simples", foundation: "שחוק", foundationCertainty: "derived", structure: "מערבית־תחתית", world: "גדי", year: "טבת", soul: "המסס", sourceUnitId: "sy.0046" },
  { letter: "צ׳", group: "simples", foundation: "הרהור", foundationCertainty: "derived", structure: "דרומית־רומית", world: "דלי", year: "שבט", soul: "קיבה", sourceUnitId: "sy.0046" },
  { letter: "ק׳", group: "simples", foundation: "שינה", foundationCertainty: "derived", structure: "דרומית־תחתית", world: "דגים", year: "אדר", soul: "קורקבן", sourceUnitId: "sy.0046" },
];

function navigateToUnit(unit: any) {
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function LettersAtlasWorkspace({ corpus }: { corpus: any }) {
  const [filter, setFilter] = useState<GroupFilter>("all");
  const visibleMappings = filter === "all" ? mappings : mappings.filter((mapping) => mapping.group === filter);
  const sourceUnits = useMemo(() => new Map(mappings.map((mapping) => [
    mapping.sourceUnitId,
    corpus.units.find((unit: any) => unit.id === mapping.sourceUnitId),
  ])), [corpus]);

  return (
    <div className="letters-atlas-workspace">
      <header className="atlas-intro">
        <div>
          <small>פרקים 3–5 · אמ״ש · בג״ד כפר״ת · ה״ו ז״ח ט״י ל״נ ס״ע צ״ק</small>
          <h3>מפת 22 אותיות היסוד</h3>
          <p>מבט מאוחד על עולם, שנה ונפש — תוך שמירה על ההבדל בין הכתוב במפורש לבין התאמות הנגזרות מסדר הרשימות.</p>
        </div>
        <div className="certainty-legend" aria-label="דרגות ודאות">
          <span className="certainty certainty--explicit">מפורש</span>
          <span className="certainty certainty--derived">נגזר מסדר</span>
          <span className="certainty certainty--interpretive">פתוח</span>
        </div>
      </header>

      <section className="atlas-architecture" aria-label="מבנה עשרים ושתיים האותיות">
        <article className="atlas-group atlas-group--mothers">
          <strong>3</strong><b>שלוש אמות</b><span>קטבים ומכריע</span><small>אמ״ש</small>
        </article>
        <span className="atlas-plus">+</span>
        <article className="atlas-group atlas-group--doubles">
          <strong>7</strong><b>שבע כפולות</b><span>תמורות וזוגות</span><small>בג״ד כפר״ת</small>
        </article>
        <span className="atlas-plus">+</span>
        <article className="atlas-group atlas-group--simples">
          <strong>12</strong><b>שתים־עשרה פשוטות</b><span>גבולים ומנהיגים</span><small>ה״ו ז״ח ט״י ל״נ ס״ע צ״ק</small>
        </article>
        <span className="atlas-equals">=</span>
        <article className="atlas-total"><strong>22</strong><b>אותיות יסוד</b></article>
      </section>

      <nav className="atlas-filters" aria-label="סינון מפת האותיות">
        {(["all", "mothers", "doubles", "simples"] as GroupFilter[]).map((value) => (
          <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {value === "all" ? "כל 22 האותיות" : groupLabels[value]}
          </button>
        ))}
      </nav>

      <section className="atlas-map">
        <header>
          <h3>טבלת ההקבלות המאוחדת</h3>
          <span>{visibleMappings.length} אותיות מוצגות</span>
        </header>
        <div className="atlas-table-wrap">
          <table>
            <thead>
              <tr>
                <th>אות</th>
                <th>מחלקה</th>
                <th>יסוד / כוח</th>
                <th>מבנה נוסף</th>
                <th>עולם</th>
                <th>שנה</th>
                <th>נפש</th>
                <th>מקור</th>
              </tr>
            </thead>
            <tbody>
              {visibleMappings.map((mapping) => {
                const sourceUnit = sourceUnits.get(mapping.sourceUnitId);
                return (
                  <tr key={mapping.letter} data-group={mapping.group}>
                    <td className="atlas-letter">{mapping.letter}</td>
                    <td><span className={`atlas-group-label atlas-group-label--${mapping.group}`}>{groupLabels[mapping.group]}</span></td>
                    <td>{mapping.foundation}<span className={`certainty certainty--${mapping.foundationCertainty}`}>{mapping.foundationCertainty === "explicit" ? "מפורש" : "נגזר מסדר"}</span></td>
                    <td>{mapping.structure}</td>
                    <td>{mapping.world}<span className="certainty certainty--explicit">מפורש</span></td>
                    <td>{mapping.year}<span className="certainty certainty--explicit">מפורש</span></td>
                    <td>{mapping.soul}<span className="certainty certainty--explicit">מפורש</span></td>
                    <td><button disabled={!sourceUnit} onClick={() => sourceUnit && navigateToUnit(sourceUnit)}>פתח {mapping.sourceUnitId}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="atlas-open-cases">
        <h3>מקרים פתוחים שהמפה אינה מכריעה</h3>
        <div>
          <article><span>שבע כפולות</span><b>אות מול כיוון</b><p>היחס לשבעת הקצוות מפורש, אך השיוך הפרטני של אות לכל כיוון אינו ניתן ביחידה.</p></article>
          <article><span>י״ב פשוטות</span><b>כבד מול טחול</b><p>סדר הרשימה הכללית שונה מסדר ההמלכות; האטלס מעדיף את ההמלכות המפורשות.</p></article>
          <article><span>י״ב פשוטות</span><b>הסימן טש״ת סא״ב מע״ק גד״ד</b><p>הסימן נשמר ללא פענוח ואינו משמש לשינוי ההקבלות.</p></article>
        </div>
      </section>
    </div>
  );
}
