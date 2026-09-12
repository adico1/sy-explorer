import { useMemo, useState } from "react";

type Sefirah = {
  number: number;
  label: string;
  detail: string;
  group: "origins" | "directions";
  sourceUnitId: string;
};

const sefirot: Sefirah[] = [
  { number: 1, label: "רוּחַ אֱלֹהִים חַיִּים", detail: "קול, רוח ודיבור; רוח הקודש", group: "origins", sourceUnitId: "sy.0010" },
  { number: 2, label: "רוּחַ מֵרוּחַ", detail: "בה נחקקו ונחצבו עשרים ושתיים אותיות היסוד", group: "origins", sourceUnitId: "sy.0011" },
  { number: 3, label: "מַיִם מֵרוּחַ", detail: "תהו ובהו, רפש וטיט", group: "origins", sourceUnitId: "sy.0012" },
  { number: 4, label: "אֵשׁ מִמַּיִם", detail: "כיסא הכבוד, שרפים, אופנים וחיות הקודש", group: "origins", sourceUnitId: "sy.0013" },
  { number: 5, label: "רוּם", detail: "חתם רום ופנה למעלה · יה״ו", group: "directions", sourceUnitId: "sy.0014" },
  { number: 6, label: "תַּחַת", detail: "חתם תחת ופנה למטה · יו״ה", group: "directions", sourceUnitId: "sy.0015" },
  { number: 7, label: "מִזְרָח", detail: "חתם מזרח ופנה לפניו · הי״ו", group: "directions", sourceUnitId: "sy.0016" },
  { number: 8, label: "מַעֲרָב", detail: "חתם מערב ופנה לאחריו · הו״י", group: "directions", sourceUnitId: "sy.0017" },
  { number: 9, label: "דָּרוֹם", detail: "חתם דרום ופנה לימינו · וי״ה", group: "directions", sourceUnitId: "sy.0018" },
  { number: 10, label: "צָפוֹן", detail: "חתם צפון ופנה לשמאלו · וה״י", group: "directions", sourceUnitId: "sy.0019" },
];

const depthPairs = [
  ["ראשית", "אחרית"], ["טוב", "רע"], ["רום", "תחת"], ["מזרח", "מערב"], ["צפון", "דרום"],
];

const structuralClaims = [
  { title: "חמש כנגד חמש", text: "עשר כאצבעות, וברית יחיד מכוונת באמצע.", sourceUnitId: "sy.0003" },
  { title: "עשר בדיוק", text: "עשר ולא תשע; עשר ולא אחת עשרה.", sourceUnitId: "sy.0004" },
  { title: "עשרה עומקים", text: "חמישה זוגות של עומקים שאין להם סוף.", sourceUnitId: "sy.0005" },
  { title: "רצוא ושוב", text: "צפייתן כברק, תכליתן בלי קץ ותנועתן רצוא ושוב.", sourceUnitId: "sy.0006" },
  { title: "סוף ותחילה", text: "נעוץ סופן בתחילתן ותחילתן בסופן, כשלהבת בגחלת.", sourceUnitId: "sy.0007" },
  { title: "גבול הדיבור", text: "בלום את הפה והלב; אם רץ הלב—שוב למקום.", sourceUnitId: "sy.0008" },
];

const formUnitIds = ["sy.0002", "sy.0003", "sy.0004", "sy.0005", "sy.0006", "sy.0007", "sy.0008", "sy.0009", "sy.0020"];

function navigateToUnit(unit: any) {
  if (!unit) return;
  window.dispatchEvent(new CustomEvent("sy:navigate-unit", {
    detail: { chapterLabel: unit.chapter_label, unitLabel: unit.unit_label },
  }));
}

function unpoint(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ");
}

export function TenSefirotWorkspace({ corpus, onOpenPaths }: { corpus: any; onOpenPaths: () => void }) {
  const [selectedNumber, setSelectedNumber] = useState(1);
  const selected = sefirot.find((sefirah) => sefirah.number === selectedNumber) || sefirot[0];
  const units = useMemo(() => new Map(corpus.units.map((unit: any) => [unit.id, unit])), [corpus]);
  const formUnits = formUnitIds.map((id) => units.get(id)).filter(Boolean) as any[];
  const spacedForm = formUnits.filter((unit) => unpoint(unit.source.text).includes("בלי מה"));
  const joinedForm = formUnits.filter((unit) => unpoint(unit.source.text).includes("בלימה"));
  const selectedUnit = units.get(selected.sourceUnitId) as any;

  return (
    <div className="sefirot-workspace">
      <header className="sefirot-intro">
        <div>
          <small>פרק 1 · sy.0002–sy.0020</small>
          <h3>חוקר עשר הספירות בלי־מה</h3>
          <p>קריאה צמודת־מקור של המניין, העומקים, התנועה והחתימות. השמות המאוחרים של אילן הספירות אינם מיובאים אל הטקסט.</p>
        </div>
        <button onClick={onOpenPaths}>חזור למפת ל״ב הנתיבות</button>
      </header>

      <section className="sefirot-architecture" aria-label="מבנה עשר הספירות">
        <article><strong>4</strong><b>ראשית ההתהוות</b><span>רוח → רוח → מים → אש</span></article>
        <i>+</i>
        <article><strong>6</strong><b>קצוות חתומים</b><span>רום, תחת וארבע רוחות</span></article>
        <i>=</i>
        <article className="sefirot-architecture__total"><strong>10</strong><b>ספירות בלימה</b><span className="certainty certainty--derived">4 + 6 הוא סיכום נגזר</span></article>
      </section>

      <section className="sefirot-sequence">
        <header><h3>הרצף המפורש</h3><span className="certainty certainty--explicit">מספור ומלל במקור</span></header>
        <div className="sefirot-sequence__grid">
          {sefirot.map((sefirah) => (
            <button key={sefirah.number} data-group={sefirah.group} className={selected.number === sefirah.number ? "is-selected" : ""} onClick={() => setSelectedNumber(sefirah.number)}>
              <strong>{sefirah.number}</strong><span>{sefirah.label}</span><small>{sefirah.group === "origins" ? "התהוות" : "חתימת קצה"}</small>
            </button>
          ))}
        </div>
        <article className="sefirot-detail">
          <header><span>ספירה {selected.number} · {selected.group === "origins" ? "ראשית ההתהוות" : "ששת הקצוות"}</span><small>{selected.sourceUnitId}</small></header>
          <h4>{selected.label}</h4><p>{selected.detail}</p>
          <button disabled={!selectedUnit} onClick={() => navigateToUnit(selectedUnit)}>פתח את היחידה בטקסט</button>
          {selectedUnit && <blockquote>{selectedUnit.source.text}</blockquote>}
        </article>
      </section>

      <section className="sefirot-depths">
        <header><h3>עשרת העומקים</h3><small>עדשה נפרדת · sy.0005</small></header>
        <p>היחידה מונה חמישה זוגות. המפה אינה מניחה התאמה חד־חד־ערכית ביניהם לבין הרצף הממוספר.</p>
        <div>{depthPairs.map(([first, second]) => <article key={first}><span>עֹמֶק {first}</span><i>↔</i><span>עֹמֶק {second}</span></article>)}</div>
        <button onClick={() => navigateToUnit(units.get("sy.0005"))}>פתח את יחידת העומקים</button>
      </section>

      <section className="sefirot-claims">
        <h3>שש עדשות מבניות</h3>
        <div>{structuralClaims.map((claim) => (
          <article key={claim.sourceUnitId}>
            <header><span className="certainty certainty--explicit">מפורש</span><small>{claim.sourceUnitId}</small></header>
            <b>{claim.title}</b><p>{claim.text}</p>
            <button onClick={() => navigateToUnit(units.get(claim.sourceUnitId))}>פתח במקור</button>
          </article>
        ))}</div>
      </section>

      <section className="sefirot-forms">
        <header><h3>בלי מה / בלימה</h3><span className="certainty certainty--interpretive">הבדל נוסח; משמעות לא מוכרעת</span></header>
        <p>שתי צורות הכתיב מוצגות כפי שהן ביחידות העבודה. הספירה כאן תיעודית בלבד ואינה מכריעה אם הן זהות במשמעותן.</p>
        <div>
          <article><strong>{spacedForm.length}</strong><b>בְּלִי מָה</b><span>{spacedForm.map((unit) => unit.id).join(" · ")}</span></article>
          <article><strong>{joinedForm.length}</strong><b>בְּלִימָה</b><span>{joinedForm.map((unit) => unit.id).join(" · ")}</span></article>
        </div>
      </section>

      <section className="sefirot-boundaries">
        <h3>גבולות הקריאה</h3>
        <div>
          <article><span className="certainty certainty--explicit">מפורש</span><b>המספר והרצף</b><p>עשר, לא תשע ולא אחת עשרה; היחידות אחת עד עשר מופיעות ברצף.</p></article>
          <article><span className="certainty certainty--derived">נגזר</span><b>ארבע ועוד שש</b><p>חלוקת הרצף לארבע התהוויות ושש חתימות מסכמת את מבנה היחידות, אך אינה נוסחה מצוטטת.</p></article>
          <article><span className="certainty certainty--interpretive">פתוח</span><b>אין שמות מאוחרים</b><p>הנוסח אינו משתמש בכתר, חכמה, בינה ושאר שמות האילן; החוקר אינו משייך אותם.</p></article>
        </div>
      </section>
    </div>
  );
}
