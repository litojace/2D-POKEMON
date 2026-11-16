/**
 * Chat bubbles drawn on a canvas (the Plaza, the Farm): the lines a bubble
 * holds, so its text never runs past its edges. Words wrap at `maxWidth`; a
 * word wider than that is cut where it fits; past `maxLines` the last line
 * ends with "…". The bubble is then sized from the widest line.
 */
export function bubbleLines(
  text: string,
  measure: (s: string) => number,
  maxWidth: number,
  maxLines = 3,
): string[] {
  const lines: string[] = [];
  let line = "";
  const push = (s: string) => {
    lines.push(s);
    line = "";
  };
  for (const word of text.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) push(line);
    // A word too wide for a line on its own: cut it where it fits.
    let rest = word;
    while (measure(rest) > maxWidth) {
      const chars = [...rest];
      let n = chars.length - 1;
      while (n > 1 && measure(chars.slice(0, n).join("")) > maxWidth) n--;
      push(chars.slice(0, n).join(""));
      rest = chars.slice(n).join("");
    }
    line = rest;
  }
  if (line) push(line);
  if (lines.length <= maxLines) return lines;
  // Too long: keep maxLines, the last one ending in "…" within the width.
  const kept = lines.slice(0, maxLines);
  let last = [...kept[maxLines - 1]];
  while (last.length && measure(`${last.join("")}…`) > maxWidth) last.pop();
  kept[maxLines - 1] = `${last.join("").trimEnd()}…`;
  return kept;
}
