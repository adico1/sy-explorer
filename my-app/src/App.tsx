import { useEffect, useState } from "react";
import { ReaderPane } from "./ReaderPane";
import { SeferYetzirah } from "./SeferYetzirah";
import { SYConverterWorkbench } from "./SYConverter";

export default function App() {
  const [sourceVisible, setSourceVisible] = useState(() => localStorage.getItem("sy-explorer:source-layout") !== "hidden");

  useEffect(() => {
    function revealSource() {
      setSourceVisible(true);
      localStorage.setItem("sy-explorer:source-layout", "visible");
    }
    window.addEventListener("sy:navigate-unit", revealSource);
    return () => window.removeEventListener("sy:navigate-unit", revealSource);
  }, []);

  function toggleSource() {
    setSourceVisible((visible) => {
      localStorage.setItem("sy-explorer:source-layout", visible ? "hidden" : "visible");
      return !visible;
    });
  }

  return (
    <div className={`app-shell${sourceVisible ? "" : " app-shell--workspace"}`} dir="rtl">
      <ReaderPane>
        <SeferYetzirah />
      </ReaderPane>
      <SYConverterWorkbench sourceVisible={sourceVisible} onToggleSource={toggleSource} />
    </div>
  );
}
