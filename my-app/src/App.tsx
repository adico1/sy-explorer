import { ReaderPane } from "./ReaderPane";
import { SeferYetzirah } from "./SeferYetzirah";
import { SYConverterWorkbench } from "./SYConverter";

export default function App() {
  return (
    <div className="app-shell" dir="rtl">
      <ReaderPane>
        <SeferYetzirah />
      </ReaderPane>
      <SYConverterWorkbench />
    </div>
  );
}
