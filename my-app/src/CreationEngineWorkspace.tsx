import { useEffect, useMemo, useState } from "react";
import { pushExplorerURL, readExplorerURL } from "./url-state";

type Certainty = "explicit" | "derived" | "interpretive";

type LetterModel = {
  letter: string;
  name: string;
  family: "אמות" | "כפולות" | "פשוטות";
  articulation: string;
  world: string;
  year: string;
  soul: string;
  sourceId: string;
  projectionCertainty: Certainty;
};

const articulationGroups = [
  { letters: "אחהע", place: "סוף הלשון ובית הבליעה" },
  { letters: "בומף", place: "בין השפתיים ובראש הלשון" },
  { letters: "גיכק", place: "שליש הלשון מול החך" },
  { letters: "דטלנת", place: "ראש הלשון עם הקול" },
  { letters: "זסצרש", place: "בין השיניים כשהלשון פרושה" },
];

const projectionData: Array<Omit<LetterModel, "articulation">> = [
  { letter: "א", name: "אלף", family: "אמות", world: "אוויר", year: "רווה", soul: "גוויה", sourceId: "sy.0035", projectionCertainty: "explicit" },
  { letter: "מ", name: "מם", family: "אמות", world: "ארץ", year: "קור", soul: "בטן", sourceId: "sy.0035", projectionCertainty: "explicit" },
  { letter: "ש", name: "שין", family: "אמות", world: "שמים", year: "חום", soul: "ראש", sourceId: "sy.0035", projectionCertainty: "explicit" },
  { letter: "ב", name: "בית", family: "כפולות", world: "שבתי", year: "יום ראשון", soul: "עין ימין", sourceId: "sy.0040", projectionCertainty: "explicit" },
  { letter: "ג", name: "גימל", family: "כפולות", world: "צדק", year: "יום שני", soul: "עין שמאל", sourceId: "sy.0040", projectionCertainty: "explicit" },
  { letter: "ד", name: "דלת", family: "כפולות", world: "מאדים", year: "יום שלישי", soul: "אוזן ימין", sourceId: "sy.0040", projectionCertainty: "explicit" },
  { letter: "כ", name: "כף", family: "כפולות", world: "חמה", year: "יום רביעי", soul: "אוזן שמאל", sourceId: "sy.0040", projectionCertainty: "explicit" },
  { letter: "פ", name: "פה", family: "כפולות", world: "נוגה", year: "יום חמישי", soul: "נחיר ימין", sourceId: "sy.0040", projectionCertainty: "explicit" },
  { letter: "ר", name: "ריש", family: "כפולות", world: "כוכב", year: "יום שישי", soul: "נחיר שמאל", sourceId: "sy.0040", projectionCertainty: "explicit" },
  { letter: "ת", name: "תו", family: "כפולות", world: "לבנה", year: "יום שבת", soul: "פה", sourceId: "sy.0040", projectionCertainty: "explicit" },
  { letter: "ה", name: "הא", family: "פשוטות", world: "טלה", year: "ניסן", soul: "יד ימין", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ו", name: "וו", family: "פשוטות", world: "שור", year: "אייר", soul: "יד שמאל", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ז", name: "זין", family: "פשוטות", world: "תאומים", year: "סיוון", soul: "רגל ימין", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ח", name: "חית", family: "פשוטות", world: "סרטן", year: "תמוז", soul: "רגל שמאל", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ט", name: "טית", family: "פשוטות", world: "אריה", year: "אב", soul: "כוליא ימין", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "י", name: "יוד", family: "פשוטות", world: "בתולה", year: "אלול", soul: "כוליא שמאל", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ל", name: "למד", family: "פשוטות", world: "מאזניים", year: "תשרי", soul: "כבד", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "נ", name: "נון", family: "פשוטות", world: "עקרב", year: "מרחשוון", soul: "טחול", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ס", name: "סמך", family: "פשוטות", world: "קשת", year: "כסלו", soul: "מרה", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ע", name: "עין", family: "פשוטות", world: "גדי", year: "טבת", soul: "המסס", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "צ", name: "צדי", family: "פשוטות", world: "דלי", year: "שבט", soul: "קיבה", sourceId: "sy.0044", projectionCertainty: "explicit" },
  { letter: "ק", name: "קוף", family: "פשוטות", world: "דגים", year: "אדר", soul: "קורקבן", sourceId: "sy.0044", projectionCertainty: "explicit" },
];

const letters: LetterModel[] = projectionData.map((item) => ({
  ...item,
  articulation: articulationGroups.find((group) => group.letters.includes(item.letter))?.place || "לא הוגדר",
}));

const stages = [
  { key: "voice", verb: "רוח וקול", action: "העמד מצע קולי שעדיין אינו אות מסוימת", result: "אפשרות", sourceId: "sy.0010", certainty: "explicit" as const },
  { key: "engrave", verb: "חקק", action: "קבע את האות כיחידה נבדלת בתוך כ״ב האותיות", result: "יחידה", sourceId: "sy.0023", certainty: "explicit" as const },
  { key: "hew", verb: "חצב", action: "הבחן את מקום הפקת האות מתוך רצף הקול", result: "גבול", sourceId: "sy.0024", certainty: "derived" as const },
  { key: "weigh", verb: "שקל", action: "העמד את שתי האותיות זו ביחס לזו", result: "יחס", sourceId: "sy.0027", certainty: "explicit" as const },
  { key: "combine", verb: "צרף", action: "בנה צירוף קדמי משתי האותיות", result: "צירוף", sourceId: "sy.0027", certainty: "explicit" as const },
  { key: "exchange", verb: "המיר", action: "הפוך את סדר האותיות ובחן את ההבדל", result: "תמורה", sourceId: "sy.0027", certainty: "explicit" as const },
  { key: "form", verb: "צר", action: "הצג את הופעת האות בעולם, בשנה ובנפש", result: "מופע", sourceId: "sy.0023", certainty: "derived" as const },
  { key: "seal", verb: "חתם", action: "קבע תוצאה עם מקור ודרגת ודאות, בלי להפוך השערה לעובדה", result: "עדות", sourceId: "sy.0034", certainty: "interpretive" as const },
];

const certaintyLabels: Record<Certainty, string> = {
  explicit: "מפורש",
  derived: "נגזר",
  interpretive: "מודל מערכת",
};

function validLetter(value: string | null, fallback: string) {
  return letters.some((item) => item.letter === value) ? value! : fallback;
}

function validStage(value: string | null) {
  const stage = Number(value);
  return Number.isInteger(stage) && stage >= 0 && stage < stages.length ? stage : 0;
}

function navigateToUnit(unit: any) {
  if (!unit) return;
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function CreationEngineWorkspace({ corpus }: { corpus: any }) {
  const initialURL = readExplorerURL();
  const [letterValue, setLetterValue] = useState(() => validLetter(initialURL.letter, "א"));
  const [partnerValue, setPartnerValue] = useState(() => validLetter(initialURL.pair, "מ"));
  const [stageIndex, setStageIndex] = useState(() => validStage(initialURL.step));
  const units = useMemo(() => new Map(corpus.units.map((unit: any) => [unit.id, unit])), [corpus]);
  const letter = letters.find((item) => item.letter === letterValue)!;
  const partner = letters.find((item) => item.letter === partnerValue)!;
  const stage = stages[stageIndex];
  const stageUnit = units.get(stage.sourceId);
  const projectionUnit = units.get(letter.sourceId);
  const forward = `${letter.letter}${partner.letter}`;
  const reverse = `${partner.letter}${letter.letter}`;

  useEffect(() => {
    function restoreEngine() {
      const urlState = readExplorerURL();
      setLetterValue(validLetter(urlState.letter, "א"));
      setPartnerValue(validLetter(urlState.pair, "מ"));
      setStageIndex(validStage(urlState.step));
    }
    window.addEventListener("popstate", restoreEngine);
    return () => window.removeEventListener("popstate", restoreEngine);
  }, []);

  function selectLetter(nextLetter: string) {
    const nextPartner = nextLetter === partnerValue
      ? letters.find((item) => item.letter !== nextLetter)!.letter
      : partnerValue;
    setLetterValue(nextLetter);
    setPartnerValue(nextPartner);
    setStageIndex(0);
    pushExplorerURL({ letter: nextLetter, pair: nextPartner, step: "0" });
  }

  function selectPartner(nextPartner: string) {
    if (nextPartner === letterValue) return;
    setPartnerValue(nextPartner);
    setStageIndex(0);
    pushExplorerURL({ pair: nextPartner, step: "0" });
  }

  function moveToStage(nextStage: number) {
    setStageIndex(nextStage);
    pushExplorerURL({ step: String(nextStage) });
  }

  return (
    <div className="creation-engine-workspace">
      <header className="creation-engine-intro">
        <div>
          <small>ששת הפרקים · מנוע ניסויי עם עקבות מקור</small>
          <h3>מנוע היצירה</h3>
          <p>מסלול אחד מן האפשרות אל הצורה: רוח וקול → חקיקה → חציבה → שקילה → צירוף → המרה → יצירה → חתימה.</p>
        </div>
        <div className="certainty-legend" aria-label="דרגות ודאות">
          <span className="certainty certainty--explicit">מפורש בטקסט</span>
          <span className="certainty certainty--derived">נגזר מן הטקסט</span>
          <span className="certainty certainty--interpretive">פעולת מערכת</span>
        </div>
      </header>

      <section className="creation-question">
        <span>שאלת המערכת</span>
        <strong>כיצד אפשרות אחת נעשית צורה מובחנת בעולם, בשנה ובנפש?</strong>
      </section>

      <section className="creation-inputs">
        <div>
          <label htmlFor="creation-letter">אות ראשית</label>
          <select id="creation-letter" value={letterValue} onChange={(event) => selectLetter(event.target.value)}>
            {letters.map((item) => <option key={item.letter} value={item.letter}>{item.letter} · {item.name} · {item.family}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="creation-partner">אות לצירוף</label>
          <select id="creation-partner" value={partnerValue} onChange={(event) => selectPartner(event.target.value)}>
            {letters.filter((item) => item.letter !== letterValue).map((item) => <option key={item.letter} value={item.letter}>{item.letter} · {item.name}</option>)}
          </select>
        </div>
        <article>
          <span>{letter.letter}</span>
          <div><b>{letter.name} · {letter.family}</b><small>{letter.articulation}</small></div>
        </article>
      </section>

      <nav className="creation-pipeline" aria-label="שלבי מנוע היצירה">
        {stages.map((item, index) => (
          <button key={item.key} aria-current={stageIndex === index ? "step" : undefined} data-complete={index < stageIndex} onClick={() => moveToStage(index)}>
            <b>{index + 1}</b><span>{item.verb}</span><small>{item.result}</small>
          </button>
        ))}
      </nav>

      <section className="creation-active-stage">
        <header>
          <div><small>שלב {stageIndex + 1} מתוך {stages.length}</small><h3>{stage.verb}</h3></div>
          <span className={`certainty certainty--${stage.certainty}`}>{certaintyLabels[stage.certainty]}</span>
        </header>
        <p>{stage.action}</p>
        <div className="creation-stage-result">
          <span>תוצאת השלב</span>
          <strong>{stage.key === "voice" && "רוח וקול"}{stage.key === "engrave" && letter.letter}{stage.key === "hew" && letter.articulation}{stage.key === "weigh" && `${letter.letter} ↔ ${partner.letter}`}{stage.key === "combine" && forward}{stage.key === "exchange" && `${forward} ↔ ${reverse}`}{stage.key === "form" && `${letter.world} · ${letter.year} · ${letter.soul}`}{stage.key === "seal" && `${letter.letter} · ${forward}/${reverse} · מקור ${letter.sourceId}`}</strong>
        </div>
        <footer>
          <button onClick={() => navigateToUnit(stageUnit)}>פתח את עדות השלב במקור</button>
          {stageIndex < stages.length - 1
            ? <button className="creation-next" onClick={() => moveToStage(stageIndex + 1)}>הפעל את השלב הבא</button>
            : <button className="creation-next" onClick={() => moveToStage(0)}>התחל מחזור חדש</button>}
        </footer>
      </section>

      <section className="creation-output" aria-live="polite">
        <header><h3>שלוש הקרנות של אותה אות</h3><span className="certainty certainty--explicit">המלכה מפורשת</span></header>
        <div>
          <article><small>עולם</small><strong>{letter.world}</strong><span>מבנה ומרחב</span></article>
          <article><small>שנה</small><strong>{letter.year}</strong><span>זמן ומחזור</span></article>
          <article><small>נפש</small><strong>{letter.soul}</strong><span>אדם ופעולה</span></article>
        </div>
        <footer>
          <p><b>{forward} / {reverse}</b> הם צירופים שנוצרו במנוע. משמעותם נשארת פתוחה ואינה מוצגת כעובדת מקור.</p>
          <button onClick={() => navigateToUnit(projectionUnit)}>פתח את מקור ההקבלה</button>
        </footer>
      </section>

      <section className="creation-ledger">
        <header><h3>יומן העדות</h3><small>המערכת אינה מסתירה את המעבר מטקסט למודל</small></header>
        <div>
          {stages.slice(0, stageIndex + 1).map((item, index) => (
            <article key={item.key}>
              <b>{index + 1}</b>
              <span><strong>{item.verb}</strong><small>{item.sourceId}</small></span>
              <em className={`certainty certainty--${item.certainty}`}>{certaintyLabels[item.certainty]}</em>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
