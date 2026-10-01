export type SectionId = "intro" | "work" | "whisperbook" | "wattch" | "about" | "contact";
export const sectionIds: SectionId[] = ["intro", "work", "whisperbook", "wattch", "about", "contact"];
export function currentSection(): SectionId {
  const hash = location.hash.slice(1) as SectionId;
  return sectionIds.includes(hash) ? hash : "intro";
}
export function createNavigation(visit: (section: SectionId, focus: boolean) => void, restoreView: () => void) {
  let current = currentSection();
  let navigating = false;
  let release = 0;
  const go = (section: SectionId, push = true, focus = true) => {
    current = section;
    const url = new URL(location.href);
    url.hash = section === "intro" ? "" : section;
    if (push && url.href !== location.href) history.pushState(null, "", url);
    navigating = true;
    clearTimeout(release);
    visit(section, focus);
    release = window.setTimeout(() => navigating = false, 1600);
  };
  document.addEventListener("click", e => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!a || e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const section = a.hash.slice(1) as SectionId;
    if (!sectionIds.includes(section)) return;
    e.preventDefault();
    go(section);
  });
  const restore = () => { restoreView(); go(currentSection(), false, false); };
  addEventListener("popstate", restore);
  addEventListener("hashchange", restore);
  return {
    go,
    get section() { return current; },
    passive(section: SectionId) {
      if (navigating || current === section) return;
      current = section;
      const url = new URL(location.href);
      url.hash = section === "intro" ? "" : section;
      history.replaceState(null, "", url);
    },
    settled() { clearTimeout(release); navigating = false; },
  };
}
