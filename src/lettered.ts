/* Headline letters are wrapped so they can be set in one after another. */
export function lettered(text: string) {
  let i = 0;
  const words = text
    .split(" ")
    .map(
      (w) =>
        `<span class="word">${[...w].map((c) => `<span class="char" style="--i:${i++}">${c}</span>`).join("")}</span>`,
    )
    .join(" ");
  return `<span class="sr-only">${text}</span><span aria-hidden="true">${words}</span>`;
}
