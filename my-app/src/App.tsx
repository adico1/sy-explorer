import { useEffect, useState } from "react";
import { ReaderPane } from "./ReaderPane";
import { SeferYetzirah } from "./SeferYetzirah";
import { SYConverterWorkbench } from "./SYConverter";
import { pushExplorerURL, readExplorerURL, replaceExplorerURL } from "./url-state";

export default function App() {
  const [sourceVisible, setSourceVisible] = useState(() => {
    const urlState = readExplorerURL();
    if (urlState.source) return !urlState.sourceHidden;
    return localStorage.getItem("sy-explorer:source-layout") !== "hidden";
  });

  useEffect(() => {
    replaceExplorerURL({ source: sourceVisible ? "visible" : "hidden" });
  }, [sourceVisible]);

  useEffect(() => {
    function revealSource() {
      setSourceVisible(true);
      localStorage.setItem("sy-explorer:source-layout", "visible");
    }
    window.addEventListener("sy:navigate-unit", revealSource);
    return () => window.removeEventListener("sy:navigate-unit", revealSource);
  }, []);

  useEffect(() => {
    function restoreLayout() {
      const urlState = readExplorerURL();
      setSourceVisible(urlState.source ? !urlState.sourceHidden : localStorage.getItem("sy-explorer:source-layout") !== "hidden");
    }
    window.addEventListener("popstate", restoreLayout);
    return () => window.removeEventListener("popstate", restoreLayout);
  }, []);

  function toggleSource() {
    setSourceVisible((visible) => {
      localStorage.setItem("sy-explorer:source-layout", visible ? "hidden" : "visible");
      pushExplorerURL({ source: visible ? "hidden" : "visible" });
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
