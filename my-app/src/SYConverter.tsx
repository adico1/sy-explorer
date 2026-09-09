import { useState } from "react";
import sourceText from "./App.tsx?raw";
import spec from "./sy.converter.spec.json";
import { createConverter } from "./converter-engine.mjs";

const convert = createConverter(spec);

export function SYConverter() {
  const [corpus, setCorpus] = useState<any>(null);

  function runConversion() {
    const result = convert(sourceText);

    if (!result.validation.valid) {
      console.error(result.validation.errors);
      return;
    }

    setCorpus(result);
  }

  function downloadJSON() {
    if (!corpus) return;

    const blob = new Blob(
      [JSON.stringify(corpus, null, 2) + "\n"],
      { type: "application/json;charset=utf-8" },
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `sy.corpus-${corpus.version}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <section dir="rtl">
      <button onClick={runConversion}>
        המר את קובץ המקור
      </button>

      <button onClick={downloadJSON} disabled={!corpus}>
        הורד JSON
      </button>

      {corpus && (
        <>
          <p>
            {corpus.stats.units} יחידות ·{" "}
            {corpus.stats.operations} פעולות ·{" "}
            {corpus.provenance.length} קישורי ראיה
          </p>

          <pre dir="ltr">
            {JSON.stringify(corpus, null, 2)}
          </pre>
        </>
      )}
    </section>
  );
}