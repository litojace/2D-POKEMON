/**
 * Getting started: a short guide for a new player's first minutes. Five
 * steps, in the order that gets them to a fun moment and something to keep
 * fast: a match against a bot, the first boss, wearing what it gave them,
 * then the Farm and the Bistro.
 *
 * It shows on the Lobby (in the Journey card's place) for a new account,
 * until every step is done or the player hides it; the Menu brings it back.
 * Steps the server already knows about (a Cragmuff clear, something worn)
 * come from the account; the rest (a bot match finished, a scene visited)
 * are remembered per account in this browser, like seen rewards.
 *
 * Markup and rules only; main.ts wires the actions.
 */
import { esc, panel, button, tag, actionBar, actions } from "./ui/components";
import { menuIcon, type IconName } from "./menu-icons";
import "./getting-started.css";

export type GuideStep = "bot" | "raid" | "wear" | "farm" | "bistro";
export const GUIDE_STEPS: {
  id: GuideStep;
  title: string;
  hint: string;
  icon: IconName;
}[] = [
  {
    id: "bot",
    title: "Play your first match",
    hint: "Best of five against an Easy bot. Move, dodge and use your skills.",
    icon: "bot",
  },
  {
    id: "raid",
    title: "Defeat Cragmuff",
    hint: "Your first boss. Solo is fine: you get a self-revive.",
    icon: "bestiary",
  },
  {
    id: "wear",
    title: "Wear your first reward",
    hint: "Cragmuff gives you an entrance. Put it on in the Wardrobe.",
    icon: "wardrobe",
  },
  {
    id: "farm",
    title: "Visit your Farm",
    hint: "Plant crops. They keep growing while you play or rest.",
    icon: "home",
  },
  {
    id: "bistro",
    title: "Open your Bistro",
    hint: "Cook for guests who drop by, and earn coins.",
    icon: "coin",
  },
];

/** What this browser remembers for an account. */
export interface GuideSave {
  /** Steps done (kept even if what proved it changes later). */
  done: Partial<Record<GuideStep, true>>;
  /** The guide was shown once: it stays until done or hidden. */
  started?: boolean;
  /** The player hid it (the Menu shows it again). */
  hidden?: boolean;
}
/** What the account itself says (from the server). */
export interface GuideFacts {
  /** Player level, or undefined while the account loads. */
  level: number | undefined;
  cragmuffClears: number;
  /** Something worn in an appearance slot, or a title. */
  wearing: boolean;
}
export interface GuideView {
  done: Record<GuideStep, boolean>;
  count: number;
  /** The first step not done yet, or null when all are. */
  next: GuideStep | null;
  /** Shown on the Lobby now. */
  active: boolean;
}

/** New accounts start the guide on their own; older ones from the Menu. */
export const GUIDE_NEW_LEVEL = 5;
const KEY = (account: string) => `arena-guide:${account}`;

export function loadGuide(account: string | undefined): GuideSave {
  if (!account) return { done: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY(account)) ?? "null");
    if (
      raw &&
      typeof raw === "object" &&
      raw.done &&
      typeof raw.done === "object"
    )
      return {
        done: Object.fromEntries(
          GUIDE_STEPS.filter((s) => raw.done[s.id] === true).map((s) => [
            s.id,
            true,
          ]),
        ),
        started: raw.started === true,
        hidden: raw.hidden === true,
      };
  } catch {
    /* Optional: a fresh guide. */
  }
  return { done: {} };
}
export function saveGuide(account: string | undefined, save: GuideSave) {
  if (!account) return;
  try {
    localStorage.setItem(KEY(account), JSON.stringify(save));
  } catch {
    /* Private mode: the guide forgets on reload. */
  }
}

/** The account's facts fold into the save, so a step never comes undone. */
export function settleGuide(save: GuideSave, facts: GuideFacts): GuideSave {
  const done = { ...save.done };
  if (facts.cragmuffClears > 0) done.raid = true;
  if (facts.wearing) done.wear = true;
  const all = GUIDE_STEPS.every((s) => done[s.id]);
  // A new account starts it; one that was shown keeps it.
  const started =
    save.started ||
    (!all &&
      !save.hidden &&
      facts.level !== undefined &&
      facts.level <= GUIDE_NEW_LEVEL);
  return { ...save, done, started };
}

export function guideView(save: GuideSave): GuideView {
  const done = Object.fromEntries(
    GUIDE_STEPS.map((s) => [s.id, !!save.done[s.id]]),
  ) as Record<GuideStep, boolean>;
  const count = GUIDE_STEPS.filter((s) => done[s.id]).length;
  const next = GUIDE_STEPS.find((s) => !done[s.id])?.id ?? null;
  return {
    done,
    count,
    next,
    active: !!save.started && !save.hidden && next !== null,
  };
}

const stepOf = (id: GuideStep) => GUIDE_STEPS.find((s) => s.id === id)!;
const progressDots = (v: GuideView) =>
  `<span class="guide-dots" aria-hidden="true">${GUIDE_STEPS.map((s) => `<i class="${v.done[s.id] ? "is-done" : s.id === v.next ? "is-next" : ""}"></i>`).join("")}</span>`;

/** The Lobby card (in the Journey card's place): the next step. */
export function guideCard(v: GuideView) {
  const next = v.next ? stepOf(v.next) : undefined;
  return `<span class="lobby-card-kicker">Getting started · ${v.count} of ${GUIDE_STEPS.length}</span><b>${esc(next?.title ?? "All done")}</b>${progressDots(v)}`;
}

/** The sheet: every step, the next one first to act on, and Hide. */
export function guideMarkup(v: GuideView) {
  const rows = GUIDE_STEPS.map((s, i) => {
    const done = v.done[s.id],
      next = s.id === v.next;
    const action = done
      ? tag("Done", "ok")
      : button("Go", {
          size: "s",
          kind: next ? "primary" : "default",
          attrs: {
            "data-guide-go": s.id,
            "aria-label": `${s.title}: go`,
          },
        });
    return `<li class="guide-step${done ? " is-done" : ""}${next ? " is-next" : ""}"><span class="guide-step-mark" aria-hidden="true">${done ? menuIcon("check") : i + 1}</span><span class="guide-step-icon" aria-hidden="true">${menuIcon(s.icon)}</span><span class="guide-step-text"><b>${esc(s.title)}</b><small>${esc(s.hint)}</small></span><span class="guide-step-act">${action}</span></li>`;
  }).join("");
  const body =
    v.next === null
      ? `<p class="guide-lead">You're all set: you've tried everything a new player needs. Have fun!</p><ol class="guide-steps">${rows}</ol>`
      : `<p class="guide-lead">A few minutes to see what the game has. Do them in any order; skip any you like.</p><ol class="guide-steps">${rows}</ol>`;
  const foot = actionBar(
    `<small class="ui-note">${v.count} of ${GUIDE_STEPS.length} done${v.active ? "" : " · hidden from the Lobby"}</small>`,
    actions(
      v.active
        ? button("Hide guide", { attrs: { "data-guide-hide": true } })
        : v.next
          ? button("Show on the Lobby", {
              attrs: { "data-guide-show": true },
            })
          : "",
    ),
  );
  return panel({
    kind: "sheet",
    title: "Getting started",
    kicker: `${v.count} of ${GUIDE_STEPS.length}`,
    body,
    foot,
    attrs: { "data-guide": true },
  });
}
