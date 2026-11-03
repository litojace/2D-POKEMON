/**
 * Shared components for every hub screen (UI remodel step 1,
 * docs/ui-remodel/PLAN.md). Each function returns markup, the way the rest
 * of the client builds screens; ui/components.css styles it. Every piece of
 * text passed in is escaped here, so callers never build HTML from data.
 *
 * Rules the components enforce:
 * - Buttons come in two heights (`m`, `s`). Buttons in an `actions()` group
 *   share one width, primary last; colour is the only difference.
 * - A panel's Close is always its last head item and sits in the corner.
 */
import { menuIcon } from "../menu-icons";
import { elementIcon } from "../element-icons";

type IconName = Parameters<typeof menuIcon>[0];
export type Attrs = Record<string, string | number | boolean | undefined>;

export const esc = (s: string | number) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/** ` name="value"` pairs; `true` writes a bare attribute, false/undefined none. */
export function attrs(a: Attrs = {}) {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${esc(v as string)}"`))
    .join("");
}

/* ------------------------------------------------------------- buttons */

export interface ButtonOptions {
  /** primary: gold; ok: green (Equip); ghost: no fill; danger: red outline. */
  kind?: "default" | "primary" | "ok" | "ghost" | "danger";
  size?: "m" | "s";
  icon?: IconName;
  /** Extra HTML after the label (a price, a count). Must be markup you built. */
  after?: string;
  disabled?: boolean;
  attrs?: Attrs;
}
export function button(label: string, o: ButtonOptions = {}) {
  const cls = [
    "ui-btn",
    o.kind && o.kind !== "default" ? `is-${o.kind}` : "",
    o.size === "s" ? "is-s" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `<button type="button" class="${cls}"${o.disabled ? " disabled" : ""}${attrs(o.attrs)}>${o.icon ? menuIcon(o.icon) : ""}<span>${esc(label)}</span>${o.after ?? ""}</button>`;
}
export function iconButton(icon: IconName, label: string, a: Attrs = {}) {
  const { class: extra, ...rest } = a;
  return `<button type="button" class="ui-icon-btn${extra ? ` ${esc(extra as string)}` : ""}" aria-label="${esc(label)}" title="${esc(label)}"${attrs(rest)}>${menuIcon(icon)}</button>`;
}
/** A group of equal buttons; put the main action last (bottom right). */
export const actions = (...buttons: string[]) =>
  `<div class="ui-actions">${buttons.join("")}</div>`;

/* ------------------------------------------------------- panel / sheet */

export interface PanelOptions {
  /** panel: fills the space right of the rail; sheet: narrow, the Lobby stays visible. */
  kind?: "panel" | "sheet";
  kicker?: string;
  title: string;
  /** Head tools between the title and Close (markup). */
  tools?: string;
  /** Tabs under the head (markup from tabs()). */
  tabs?: string;
  body: string;
  /** The action bar (markup from actionBar()). */
  foot?: string;
  attrs?: Attrs;
}
export function panelHead(
  title: string,
  kicker = "",
  tools = "",
  close = true,
) {
  return `<header class="ui-panel-head"><div class="ui-heading">${kicker ? `<span class="ui-kicker">${esc(kicker)}</span>` : ""}<h2 class="ui-title">${esc(title)}</h2></div>${tools}${close ? iconButton("cancel", "Back to the Lobby", { class: "ui-close", "data-ui-close": true }) : ""}</header>`;
}
export function panel(o: PanelOptions) {
  return `<section class="ui-panel${o.kind === "sheet" ? " ui-sheet" : ""}" role="dialog" aria-label="${esc(o.title)}"${attrs(o.attrs)}>${panelHead(o.title, o.kicker, o.tools)}${o.tabs ?? ""}<div class="ui-panel-body">${o.body}</div>${o.foot ?? ""}</section>`;
}
/** The bottom bar: what you're about to act on (left) and the actions (right). */
export const actionBar = (info: string, buttons: string) =>
  `<footer class="ui-panel-foot"><div class="ui-foot-info">${info}</div>${buttons}</footer>`;

/* ------------------------------------------------------ choosing things */

export interface Choice {
  id: string;
  label: string;
  selected?: boolean;
  /** A small count after the label (escaped). */
  count?: number | string;
  attrs?: Attrs;
}
export function tabs(items: Choice[], label: string, key = "tab") {
  return `<div class="ui-tabs" role="tablist" aria-label="${esc(label)}">${items
    .map(
      (t) =>
        `<button type="button" role="tab" aria-selected="${!!t.selected}" tabindex="${t.selected ? 0 : -1}" data-ui-${key}="${esc(t.id)}"${attrs(t.attrs)}>${esc(t.label)}${t.count !== undefined ? `<span class="ui-tag">${esc(t.count)}</span>` : ""}</button>`,
    )
    .join("")}</div>`;
}
export function segmented(
  items: Choice[],
  label: string,
  key = "seg",
  display = false,
) {
  return `<div class="ui-seg${display ? " is-display" : ""}" role="group" aria-label="${esc(label)}">${items
    .map(
      (t) =>
        `<button type="button" aria-pressed="${!!t.selected}" data-ui-${key}="${esc(t.id)}"${attrs(t.attrs)}>${esc(t.label)}</button>`,
    )
    .join("")}</div>`;
}
export function chips(items: Choice[], label: string, key = "chip") {
  return `<div class="ui-chips" role="group" aria-label="${esc(label)}">${items
    .map(
      (t) =>
        `<button type="button" class="ui-chip" aria-pressed="${!!t.selected}" data-ui-${key}="${esc(t.id)}"${attrs(t.attrs)}>${esc(t.label)}</button>`,
    )
    .join("")}</div>`;
}

/* ------------------------------------------------------ money and state */

const number = (n: number) => n.toLocaleString("en-US");
/** A coin amount; `was` shows a struck-through old price before it. */
export function price(n: number, was?: number) {
  return `<span class="ui-price"><i class="ui-coin" aria-hidden="true"></i>${was !== undefined && was !== n ? `<s><span class="sr-only">was </span>${number(was)}</s>` : ""}<span>${number(n)}<span class="sr-only"> coins</span></span></span>`;
}
export type TagKind = "default" | "new" | "ok" | "sale" | "lock";
export const tag = (text: string, kind: TagKind = "default") =>
  `<span class="ui-tag${kind === "default" ? "" : ` is-${kind}`}">${esc(text)}</span>`;
export const badge = (n: number) =>
  n > 0
    ? `<i class="ui-badge" aria-label="${n} new">${n > 99 ? "99+" : n}</i>`
    : "";
export const dot = (label = "New") =>
  `<i class="ui-dot" role="img" aria-label="${esc(label)}"></i>`;

export type RarityName =
  "common" | "rare" | "epic" | "legendary" | "mythical" | "mythic";
const RARITY_LABEL: Record<RarityName, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythical: "Mythical",
  mythic: "Mythical",
};
export const rarityTag = (r: RarityName) =>
  `<span class="ui-rarity${r === "mythical" || r === "mythic" ? " is-mythic" : ""}" data-rarity="${r}">${RARITY_LABEL[r]}</span>`;
export const elementTag = (element: string) =>
  `<span class="ui-element" style="--el:var(--el-${esc(element.toLowerCase())})">${elementIcon(element)}${esc(element)}</span>`;
/** A countdown label; the text comes from serverCountdown() (server time). */
export const timer = (text: string) =>
  `<span class="ui-timer">${esc(text)}</span>`;

/* ------------------------------------------------------------- progress */

const pct = (value: number, max: number) =>
  max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
export function bar(
  value: number,
  max: number,
  o: { label: string; color?: string; thick?: boolean },
) {
  return `<span class="ui-bar${o.thick ? " is-thick" : ""}" role="progressbar" aria-label="${esc(o.label)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.min(value, max)}"><i style="--p:${pct(value, max).toFixed(1)}%${o.color ? `;--bar:${esc(o.color)}` : ""}"></i></span>`;
}
/** A round meter (mastery, timers) with markup in the middle. */
export function ring(
  value: number,
  max: number,
  inner: string,
  o: { label: string; color?: string; size?: number },
) {
  return `<span class="ui-ring" role="img" aria-label="${esc(o.label)}" style="--p:${pct(value, max).toFixed(1)}${o.color ? `;--ring:${esc(o.color)}` : ""}${o.size ? `;--size:${o.size}px` : ""}">${inner}</span>`;
}

/* ---------------------------------------------------------- people, rows */

export type Presence = "online" | "busy" | "plaza" | "away";
/** A round portrait (markup from fighterAvatar) with an optional status dot. */
export function avatar(
  art: string,
  o: { element?: string; status?: Presence; size?: number } = {},
) {
  const style = [
    o.element ? `--el:var(--el-${esc(o.element.toLowerCase())})` : "",
    o.size ? `--size:${o.size}px` : "",
  ]
    .filter(Boolean)
    .join(";");
  return `<span class="ui-avatar"${style ? ` style="${style}"` : ""}>${art}${o.status ? `<i class="ui-status" style="--st:var(--st-${o.status})"></i>` : ""}</span>`;
}
/** A list row: picture, two lines of text, actions on the right. */
export function row(o: {
  lead?: string;
  title: string;
  sub?: string;
  actions?: string;
  attrs?: Attrs;
}) {
  return `<div class="ui-row"${attrs(o.attrs)}>${o.lead ?? "<span></span>"}<span class="ui-row-main"><b>${esc(o.title)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ""}</span><span class="ui-row-acts">${o.actions ?? ""}</span></div>`;
}

/* ----------------------------------------------------------------- items */

export interface TileOptions {
  id: string;
  /** Picture markup (itemPicture, fighterArt…). */
  art: string;
  name: string;
  sub?: string;
  rarity?: RarityName;
  /** The bottom line: a price(), "Owned", trial progress… (markup). */
  foot?: string;
  footKind?: "default" | "ok" | "trial" | "dim";
  /** A corner tag (markup from tag()). */
  corner?: string;
  pressed?: boolean;
  dim?: boolean;
  attrs?: Attrs;
}
/** One card for every item: fixed rows, so a long name never moves the art. */
export function itemTile(o: TileOptions) {
  const mythic = o.rarity === "mythical" || o.rarity === "mythic";
  return `<button type="button" class="ui-tile${mythic ? " is-mythic" : ""}${o.dim ? " is-unowned" : ""}"${o.rarity ? ` data-rarity="${o.rarity}"` : ""} aria-pressed="${!!o.pressed}" data-ui-item="${esc(o.id)}"${attrs(o.attrs)}>${o.corner ?? ""}<span class="ui-tile-art">${o.art}</span>${o.rarity ? rarityTag(o.rarity) : "<span></span>"}<b class="ui-tile-name">${esc(o.name)}</b><small class="ui-tile-sub">${esc(o.sub ?? "")}</small><span class="ui-tile-foot${o.footKind && o.footKind !== "default" ? ` is-${o.footKind}` : ""}">${o.foot ?? ""}</span></button>`;
}

/* ------------------------------------------------------- empty, confirm */

export function emptyState(title: string, text: string, action = "") {
  return `<div class="ui-empty" role="status"><b>${esc(title)}</b><span>${esc(text)}</span>${action}</div>`;
}

export interface ConfirmOptions {
  kicker: string;
  title: string;
  /** A line under the title (markup: a rarity tag, what the item is). */
  sub?: string;
  /** Picture markup shown beside the details. */
  art?: string;
  /** Detail lines, label → markup (a price(), a name). */
  lines: [string, string][];
  /** The final line (after a rule), e.g. coins after buying. */
  total?: [string, string];
  /** Extra markup under the lines (a checkbox). */
  extra?: string;
  cancel?: string;
  confirm: string;
  /** The confirm button's extra markup (its price). */
  confirmAfter?: string;
}
/**
 * A modal for anything that spends: the item, its price, your coins and
 * what you'll have after. The numbers are only a preview; the server sets
 * the price and checks the balance, and its answer is what counts.
 */
export function confirmModal(o: ConfirmOptions) {
  const lines = [...o.lines, ...(o.total ? [o.total] : [])]
    .map(
      ([k, v], i) =>
        `<dt${o.total && i === o.lines.length ? ' class="is-total"' : ""}>${esc(k)}</dt><dd${o.total && i === o.lines.length ? ' class="is-total"' : ""}>${v}</dd>`,
    )
    .join("");
  return `<div class="ui-scrim" data-ui-confirm><div class="ui-modal${o.art ? " has-art" : ""}" role="alertdialog" aria-modal="true" aria-label="${esc(o.title)}">${o.art ? `<div class="ui-modal-art">${o.art}</div>` : ""}<div class="ui-modal-body"><span class="ui-kicker">${esc(o.kicker)}</span><b class="ui-title">${esc(o.title)}</b>${o.sub ? `<span class="ui-modal-sub">${o.sub}</span>` : ""}<dl class="ui-ledger">${lines}</dl>${o.extra ?? ""}</div>${actions(button(o.cancel ?? "Cancel", { attrs: { "data-ui-cancel": true } }), button(o.confirm, { kind: "primary", after: o.confirmAfter, attrs: { "data-ui-confirm-ok": true } }))}</div></div>`;
}
