import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";

type Heading = {
  id: string;
  label: string;
  element: HTMLHeadingElement;
  chapterId: string;
};

const letterPattern = /[א-ת\u0591-\u05C7״׳"']/;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0591-\u05C7]/g, "")
    .normalize("NFC")
    .replace(/[״׳"']/g, "")
    .replace(/[^א-ת0-9]+/g, " ")
    .trim();
}

function textRangeAtPoint(event: MouseEvent) {
  const rangedDocument = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const range = rangedDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;
  const text = range.startContainer.textContent || "";
  let start = Math.min(range.startOffset, Math.max(0, text.length - 1));
  let end = start;
  if (!letterPattern.test(text[start] || "") && letterPattern.test(text[start - 1] || "")) start -= 1;
  if (!letterPattern.test(text[start] || "")) return null;
  end = start + 1;
  while (start > 0 && letterPattern.test(text[start - 1])) start -= 1;
  while (end < text.length && letterPattern.test(text[end])) end += 1;
  range.setStart(range.startContainer, start);
  range.setEnd(range.startContainer, end);
  return range;
}

export function ReaderPane({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [chapters, setChapters] = useState<Heading[]>([]);
  const [verses, setVerses] = useState<Heading[]>([]);
  const [chapterId, setChapterId] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const chapterElements = [...root.querySelectorAll<HTMLHeadingElement>("h2")];
    const nextChapters = chapterElements.map((element, index) => {
      const id = `reader-chapter-${index + 1}`;
      element.id = id;
      return { id, label: element.textContent?.trim() || `פרק ${index + 1}`, element, chapterId: id };
    });
    const nextVerses = [...root.querySelectorAll<HTMLHeadingElement>("h3")].map((element, index) => {
      const section = element.closest("section");
      const chapter = nextChapters.find((item) => item.element.closest("section") === section);
      const id = `reader-verse-${index + 1}`;
      element.id = id;
      return { id, label: element.textContent?.trim() || `פסוק ${index + 1}`, element, chapterId: chapter?.id || "" };
    });
    setChapters(nextChapters);
    setVerses(nextVerses);
    setChapterId(nextChapters[0]?.id || "");
  }, []);

  useEffect(() => {
    function navigateToUnit(event: Event) {
      const detail = (event as CustomEvent<{ chapterLabel: string; unitLabel: string }>).detail;
      const chapter = chapters.find((item) => normalize(item.label) === normalize(detail.chapterLabel));
      const verse = verses.find((item) => item.chapterId === chapter?.id && normalize(item.label) === normalize(detail.unitLabel));
      const target = verse || chapter;
      if (!target) return;
      setChapterId(target.chapterId);
      target.element.scrollIntoView({ behavior: "smooth", block: "start" });
      target.element.classList.add("reader-target");
      window.setTimeout(() => target.element.classList.remove("reader-target"), 1800);
    }
    window.addEventListener("sy:navigate-unit", navigateToUnit);
    return () => window.removeEventListener("sy:navigate-unit", navigateToUnit);
  }, [chapters, verses]);

  const chapterVerses = useMemo(
    () => verses.filter((verse) => verse.chapterId === chapterId),
    [chapterId, verses],
  );

  function jump(id: string) {
    const target = [...chapters, ...verses].find((item) => item.id === id);
    target?.element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function selectWord(event: MouseEvent) {
    if ((event.target as HTMLElement).closest("button, select, option, a")) return;
    const range = textRangeAtPoint(event);
    if (!range) return;
    const surface = range.toString();
    const normalized = normalize(surface);
    if (!normalized) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    window.dispatchEvent(new CustomEvent("sy:select-name", { detail: { normalized } }));
  }

  return (
    <div className="reader-column" ref={rootRef} onClick={selectWord}>
      <nav className="reader-navigator" aria-label="ניווט בספר">
        <label>
          פרק
          <select value={chapterId} onChange={(event) => { setChapterId(event.target.value); jump(event.target.value); }}>
            {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}
          </select>
        </label>
        <label>
          פסוק
          <select defaultValue="" onChange={(event) => jump(event.target.value)}>
            <option value="" disabled>בחר פסוק</option>
            {chapterVerses.map((verse) => <option key={verse.id} value={verse.id}>{verse.label}</option>)}
          </select>
        </label>
        <span>לחיצה על מילה פותחת את כל מופעיה</span>
      </nav>
      {children}
    </div>
  );
}
