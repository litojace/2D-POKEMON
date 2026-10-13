export const TITLE_PRESETS = [
  { name: "Newbie", color: "#a9b4c9" },
  { name: "Pupil", color: "#65d38a" },
  { name: "Specialist", color: "#50dbe9" },
  { name: "Expert", color: "#719aff" },
  { name: "Candidate Master", color: "#c68bff" },
  { name: "Master", color: "#ffbc65" },
  { name: "Grandmaster", color: "#ff697f" },
  { name: "International Grandmaster", color: "#ff465f" },
  { name: "Legendary Grandmaster", color: "#ffd65b" },
];
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
