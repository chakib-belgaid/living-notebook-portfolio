/* Return to the portfolio from a retained case page (/work/<slug>/ and
   /fr/work/<slug>/). Plain script: Vite copies public/ verbatim.

   Without this script (or without sessionStorage) each "Return to the
   portfolio" link keeps its static href, the case's chapter anchor in the
   page's language (/#whisperbook, /?lang=fr#whisperbook, ...).

   With a record left by the homepage (src/narrative/return-state.ts, same
   format), the links get the homepage's own query back (lang, view, quality,
   anything else; never a forced view=read) and, when the record is for this
   case's chapter, following the link hands the relative reading offset to
   the homepage through sessionStorage ("notebook:restore"), not the URL.
   The destination is always "/" on this origin: a record cannot redirect.
   Links marked data-portfolio-link (name, Projects) get the same query. */
(() => {
  const CHAPTERS = ["intro", "work", "bplog", "whisperbook", "energy-tools", "mcq-scan", "about", "contact"];
  const french = document.documentElement.lang === "fr";
  const read = key => { try { return sessionStorage.getItem(key); } catch { return null; } };
  const write = (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* Storage is optional. */ } };
  const parse = raw => {
    if (!raw) return null;
    try {
      const r = JSON.parse(raw);
      const ok = r && r.v === 1 && CHAPTERS.includes(r.chapter)
        && typeof r.offset === "number" && Number.isFinite(r.offset) && r.offset >= 0 && r.offset <= 1
        && typeof r.query === "string" && r.query.length <= 512 && (r.query === "" || r.query.startsWith("?"));
      return ok ? r : null;
    } catch { return null; }
  };
  const path = location.pathname.endsWith("/") ? location.pathname : `${location.pathname}/`;
  const own = parse(read(`notebook:return:${path}`));
  const record = own || parse(read("notebook:return:last"));

  // The homepage's parameters, with the language of this page: a French case
  // returns in French; an English case returns in English.
  const params = new URLSearchParams(record ? record.query : "");
  if (french) params.set("lang", "fr");
  else if (params.has("lang")) params.set("lang", "en");
  const search = params.toString();
  const home = hash => `/${search ? `?${search}` : ""}${hash}`;

  if (record) {
    document.querySelectorAll("a[data-portfolio-link]").forEach(link => {
      link.setAttribute("href", home(new URL(link.href).hash));
    });
  }
  document.querySelectorAll("a[data-return]").forEach(link => {
    const chapter = link.dataset.return;
    if (!CHAPTERS.includes(chapter)) return;
    if (record) link.setAttribute("href", home(`#${chapter}`));
    const offset = record && record.chapter === chapter ? record.offset : null;
    if (offset === null) return;
    link.addEventListener("click", () => {
      write("notebook:restore", JSON.stringify({ v: 1, chapter, offset, t: Date.now() }));
    });
  });
})();
