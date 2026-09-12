export type Certainty = "explicit" | "derived" | "interpretive" | "unresolved";
export type LetterFamily = "אמות" | "כפולות" | "פשוטות";

export type Depth = { id: string; label: string; oppositeId: string };
export type LetterModel = {
  letter: string;
  name: string;
  family: LetterFamily;
  articulation: string;
  world: string;
  year: string;
  soul: string;
  sourceId: string;
  principle?: string;
  transformation?: string;
  faculty?: string;
  boundary?: string;
};
export type CreationTrace = {
  key: string;
  verb: string;
  chapter: number;
  action: string;
  result: string;
  sourceId: string;
  certainty: Certainty;
  claim: string;
  evidenceNote: string;
  limitation?: string;
};

export const depths: Depth[] = [
  { id: "beginning", label: "עומק ראשית", oppositeId: "end" },
  { id: "end", label: "עומק אחרית", oppositeId: "beginning" },
  { id: "good", label: "עומק טוב", oppositeId: "evil" },
  { id: "evil", label: "עומק רע", oppositeId: "good" },
  { id: "above", label: "עומק רום", oppositeId: "below" },
  { id: "below", label: "עומק תחת", oppositeId: "above" },
  { id: "east", label: "עומק מזרח", oppositeId: "west" },
  { id: "west", label: "עומק מערב", oppositeId: "east" },
  { id: "north", label: "עומק צפון", oppositeId: "south" },
  { id: "south", label: "עומק דרום", oppositeId: "north" },
];

const articulationGroups = [
  { letters: "אחהע", place: "סוף הלשון ובית הבליעה" },
  { letters: "בומף", place: "בין השפתיים ובראש הלשון" },
  { letters: "גיכק", place: "שליש הלשון מול החך" },
  { letters: "דטלנת", place: "ראש הלשון עם הקול" },
  { letters: "זסצרש", place: "בין השיניים כשהלשון פרושה" },
];

const rawLetters: Array<Omit<LetterModel, "articulation">> = [
  { letter: "א", name: "אלף", family: "אמות", principle: "רוח · מכריע", world: "אוויר", year: "רווה", soul: "גוויה", sourceId: "sy.0035" },
  { letter: "מ", name: "מם", family: "אמות", principle: "מים · קוטב", world: "ארץ", year: "קור", soul: "בטן", sourceId: "sy.0035" },
  { letter: "ש", name: "שין", family: "אמות", principle: "אש · קוטב", world: "שמים", year: "חום", soul: "ראש", sourceId: "sy.0035" },
  { letter: "ב", name: "בית", family: "כפולות", transformation: "חיים ↔ מוות", world: "שבתי", year: "יום ראשון", soul: "עין ימין", sourceId: "sy.0040" },
  { letter: "ג", name: "גימל", family: "כפולות", transformation: "שלום ↔ רע", world: "צדק", year: "יום שני", soul: "עין שמאל", sourceId: "sy.0040" },
  { letter: "ד", name: "דלת", family: "כפולות", transformation: "חכמה ↔ איוולת", world: "מאדים", year: "יום שלישי", soul: "אוזן ימין", sourceId: "sy.0040" },
  { letter: "כ", name: "כף", family: "כפולות", transformation: "עושר ↔ עוני", world: "חמה", year: "יום רביעי", soul: "אוזן שמאל", sourceId: "sy.0040" },
  { letter: "פ", name: "פה", family: "כפולות", transformation: "חן ↔ כיעור", world: "נוגה", year: "יום חמישי", soul: "נחיר ימין", sourceId: "sy.0040" },
  { letter: "ר", name: "ריש", family: "כפולות", transformation: "זרע ↔ שממה", world: "כוכב", year: "יום שישי", soul: "נחיר שמאל", sourceId: "sy.0040" },
  { letter: "ת", name: "תו", family: "כפולות", transformation: "ממשלה ↔ עבדות", world: "לבנה", year: "יום שבת", soul: "פה", sourceId: "sy.0040" },
  { letter: "ה", name: "הא", family: "פשוטות", faculty: "ראייה", boundary: "מזרחית־צפונית", world: "טלה", year: "ניסן", soul: "יד ימין", sourceId: "sy.0044" },
  { letter: "ו", name: "וו", family: "פשוטות", faculty: "שמיעה", boundary: "מזרחית־דרומית", world: "שור", year: "אייר", soul: "יד שמאל", sourceId: "sy.0044" },
  { letter: "ז", name: "זין", family: "פשוטות", faculty: "ריח", boundary: "מזרחית־רומית", world: "תאומים", year: "סיוון", soul: "רגל ימין", sourceId: "sy.0044" },
  { letter: "ח", name: "חית", family: "פשוטות", faculty: "שיחה", boundary: "מזרחית־תחתית", world: "סרטן", year: "תמוז", soul: "רגל שמאל", sourceId: "sy.0044" },
  { letter: "ט", name: "טית", family: "פשוטות", faculty: "לעיטה", boundary: "צפונית־רומית", world: "אריה", year: "אב", soul: "כוליא ימין", sourceId: "sy.0044" },
  { letter: "י", name: "יוד", family: "פשוטות", faculty: "תשמיש", boundary: "צפונית־תחתית", world: "בתולה", year: "אלול", soul: "כוליא שמאל", sourceId: "sy.0044" },
  { letter: "ל", name: "למד", family: "פשוטות", faculty: "מעשה", boundary: "מערבית־דרומית", world: "מאזניים", year: "תשרי", soul: "כבד", sourceId: "sy.0044" },
  { letter: "נ", name: "נון", family: "פשוטות", faculty: "הלוך", boundary: "מערבית־צפונית", world: "עקרב", year: "מרחשוון", soul: "טחול", sourceId: "sy.0044" },
  { letter: "ס", name: "סמך", family: "פשוטות", faculty: "רוגז", boundary: "מערבית־רומית", world: "קשת", year: "כסלו", soul: "מרה", sourceId: "sy.0044" },
  { letter: "ע", name: "עין", family: "פשוטות", faculty: "שחוק", boundary: "מערבית־תחתית", world: "גדי", year: "טבת", soul: "המסס", sourceId: "sy.0044" },
  { letter: "צ", name: "צדי", family: "פשוטות", faculty: "הרהור", boundary: "דרומית־רומית", world: "דלי", year: "שבט", soul: "קיבה", sourceId: "sy.0044" },
  { letter: "ק", name: "קוף", family: "פשוטות", faculty: "שינה", boundary: "דרומית־תחתית", world: "דגים", year: "אדר", soul: "קורקבן", sourceId: "sy.0044" },
];

export const letters: LetterModel[] = rawLetters.map((item) => ({
  ...item,
  articulation: articulationGroups.find((group) => group.letters.includes(item.letter))?.place || "לא הוגדר",
}));

export const controllers = [
  { domain: "עולם", controller: "תלי", image: "כמלך על כיסאו", sourceId: "sy.0048" },
  { domain: "שנה", controller: "גלגל", image: "כמלך במדינה", sourceId: "sy.0048" },
  { domain: "נפש", controller: "לב", image: "כמלך במלחמה", sourceId: "sy.0048" },
] as const;

export const chapterRoles = [
  { chapter: 1, title: "מידה", role: "בחירת עומק וקוטב נגדי", sourceId: "sy.0005" },
  { chapter: 2, title: "פעולה", role: "הפעלת אותיות וצירופים", sourceId: "sy.0023" },
  { chapter: 3, title: "הכרעה", role: "שני קטבים ומכריע ביניהם", sourceId: "sy.0029" },
  { chapter: 4, title: "תמורה", role: "שבעה מעברי מצב", sourceId: "sy.0036" },
  { chapter: 5, title: "מחזור", role: "שנים־עשר כיוונים ופעולות", sourceId: "sy.0042" },
  { chapter: 6, title: "בקרה", role: "תלי, גלגל ולב ואימות האדם", sourceId: "sy.0047" },
];

function getLetter(value: string, fallback: string) {
  return letters.find((item) => item.letter === value) || letters.find((item) => item.letter === fallback)!;
}

function getDepth(value: string) {
  return depths.find((item) => item.id === value) || depths[0];
}

function resolveMediator(letter: LetterModel, partner: LetterModel) {
  const pair = new Set([letter.letter, partner.letter]);
  if (pair.has("מ") && pair.has("ש")) {
    return { value: "א · רוח", explanation: "אש ומים הם הקטבים; א׳ ורוח מכריעות ביניהם במפורש.", resolved: true, sourceId: "sy.0029" };
  }
  return { value: "טרם הוכרע", explanation: "הספר מחייב מבנה של הכרעה, אך אינו מגדיר מכריע מפורש לצמד הזה.", resolved: false, sourceId: "sy.0022" };
}

function activeLaw(letter: LetterModel) {
  if (letter.family === "אמות") return { title: "חוק השלושה", value: letter.principle!, family: letter.family, sourceId: "sy.0032" };
  if (letter.family === "כפולות") return { title: "חוק השבעה", value: letter.transformation!, family: letter.family, sourceId: "sy.0036" };
  return { title: "חוק השנים־עשר", value: `${letter.faculty} · גבול ${letter.boundary}`, family: letter.family, sourceId: "sy.0042" };
}

export function buildCreationRun(input: { letter: string; partner: string; depth: string }) {
  const letter = getLetter(input.letter, "מ");
  const partner = getLetter(input.partner === letter.letter ? "ש" : input.partner, "ש");
  const depth = getDepth(input.depth);
  const oppositeDepth = getDepth(depth.oppositeId);
  const mediator = resolveMediator(letter, partner);
  const forward = `${letter.letter}${partner.letter}`;
  const reverse = `${partner.letter}${letter.letter}`;
  const law = activeLaw(letter);
  const seal = mediator.resolved
    ? { status: "supported" as const, label: "מוכן לחתימה", explanation: "הצמד כולל קטבים ומכריע המוגדרים במפורש במקור.", sourceId: "sy.0049" }
    : { status: "open" as const, label: "נחתם כמקרה פתוח", explanation: "הצירוף נשמר, אך משמעותו אינה מוכרעת ללא יחס מתווך מבוסס.", sourceId: "sy.0049" };
  const trace: CreationTrace[] = [
    { key: "measure", verb: "מדד", chapter: 1, action: "מקם את ההרצה בתוך זוג עומקים", result: `${depth.label} ↔ ${oppositeDepth.label}`, sourceId: "sy.0005", certainty: "explicit", claim: "עשרת העומקים מסודרים בחמישה זוגות ניגודיים.", evidenceNote: "היחידה מונה במפורש את עשרת העומקים כראשית–אחרית, טוב–רע, רום–תחת וארבעת הכיוונים." },
    { key: "voice", verb: "רוח וקול", chapter: 1, action: "העמד מצע קולי שעדיין אינו אות מסוימת", result: "אפשרות קולית", sourceId: "sy.0010", certainty: "explicit", claim: "קול, רוח ודיבור קודמים לעיצוב האות המסוימת.", evidenceNote: "המקור מצמיד במפורש רוח, קול ודיבור; סדר הפעולה במנוע הוא קריאה מערכתית של הרשימה.", limitation: "המקור אינו משתמש במונח „אפשרות קולית”; זהו שם תפעולי בממשק." },
    { key: "engrave", verb: "חקק", chapter: 2, action: "קבע את האות כיחידה נבדלת", result: `${letter.letter} · ${letter.name}`, sourceId: "sy.0023", certainty: "explicit", claim: "חקיקה היא אחת הפעולות המופעלות על עשרים ושתיים האותיות.", evidenceNote: "היחידה מונה במפורש את חקק, חצב, שקל, המיר, צרף וצר ביחס לעשרים ושתיים האותיות." },
    { key: "hew", verb: "חצב", chapter: 2, action: "הבחן את מקום הפקת האות", result: letter.articulation, sourceId: "sy.0024", certainty: "derived", claim: "האות שייכת לאחד מחמשת מקומות ההפקה בפה.", evidenceNote: "המקור מונה חמש קבוצות אותיות הקבועות בפה; שיוך מקום ההפקה לשלב „חצב” הוא היסק של המודל.", limitation: "הטקסט מחבר את חמשת המקומות לאותיות, אך אינו מגדיר אותם כתוצאת החציבה לבדה." },
    { key: "weigh", verb: "שקל", chapter: 3, action: "העמד את שתי האותיות ואת המכריע ביניהן", result: `${letter.letter} ← ${mediator.value} → ${partner.letter}`, sourceId: mediator.sourceId, certainty: mediator.resolved ? "explicit" : "unresolved", claim: mediator.resolved ? "אוויר/רוח מכריע בין אש למים." : "לצמד הנבחר נדרש יחס מכריע שאינו מפורש בקורפוס.", evidenceNote: mediator.explanation, limitation: mediator.resolved ? undefined : "המנוע אינו ממציא מכריע כאשר היחס אינו נאמר במפורש." },
    { key: "combine", verb: "צרף", chapter: 2, action: "בנה שער בשני כיוונים", result: `${forward} ↔ ${reverse}`, sourceId: "sy.0027", certainty: "explicit", claim: "כל אות מצטרפת עם כולן בשני סדרים.", evidenceNote: "המקור אומר אלף עם כולן וכולן עם אלף, בית עם כולן וכולן עם בית, וחוזר חלילה." },
    { key: "transform", verb: "המיר", chapter: letter.family === "כפולות" ? 4 : 5, action: `הפעל את ${law.title}`, result: law.value, sourceId: law.sourceId, certainty: letter.family === "אמות" ? "explicit" : "derived", claim: `האות פועלת בתוך ${law.title}.`, evidenceNote: `המקור מגדיר את משפחת ${letter.family} ואת מערך היחסים שלה; הפעלתו כשלב בהרצה היא היסק תפעולי.` },
    { key: "form", verb: "צר", chapter: letter.family === "פשוטות" ? 5 : letter.family === "כפולות" ? 4 : 3, action: "הקרן את אותה אות בשלושת המישורים", result: `${letter.world} · ${letter.year} · ${letter.soul}`, sourceId: letter.sourceId, certainty: "explicit", claim: `האות ${letter.letter} ממופה במקביל לעולם, לשנה ולנפש.`, evidenceNote: "שלוש ההקרנות מופיעות יחד ביחידת המקור של משפחת האות." },
    { key: "govern", verb: "נהג", chapter: 6, action: "העבר את התוצאה דרך בקרי עולם–שנה–נפש", result: "תלי · גלגל · לב", sourceId: "sy.0048", certainty: "explicit", claim: "תלי, גלגל ולב הם בקרי עולם, שנה ונפש.", evidenceNote: "המקור מציב במפורש תלי בעולם, גלגל בשנה ולב בנפש, כל אחד בדימוי מלכות משלו." },
    { key: "seal", verb: "חתם", chapter: 6, action: "שמור את התוצאה עם מקורות ומצב הכרעה", result: seal.label, sourceId: "sy.0049", certainty: mediator.resolved ? "interpretive" : "unresolved", claim: "תוצאה נשמרת רק לאחר צפייה, חקירה, הבנה והפעלה.", evidenceNote: "פרק 6 מתאר את אברהם צופה, חוקר, מבין, חקק, חצב, צירף וצר עד שעלתה בידו.", limitation: "„חתימת הרצה” היא מנגנון ביקורת של הממשק, לא פעולה המתוארת כך ביחידת המקור." },
  ];
  return { depth, oppositeDepth, letter, partner, forward, reverse, mediator, activeLaw: law, controllers, trace, seal };
}

export function validateCreationSystem() {
  const errors: string[] = [];
  const counts = {
    letters: letters.length,
    mothers: letters.filter((item) => item.family === "אמות").length,
    doubles: letters.filter((item) => item.family === "כפולות").length,
    simples: letters.filter((item) => item.family === "פשוטות").length,
    depths: depths.length,
    controllers: controllers.length,
  };
  if (new Set(letters.map((item) => item.letter)).size !== 22) errors.push("האותיות אינן ייחודיות");
  if (counts.letters !== 22) errors.push("נדרשות 22 אותיות");
  if (counts.mothers !== 3 || counts.doubles !== 7 || counts.simples !== 12) errors.push("חלוקת 3–7–12 אינה תקינה");
  if (counts.depths !== 10) errors.push("נדרשים עשרה עומקים");
  if (depths.some((depth) => !depths.some((candidate) => candidate.id === depth.oppositeId))) errors.push("עומק ללא קוטב נגדי");
  if (counts.controllers !== 3) errors.push("נדרשים שלושה בקרי עולם–שנה–נפש");
  if (letters.some((item) => !item.world || !item.year || !item.soul || !item.sourceId)) errors.push("אות ללא הקרנה או מקור");
  return { valid: errors.length === 0, errors, counts };
}

export const creationSystemValidation = validateCreationSystem();
