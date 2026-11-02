/** Keep native anchors and keyboard focus clear of the actual header rows.
 * A header taking nearly half the viewport scrolls away with the document. */
export function initHeader() {
  const header = document.querySelector<HTMLElement>(".masthead");
  if (!header) return;
  const measure = () => {
    header.toggleAttribute("data-flow", header.getBoundingClientRect().height > innerHeight * 0.45);
    const clearance = getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().height : 0;
    document.documentElement.style.setProperty("--header-clearance", `${clearance}px`);
  };
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(header);
  addEventListener("resize", measure);
  document.addEventListener("focusin", event => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.closest("main")) return;
    const top = target.getBoundingClientRect().top;
    const edge = getComputedStyle(header).position === "sticky" ? header.getBoundingClientRect().bottom : 0;
    if (top < edge) scrollBy({ top: top - edge - 12, behavior: "instant" });
  });
}
