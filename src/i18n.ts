import { translations } from "./translations.ts";

export type Locale = "en" | "fr" | "ar";
export const LOCALE_STORAGE_KEY = "notebook:locale";
export const isLocale = (value: unknown): value is Locale => value === "en" || value === "fr" || value === "ar";

export function resolveLocale(url: string, saved: string | null, languages: readonly string[]): Locale {
  const requested = new URL(url).searchParams.get("lang");
  if (isLocale(requested)) return requested;
  if (isLocale(saved)) return saved;
  for (const language of languages) {
    const base = language.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

let locale: Locale = "en";
const listeners = new Set<() => void>();
export const getLocale = () => locale;
export function onLocaleChange(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const normalized = new Map(Object.keys(translations).map(key => [key.toLowerCase(), key]));
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Compile complete messages once. Only the season sentence has a constrained
// placeholder: otherwise "{season}." could match any English sentence.
const templates = Object.entries(translations).filter(([key]) => key.includes("{")).map(([key, values]) => {
  const names: string[] = [];
  const parts = key.split(/(\{\w+\})/g).map(part => {
    if (!part.startsWith("{")) return escapeRegex(part);
    const name = part.slice(1, -1);
    names.push(name);
    if (name === "season") return "(Spring|Summer|Autumn|Winter)";
    if (name === "stage") return "(Sketch|Blueprint|Build|Bloom)";
    return "(.+?)";
  });
  return { pattern: new RegExp(`^${parts.join("")}$`, "i"), names, values };
});

/** The source is English; translating text never changes markup or link targets. */
export function translate(source: string, target: Locale = locale): string {
  if (target === "en" || !source.trim()) return source;
  const text = source.trim();
  const key = translations[text] ? text : normalized.get(text.toLowerCase());
  let result = key ? translations[key][target === "fr" ? 0 : 1] : undefined;
  if (!result) {
    for (const template of templates) {
      const match = text.match(template.pattern);
      if (!match) continue;
      const values = Object.fromEntries(template.names.map((name, i) => [name, translate(match[i + 1], target)]));
      result = template.values[target === "fr" ? 0 : 1].replace(/\{(\w+)\}/g, (_, name: string) => values[name]);
      break;
    }
  }
  if (!result) return source;
  return source.slice(0, source.indexOf(text)) + result + source.slice(source.indexOf(text) + text.length);
}

type Binding = { source: string; rendered: string };
const attributes = ["aria-label", "aria-valuetext", "alt", "title", "placeholder"];

/** Bind the static HTML and subsequently mounted widgets to their English
 * source text. Updating nodes rather than rebuilding the app retains focus,
 * drafts, dialogs, rendering state, and existing event handlers. */
export function initLocalization() {
  let saved: string | null = null;
  try { saved = localStorage.getItem(LOCALE_STORAGE_KEY); } catch { /* Storage is optional. */ }
  locale = resolveLocale(location.href, saved, navigator.languages);
  const initialLocale = locale;
  const sources = new WeakMap<Node, Map<string, Binding>>();
  const ignored = "script, style, textarea, [data-no-translate]";
  const controls = [...document.querySelectorAll<HTMLSelectElement>("[data-language]")];

  function bind(node: Node, key: string, value: string, write: (value: string) => void) {
    let bindings = sources.get(node);
    if (!bindings) { bindings = new Map(); sources.set(node, bindings); }
    const previous = bindings.get(key);
    const source = previous?.rendered === value ? previous.source : value;
    const rendered = translate(source);
    bindings.set(key, { source, rendered });
    if (value !== rendered) write(rendered);
  }
  function text(node: Text) {
    if (!node.parentElement || node.parentElement.closest(ignored)) return;
    bind(node, "text", node.data, value => { node.data = value; });
  }
  function element(node: Element) {
    if (node.closest(ignored)) return;
    for (const key of attributes) {
      const value = node.getAttribute(key);
      if (value) bind(node, key, value, translated => node.setAttribute(key, translated));
    }
    if (node.matches('meta[name="description"], meta[property="og:title"], meta[property="og:description"]')) {
      bind(node, "content", node.getAttribute("content") ?? "", value => node.setAttribute("content", value));
    }
  }
  function visit(node: Node) {
    if (node instanceof Text) return text(node);
    if (!(node instanceof Element) && !(node instanceof Document)) return;
    if (node instanceof Element) element(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const current = walker.currentNode;
      if (current instanceof Text) text(current);
      else element(current as Element);
    }
  }
  function refresh() {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    controls.forEach(control => { control.value = locale; });
    document.querySelectorAll<HTMLAnchorElement>("a[data-view]").forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set("lang", locale);
      link.href = url.pathname + url.search + url.hash;
    });
    visit(document);
  }
  refresh();
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") text(record.target as Text);
      else if (record.type === "attributes") element(record.target as Element);
      else record.addedNodes.forEach(visit);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: [...attributes, "content"],
  });
  function change(target: Locale) {
    if (target === locale) return;
    // Finish source bindings before applying another language, including any
    // widgets just mounted in the current JavaScript turn.
    observer.takeRecords().forEach(record => {
      if (record.type === "characterData") text(record.target as Text);
      else if (record.type === "attributes") element(record.target as Element);
      else record.addedNodes.forEach(visit);
    });
    locale = target;
    refresh();
    listeners.forEach(listener => listener());
  }
  function selected(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (!isLocale(value)) return;
    const url = new URL(location.href);
    url.searchParams.set("lang", value);
    history.pushState(null, "", url);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, value); } catch { /* Still works without storage. */ }
    change(value);
  }
  const fromHistory = () => change(resolveLocale(location.href, initialLocale, navigator.languages));
  controls.forEach(control => control.addEventListener("change", selected));
  addEventListener("popstate", fromHistory);
  return () => {
    observer.disconnect();
    controls.forEach(control => control.removeEventListener("change", selected));
    removeEventListener("popstate", fromHistory);
  };
}
