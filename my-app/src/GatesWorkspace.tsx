import { useMemo, useState } from "react";

const letters = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];
const finalLetters: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const sourceUnitIds = ["sy.0026", "sy.0027"];

type GateName = {
  id: string;
  normalized: string;
  forwardOccurrences: number;
  reverseOccurrences: number;
  totalOccurrences: number;
};

type Gate = {
  first: string;
  second: string;
  forward: string;
  reverse: string;
  forwardOccurrences: number;
  reverseOccurrences: number;
  totalOccurrences: number;
  names: GateName[];
};

function normalizedLetters(value: string) {
  return [...value]
    .filter((character) => /[א-ת]/.test(character))
    .map((character) => finalLetters[character] || character)
    .join("");
}

function pairCount(value: string, pair: string) {
  let count = 0;
  for (let index = 0; index < value.length - 1; index += 1) {
    if (value.slice(index, index + 2) === pair) count += 1;
  }
  return count;
}

function navigateToUnit(unit: any) {
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

function openName(normalized: string) {
  window.dispatchEvent(new CustomEvent("sy:select-name", { detail: { normalized } }));
}

export function GatesWorkspace({ corpus }: { corpus: any }) {
  const [selectedLetters, setSelectedLetters] = useState<[string, string]>(["א", "ב"]);
  const [observedOnly, setObservedOnly] = useState(false);

  const gates = useMemo<Gate[]>(() => {
    const normalizedNames = corpus.evidence.names.map((name: any) => ({
      ...name,
      letters: normalizedLetters(name.normalized),
    }));
    const output: Gate[] = [];
    for (let firstIndex = 0; firstIndex < letters.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < letters.length; secondIndex += 1) {
        const first = letters[firstIndex];
        const second = letters[secondIndex];
        const forward = `${first}${second}`;
        const reverse = `${second}${first}`;
        const names = normalizedNames.flatMap((name: any) => {
          const forwardCount = pairCount(name.letters, forward) * name.occurrence_count;
          const reverseCount = pairCount(name.letters, reverse) * name.occurrence_count;
          if (!forwardCount && !reverseCount) return [];
          return [{
            id: name.id,
            normalized: name.normalized,
            forwardOccurrences: forwardCount,
            reverseOccurrences: reverseCount,
            totalOccurrences: forwardCount + reverseCount,
          }];
        }).sort((left: GateName, right: GateName) => right.totalOccurrences - left.totalOccurrences || left.normalized.localeCompare(right.normalized, "he"));
        output.push({
          first,
          second,
          forward,
          reverse,
          forwardOccurrences: names.reduce((sum: number, name: GateName) => sum + name.forwardOccurrences, 0),
          reverseOccurrences: names.reduce((sum: number, name: GateName) => sum + name.reverseOccurrences, 0),
          totalOccurrences: names.reduce((sum: number, name: GateName) => sum + name.totalOccurrences, 0),
          names,
        });
      }
    }
    return output;
  }, [corpus]);

  const selectedGate = gates.find((gate) => gate.first === selectedLetters[0] && gate.second === selectedLetters[1]) || gates[0];
  const visibleGates = observedOnly ? gates.filter((gate) => gate.totalOccurrences > 0) : gates;
  const observedGateCount = gates.filter((gate) => gate.totalOccurrences > 0).length;
  const selectedPoints = selectedLetters.map((letter) => {
    const index = letters.indexOf(letter);
    const angle = index / letters.length * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(angle) * 42, y: 50 + Math.sin(angle) * 42 };
  });
  const sources = sourceUnitIds.map((id) => corpus.units.find((unit: any) => unit.id === id)).filter(Boolean);

  function chooseLetter(letter: string) {
    if (selectedLetters.includes(letter)) return;
    const next = [selectedLetters[1], letter].sort((left, right) => letters.indexOf(left) - letters.indexOf(right)) as [string, string];
    setSelectedLetters(next);
  }

  function chooseGate(gate: Gate) {
    setSelectedLetters([gate.first, gate.second]);
  }

  return (
    <div className="gates-workspace">
      <header className="gates-intro">
        <div>
          <small>פרק 2 · יחידות 6–7</small>
          <h3>חוקר רל״א השערים</h3>
          <p>כל שער הוא זוג בלתי־מסודר מתוך 22 אותיות; פני הגלגל ואחוריו מוצגים כשני סדרי הצירוף. ההתאמות לקורפוס הן עדות כתיב בלבד, לא פירוש.</p>
        </div>
        <div className="certainty-legend" aria-label="דרגות טענה">
          <span className="certainty certainty--explicit">231 והגלגל מפורשים</span>
          <span className="certainty certainty--derived">22×21÷2 נגזר</span>
          <span className="certainty certainty--interpretive">ללא משמעות מוספת</span>
        </div>
      </header>

      <section className="gates-summary" aria-label="סיכום השערים">
        <span><b>{gates.length}</b> שערים מחושבים</span>
        <span><b>{gates.length * 2}</b> סדרי צירוף</span>
        <span><b>{observedGateCount}</b> שערים שנצפו ברצף</span>
        <span><b>{gates.length - observedGateCount}</b> ללא רצף בקורפוס</span>
      </section>

      <section className="gates-explorer">
        <div className="gates-wheel" aria-label="גלגל עשרים ושתיים האותיות">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="42" />
            <line x1={selectedPoints[0].x} y1={selectedPoints[0].y} x2={selectedPoints[1].x} y2={selectedPoints[1].y} />
          </svg>
          {letters.map((letter, index) => {
            const angle = index / letters.length * Math.PI * 2 - Math.PI / 2;
            const left = 50 + Math.cos(angle) * 42;
            const top = 50 + Math.sin(angle) * 42;
            return (
              <button
                key={letter}
                className={selectedLetters.includes(letter) ? "is-selected" : ""}
                style={{ left: `${left}%`, top: `${top}%` }}
                aria-pressed={selectedLetters.includes(letter)}
                onClick={() => chooseLetter(letter)}
              >{letter}</button>
            );
          })}
          <div className="gates-wheel__center"><b>{selectedGate.forward}</b><span>↔</span><b>{selectedGate.reverse}</b></div>
        </div>

        <article className="gate-detail">
          <header>
            <div><small>שער נבחר</small><h3>{selectedGate.first} · {selectedGate.second}</h3></div>
            <span className={selectedGate.totalOccurrences ? "gate-observed" : "gate-unobserved"}>{selectedGate.totalOccurrences ? "נצפה בקורפוס" : "לא נצפה כרצף"}</span>
          </header>
          <div className="gate-directions">
            <span><b>{selectedGate.forward}</b><small>{selectedGate.forwardOccurrences} מופעים</small></span>
            <i>פנים ↔ אחור</i>
            <span><b>{selectedGate.reverse}</b><small>{selectedGate.reverseOccurrences} מופעים</small></span>
          </div>
          <div className="gate-evidence">
            <h4>שמות שבהם האותיות סמוכות</h4>
            {selectedGate.names.slice(0, 16).map((name) => (
              <button key={name.id} onClick={() => openName(name.normalized)}>
                <span>{name.normalized}</span><small>{name.totalOccurrences} מופעים</small>
              </button>
            ))}
            {!selectedGate.names.length && <p>לא נמצא בקורפוס שם שבו שתי האותיות סמוכות באחד משני הסדרים.</p>}
            {selectedGate.names.length > 16 && <p>מוצגים 16 מתוך {selectedGate.names.length} שמות.</p>}
          </div>
        </article>
      </section>

      <section className="gates-matrix">
        <header>
          <div><h3>כל השערים</h3><p>המספר בכל שער הוא מספר מופעי הרצף בשני הכיוונים יחד.</p></div>
          <label><input type="checkbox" checked={observedOnly} onChange={(event) => setObservedOnly(event.target.checked)} /> הצג רק שערים שנצפו</label>
        </header>
        <div className="gate-grid">
          {visibleGates.map((gate) => (
            <button key={`${gate.first}-${gate.second}`} className={gate === selectedGate ? "is-selected" : ""} onClick={() => chooseGate(gate)}>
              <b>{gate.first}{gate.second}</b><small>{gate.totalOccurrences}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="gates-method">
        <h3>גבולות המסקנה</h3>
        <div>
          <article><span className="certainty certainty--explicit">מפורש</span><b>רל״א שערים ופנים־אחור</b><p>הטקסט מציב את 22 האותיות בגלגל ומתאר חזרה בשני כיוונים.</p></article>
          <article><span className="certainty certainty--derived">נגזר מתמטי</span><b>231 = בחירת שניים מתוך 22</b><p>החישוב מסביר את המספר בלי לייחס לכל זוג משמעות שאינה כתובה.</p></article>
          <article><span className="certainty certainty--explicit">נצפה</span><b>עדות הקורפוס</b><p>המונה כולל רק אותיות סמוכות בתוך שמות מנורמלים; אותיות סופיות מאוחדות עם צורת היסוד.</p></article>
        </div>
      </section>

      <section className="gates-sources">
        <h3>קטעי המקור</h3>
        <div>{sources.map((unit: any) => <article key={unit.id}><header><b>{unit.chapter_label} · {unit.unit_label}</b><button onClick={() => navigateToUnit(unit)}>פתח בטקסט</button></header><p>{unit.source.text}</p><small>{unit.id}</small></article>)}</div>
      </section>
    </div>
  );
}
