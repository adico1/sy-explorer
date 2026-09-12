import { useEffect, useMemo, useState } from "react";
import {
  buildCreationRun,
  chapterRoles,
  creationSystemValidation,
  depths,
  letters,
  type Certainty,
} from "./creation-system";
import { pushExplorerURL, readExplorerURL } from "./url-state";

const certaintyLabels: Record<Certainty, string> = {
  explicit: "מפורש",
  derived: "נגזר",
  interpretive: "מודל מערכת",
  unresolved: "פתוח",
};

function validLetter(value: string | null, fallback: string) {
  return letters.some((item) => item.letter === value) ? value! : fallback;
}

function validDepth(value: string | null) {
  return depths.some((item) => item.id === value) ? value! : depths[0].id;
}

function validStage(value: string | null, maximum: number) {
  const stage = Number(value);
  return Number.isInteger(stage) && stage >= 0 && stage < maximum ? stage : 0;
}

function navigateToUnit(unit: any) {
  if (!unit) return;
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

export function CreationEngineWorkspace({ corpus }: { corpus: any }) {
  const initialURL = readExplorerURL();
  const [letterValue, setLetterValue] = useState(() => validLetter(initialURL.letter, "מ"));
  const [partnerValue, setPartnerValue] = useState(() => validLetter(initialURL.pair, "ש"));
  const [depthValue, setDepthValue] = useState(() => validDepth(initialURL.depth));
  const [stageIndex, setStageIndex] = useState(() => validStage(initialURL.step, 10));
  const units = useMemo(() => new Map(corpus.units.map((unit: any) => [unit.id, unit])), [corpus]);
  const run = buildCreationRun({ letter: letterValue, partner: partnerValue, depth: depthValue });
  const stage = run.trace[stageIndex];

  useEffect(() => {
    function restoreEngine() {
      const urlState = readExplorerURL();
      setLetterValue(validLetter(urlState.letter, "מ"));
      setPartnerValue(validLetter(urlState.pair, "ש"));
      setDepthValue(validDepth(urlState.depth));
      setStageIndex(validStage(urlState.step, 10));
    }
    window.addEventListener("popstate", restoreEngine);
    return () => window.removeEventListener("popstate", restoreEngine);
  }, []);

  function selectLetter(nextLetter: string) {
    const nextPartner = nextLetter === partnerValue ? letters.find((item) => item.letter !== nextLetter)!.letter : partnerValue;
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

  function selectDepth(nextDepth: string) {
    setDepthValue(nextDepth);
    setStageIndex(0);
    pushExplorerURL({ depth: nextDepth, step: "0" });
  }

  function moveToStage(nextStage: number) {
    setStageIndex(nextStage);
    pushExplorerURL({ step: String(nextStage) });
  }

  return (
    <div className="creation-engine-workspace">
      <header className="creation-engine-intro">
        <div>
          <small>ששת הפרקים · ליבת 10–22–3–7–12</small>
          <h3>מכונת ספר יצירה</h3>
          <p>הרצה אחת עוברת ממידה וקול, דרך אותיות והכרעה, אל תמורה, מחזור ובקרה בעולם–שנה–נפש.</p>
        </div>
        <div className="creation-system-health" data-valid={creationSystemValidation.valid}>
          <b>{creationSystemValidation.valid ? "המבנה תקין" : "נמצאה שגיאת מבנה"}</b>
          <span>10 עומקים · 22 אותיות · 3–7–12 · 3 בקרים</span>
        </div>
      </header>

      <section className="creation-chapters" aria-label="ששת פרקי המערכת">
        {chapterRoles.map((chapter) => (
          <button key={chapter.chapter} onClick={() => navigateToUnit(units.get(chapter.sourceId))}>
            <b>{chapter.chapter}</b><span>{chapter.title}</span><small>{chapter.role}</small>
          </button>
        ))}
      </section>

      <section className="creation-inputs creation-inputs--system">
        <div>
          <label htmlFor="creation-depth">עומק · פרק 1</label>
          <select id="creation-depth" value={depthValue} onChange={(event) => selectDepth(event.target.value)}>
            {depths.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="creation-letter">אות ראשית · פרק 2</label>
          <select id="creation-letter" value={letterValue} onChange={(event) => selectLetter(event.target.value)}>
            {letters.map((item) => <option key={item.letter} value={item.letter}>{item.letter} · {item.name} · {item.family}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="creation-partner">אות שנייה · שער</label>
          <select id="creation-partner" value={partnerValue} onChange={(event) => selectPartner(event.target.value)}>
            {letters.filter((item) => item.letter !== letterValue).map((item) => <option key={item.letter} value={item.letter}>{item.letter} · {item.name}</option>)}
          </select>
        </div>
        <article>
          <span>{run.letter.letter}</span>
          <div><b>{run.letter.name} · {run.letter.family}</b><small>{run.letter.articulation}</small></div>
        </article>
      </section>

      <section className="creation-system-state">
        <article><small>מידה · 10</small><b>{run.depth.label}</b><span>לעומת {run.oppositeDepth.label}</span></article>
        <article data-resolved={run.mediator.resolved}><small>מכריע · 3</small><b>{run.mediator.value}</b><span>{run.mediator.explanation}</span></article>
        <article><small>{run.activeLaw.title}</small><b>{run.activeLaw.value}</b><span>{run.activeLaw.family}</span></article>
        <article data-status={run.seal.status}><small>מצב חתימה</small><b>{run.seal.label}</b><span>{run.seal.explanation}</span></article>
      </section>

      <nav className="creation-pipeline creation-pipeline--system" aria-label="שלבי מכונת ספר יצירה">
        {run.trace.map((item, index) => (
          <button key={item.key} aria-current={stageIndex === index ? "step" : undefined} data-complete={index < stageIndex} onClick={() => moveToStage(index)}>
            <b>{item.chapter}</b><span>{item.verb}</span><small>{item.result}</small>
          </button>
        ))}
      </nav>

      <section className="creation-active-stage">
        <header>
          <div><small>שלב {stageIndex + 1} מתוך {run.trace.length} · פרק {stage.chapter}</small><h3>{stage.verb}</h3></div>
          <span className={`certainty certainty--${stage.certainty}`}>{certaintyLabels[stage.certainty]}</span>
        </header>
        <p>{stage.action}</p>
        <div className="creation-stage-result"><span>מצב לאחר הפעולה</span><strong>{stage.result}</strong></div>
        <footer>
          <button onClick={() => navigateToUnit(units.get(stage.sourceId))}>פתח את עדות השלב במקור</button>
          {stageIndex < run.trace.length - 1
            ? <button className="creation-next" onClick={() => moveToStage(stageIndex + 1)}>הפעל את השלב הבא</button>
            : <button className="creation-next" onClick={() => moveToStage(0)}>התחל מחזור חדש</button>}
        </footer>
      </section>

      <section className="creation-output" aria-live="polite">
        <header><h3>עולם–שנה–נפש תחת בקרה</h3><span className="certainty certainty--explicit">המלכות ובקרים מפורשים</span></header>
        <div>
          {run.controllers.map((controller) => {
            const value = controller.domain === "עולם" ? run.letter.world : controller.domain === "שנה" ? run.letter.year : run.letter.soul;
            return <article key={controller.domain}><small>{controller.domain} · {controller.controller}</small><strong>{value}</strong><span>{controller.image}</span></article>;
          })}
        </div>
        <footer>
          <p><b>{run.forward} / {run.reverse}</b> הם שער דו־כיווני. הוא נשמר ללא משמעות מומצאת; מצב ההכרעה שלו הוא <b>{run.seal.label}</b>.</p>
          <button onClick={() => navigateToUnit(units.get(run.letter.sourceId))}>פתח את מקור ההקרנה</button>
        </footer>
      </section>

      <section className="creation-ledger">
        <header><h3>יומן הרצה ניתן לשחזור</h3><small>מידה · פעולה · מקור · ודאות</small></header>
        <div>
          {run.trace.slice(0, stageIndex + 1).map((item) => (
            <article key={item.key}>
              <b>{item.chapter}</b>
              <span><strong>{item.verb}</strong><small>{item.sourceId}</small></span>
              <em className={`certainty certainty--${item.certainty}`}>{certaintyLabels[item.certainty]}</em>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
