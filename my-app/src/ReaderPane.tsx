import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { pushExplorerURL, readExplorerURL } from "./url-state";

type Heading = {
  id: string;
  label: string;
  element: HTMLElement;
  chapterId: string;
};

type ReadingUnit = Heading & {
  marker: HTMLSpanElement;
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
  const [units, setUnits] = useState<ReadingUnit[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [unitId, setUnitId] = useState("");

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const chapterElements = [...root.querySelectorAll<HTMLHeadingElement>("h2")];
    const nextChapters = chapterElements.map((element, index) => {
      const id = `reader-chapter-${index + 1}`;
      element.id = id;
      return { id, label: element.textContent?.trim() || `פרק ${index + 1}`, element, chapterId: id };
    });
    const nextUnits = nextChapters.flatMap((chapter) => {
      const section = chapter.element.closest("section");
      if (!section) return [];
      const chapterNodes = [...section.childNodes];
      const chapterHeadingIndex = chapterNodes.indexOf(chapter.element);
      const found: ReadingUnit[] = [];
      let breakCount = 2;
      chapterNodes.slice(chapterHeadingIndex + 1).forEach((node) => {
        if (node instanceof HTMLBRElement) {
          breakCount += 1;
          return;
        }
        if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) return;
        if (breakCount >= 2) {
          const number = found.length + 1;
          const id = `${chapter.id}-unit-${number}`;
          const marker = document.createElement("span");
          marker.id = id;
          marker.className = "reader-unit-anchor";
          node.parentNode?.insertBefore(marker, node);
          found.push({
            id,
            label: node instanceof HTMLHeadingElement && node.tagName === "H3" ? node.textContent?.trim() || `יחידה ${number}` : `יחידה ${number}`,
            element: marker,
            marker,
            chapterId: chapter.id,
          });
        }
        breakCount = 0;
      });
      return found;
    });
    const urlState = readExplorerURL();
    const urlChapter = nextChapters.find((item) => item.id === urlState.chapter);
    const activeChapter = urlChapter || nextChapters[0];
    const urlUnit = nextUnits.find((item) => item.id === urlState.unit && item.chapterId === activeChapter?.id);
    setChapters(nextChapters);
    setUnits(nextUnits);
    setChapterId(activeChapter?.id || "");
    setUnitId(urlUnit?.id || "");
    (urlUnit || urlChapter)?.element.scrollIntoView({ block: "start" });
    return () => nextUnits.forEach((unit) => unit.marker.remove());
  }, []);

  useEffect(() => {
    function navigateToUnit(event: Event) {
      const detail = (event as CustomEvent<{ chapterLabel: string; unitLabel: string }>).detail;
      const chapter = chapters.find((item) => normalize(item.label) === normalize(detail.chapterLabel));
      const unit = units.find((item) => item.chapterId === chapter?.id && normalize(item.label) === normalize(detail.unitLabel));
      const target = unit || chapter;
      if (!target) return;
      setChapterId(target.chapterId);
      setUnitId(unit?.id || "");
      pushExplorerURL({ chapter: target.chapterId, unit: unit?.id || null, source: "visible" });
      target.element.scrollIntoView({ behavior: "smooth", block: "start" });
      target.element.classList.add("reader-target");
      window.setTimeout(() => target.element.classList.remove("reader-target"), 1800);
    }
    window.addEventListener("sy:navigate-unit", navigateToUnit);
    return () => window.removeEventListener("sy:navigate-unit", navigateToUnit);
  }, [chapters, units]);

  useEffect(() => {
    function restoreReaderLocation() {
      const urlState = readExplorerURL();
      const chapter = chapters.find((item) => item.id === urlState.chapter) || chapters[0];
      const unit = units.find((item) => item.id === urlState.unit && item.chapterId === chapter?.id);
      const target = unit || chapter;
      if (!target) return;
      setChapterId(target.chapterId);
      setUnitId(unit?.id || "");
      target.element.scrollIntoView({ block: "start" });
    }
    window.addEventListener("popstate", restoreReaderLocation);
    return () => window.removeEventListener("popstate", restoreReaderLocation);
  }, [chapters, units]);

  const chapterUnits = useMemo(
    () => units.filter((unit) => unit.chapterId === chapterId),
    [chapterId, units],
  );

  function jump(id: string) {
    const target = [...chapters, ...units].find((item) => item.id === id);
    if (!target) return;
    const isUnit = units.some((unit) => unit.id === target.id);
    setChapterId(target.chapterId);
    setUnitId(isUnit ? target.id : "");
    pushExplorerURL({ chapter: target.chapterId, unit: isUnit ? target.id : null });
    target.element.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <select value={chapterId} onChange={(event) => jump(event.target.value)}>
            {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}
          </select>
        </label>
        <label>
          יחידה
          <select value={unitId} onChange={(event) => jump(event.target.value)}>
            <option value="" disabled>בחר יחידה</option>
            {chapterUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
          </select>
        </label>
        <span>לחיצה על מילה פותחת את כל מופעיה</span>
      </nav>
      {children}
    </div>
  );
}
