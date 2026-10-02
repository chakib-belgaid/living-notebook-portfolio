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
  // Isolate the phrase before splitting it into letters, so an RTL page
  // cannot reverse Latin names or break the ordering of its words.
  return `<span class="sr-only">${text}</span><span aria-hidden="true" dir="auto">${words}</span>`;
}
