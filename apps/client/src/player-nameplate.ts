export const TITLE_PRESETS = [
  { name: "Newbie", color: "#a9b4c9" },
  { name: "Pupil", color: "#65d38a" },
  { name: "Specialist", color: "#50dbe9" },
  { name: "Expert", color: "#719aff" },
  { name: "Candidate Master", color: "#c68bff" },
  { name: "Master", color: "#ffbc65" },
  { name: "International Master", color: "#ffd29a" },
  { name: "Grandmaster", color: "#ff697f" },
  { name: "International Grandmaster", color: "#ff465f" },
  { name: "Legendary Grandmaster", color: "#ffd65b" },
];
/**
 * Display order for titles: custom titles first (newest first when the
 * creation time is known), then the rank ladder from lowest to highest.
 */
export function sortTitles<
  T extends { name: string; createdAt?: string | null },
>(titles: T[]): T[] {
  const rank = (t: T) =>
    TITLE_PRESETS.findIndex(
      (p) => p.name.toLowerCase() === t.name.trim().toLowerCase(),
    );
  return [...titles].sort((a, b) => {
    const ra = rank(a),
      rb = rank(b);
    if (ra === -1 && rb === -1)
      return (
        (b.createdAt ?? "").localeCompare(a.createdAt ?? "") ||
        a.name.localeCompare(b.name)
      );
    if (ra === -1) return -1;
    if (rb === -1) return 1;
    return ra - rb;
  });
}
export function titleTreatment(title: string) {
  return /legendary/i.test(title)
    ? "legendary"
    : /grandmaster/i.test(title)
      ? "grandmaster"
      : /master/i.test(title)
        ? "master"
        : "glow";
}
export function updateNameplate(
  el: HTMLElement,
  name: string,
  title: string | null | undefined,
  color: string | null | undefined,
  own: boolean,
  reduced: boolean,
) {
  if (!el.children.length)
    el.innerHTML =
      '<span class="player-title"></span><strong class="player-name"></strong>';
  const badge = el.children[0] as HTMLElement;
  badge.textContent = title ?? "";
  badge.hidden = !title;
  badge.className = `player-title title-${titleTreatment(title ?? "")} ${reduced ? "steady" : ""}`;
  el.style.setProperty(
    "--title-color",
    color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffd65b",
  );
  el.children[1].textContent = name + (own ? " · YOU" : "");
}
