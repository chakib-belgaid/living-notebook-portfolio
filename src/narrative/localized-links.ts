import { getLocale, onLocaleChange } from "../i18n";

/** Case pages and the CV exist in English and French. The static page links
 * the English files; French swaps in data-href-fr. */
export function initLocalizedLinks() {
  const apply = () => {
    const french = getLocale() === "fr";
    document.querySelectorAll<HTMLAnchorElement>("a[data-href-fr][data-href-en]").forEach(link => {
      link.setAttribute("href", french ? link.dataset.hrefFr! : link.dataset.hrefEn!);
      link.hreflang = french ? "fr" : "en";
    });
  };
  apply();
  return onLocaleChange(apply);
}
