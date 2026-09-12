export type ExplorerURLState = {
  view: string | null;
  name: string | null;
  chapter: string | null;
  unit: string | null;
  source: string | null;
  letter: string | null;
  pair: string | null;
  step: string | null;
  sourceHidden: boolean;
};

export function readExplorerURL(): ExplorerURLState {
  const params = new URLSearchParams(window.location.search);
  return {
    view: params.get("view"),
    name: params.get("name"),
    chapter: params.get("chapter"),
    unit: params.get("unit"),
    source: params.get("source"),
    letter: params.get("letter"),
    pair: params.get("pair"),
    step: params.get("step"),
    sourceHidden: params.get("source") === "hidden",
  };
}

export function replaceExplorerURL(values: Record<string, string | null>) {
  const url = new URL(window.location.href);
  Object.entries(values).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  if (url.href !== window.location.href) window.history.replaceState(null, "", url);
}

export function pushExplorerURL(values: Record<string, string | null>) {
  const url = new URL(window.location.href);
  Object.entries(values).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  if (url.href !== window.location.href) window.history.pushState(null, "", url);
}

export async function copyExplorerURL() {
  const value = window.location.href;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}
