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
  // This runs for every visible fighter on every frame. Replacing even the
  // same text recreates text nodes and invalidates layout/title animation.
  const titleText = title ?? "";
  if (badge.textContent !== titleText) badge.textContent = titleText;
  if (badge.hidden !== !title) badge.hidden = !title;
  const className = `player-title title-${titleTreatment(titleText)} ${reduced ? "steady" : ""}`;
  if (badge.className !== className) badge.className = className;
  const titleColor = color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffd65b";
  if (el.style.getPropertyValue("--title-color") !== titleColor)
    el.style.setProperty("--title-color", titleColor);
  const nameText = name + (own ? " · YOU" : "");
  if (el.children[1].textContent !== nameText)
    el.children[1].textContent = nameText;
}
/** A battle-only health row follows the name without rebuilding the label. */
export function updateNameplateHealth(
  el: HTMLElement,
  hp: number,
  maxHp: number,
  relation: "self" | "ally" | "enemy",
) {
  let track = el.children[2] as HTMLElement | undefined;
  if (!track) {
    track = document.createElement("span");
    track.className = "fighter-health";
    track.setAttribute("role", "meter");
    track.setAttribute("aria-label", "Health");
    track.setAttribute("aria-valuemin", "0");
    track.append(document.createElement("i"));
    el.append(track);
  }
  const maximum = Math.max(1, maxHp);
  const current = Math.max(0, Math.min(hp, maximum));
  const maximumText = String(Math.ceil(maximum));
  const currentText = String(Math.ceil(current));
  if (track.getAttribute("aria-valuemax") !== maximumText)
    track.setAttribute("aria-valuemax", maximumText);
  if (track.getAttribute("aria-valuenow") !== currentText)
    track.setAttribute("aria-valuenow", currentText);
  if (track.dataset.team !== relation) track.dataset.team = relation;
  // One division represents 25 HP in this game's smaller health pool.
  const step = `${(100 * 25) / maximum}%`;
  if (track.style.getPropertyValue("--health-step") !== step)
    track.style.setProperty("--health-step", step);
  const fill = track.firstElementChild as HTMLElement;
  const amount = `scaleX(${Math.round((current / maximum) * 10000) / 10000})`;
  if (fill.style.transform !== amount) fill.style.transform = amount;
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
type PickerTitle = {
  id: string;
  name: string;
  color: string;
  description?: string;
  createdAt?: string | null;
};
/**
 * The profile's title chooser: each owned title drawn exactly as it appears
 * above a fighter (colour, glow, shimmer), plus a live nameplate preview that
 * the caller keeps up to date with updateNameplate. Radios are named
 * "titleId", so the surrounding form submits the same value the old <select>
 * did ("" = no title).
 */
export function titlePickerMarkup(
  titles: PickerTitle[],
  equipped: string | null | undefined,
) {
  const sorted = sortTitles(titles);
  const current = sorted.find((t) => t.name === equipped)?.id ?? "";
  const option = (t: PickerTitle | null) => {
    const id = t?.id ?? "";
    const sample = t
      ? `<span class="player-title title-${titleTreatment(t.name)}">${escapeHtml(t.name)}</span>`
      : '<span class="title-none">No title</span>';
    const note = t ? t.description : "Just your name above your fighter.";
    return `<label class="title-option" style="--title-color:${t && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color : "#a9b4c9"}"><input type="radio" name="titleId" value="${escapeHtml(id)}"${id === current ? " checked" : ""}><span class="title-sample">${sample}${note ? `<small>${escapeHtml(note)}</small>` : ""}</span>${id === current ? '<em class="title-equipped">Equipped</em>' : ""}</label>`;
  };
  return `<fieldset class="title-picker"><legend>Equipped title</legend><div class="title-preview"><div class="player-nameplate" id="title-preview"></div><small>How other players see you in the arena</small></div><div class="title-options" role="radiogroup" aria-label="Choose a title">${option(null)}${sorted.map(option).join("")}</div>${sorted.length ? "" : '<p class="muted">Earn titles from season ranks, raids and events. They show up here.</p>'}</fieldset>`;
}
