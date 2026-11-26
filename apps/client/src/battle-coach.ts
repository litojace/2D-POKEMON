/**
 * The first match's coach: during a new player's match against a bot
 * (Getting started's first step), one short line at a time over the court:
 * move, attack, use a skill, dash, then the goal. Each line goes when the
 * player has done it, read from the input they send; the keys are their own
 * (or the touch buttons).
 *
 * The line is DOM, changed only when the step changes: nothing here reads
 * layout, and note() is a comparison per input (docs/network-performance.md).
 */
import type { Input } from "@arena/shared";
import "./battle-coach.css";

export type CoachStep = "move" | "attack" | "skill" | "dash" | "goal";
export const COACH_STEPS: CoachStep[] = [
  "move",
  "attack",
  "skill",
  "dash",
  "goal",
];
/** The goal line stays this long, then the coach is done. */
export const COACH_GOAL_MS = 5000;

export interface CoachKeys {
  touch: boolean;
  move: string;
  basic: string;
  skills: string;
  dash: string;
  /** Round wins this match needs (a new player's first is one round). */
  rounds?: number;
}
/** The goal, for the round wins this match needs. */
export const coachGoal = (rounds = 3) =>
  rounds === 1
    ? "Win this round to take the match!"
    : `Win ${rounds} rounds to take the match!`;

/** What the player did that moves a step on (null: still on it). */
export function coachAdvance(step: CoachStep, input: Input): CoachStep | null {
  if (step === "move" && (input.dx !== 0 || input.dy !== 0)) return "attack";
  if (step === "attack" && input.basic) return "skill";
  if (step === "skill" && input.skill >= 0) return "dash";
  if (step === "dash" && (input.dash || input.jump)) return "goal";
  return null;
}

/** The line for a step: the key (or button) and what to do. */
export function coachLine(step: CoachStep, k: CoachKeys) {
  switch (step) {
    case "move":
      return k.touch
        ? { key: "STICK", text: "Drag the left side of the screen to move" }
        : { key: k.move, text: "Move around" };
    case "attack":
      return k.touch
        ? { key: "ATTACK", text: "Tap the big button to attack" }
        : { key: k.basic, text: "Basic attack (hold to keep hitting)" };
    case "skill":
      return k.touch
        ? { key: "SKILL", text: "Tap a skill button" }
        : { key: k.skills, text: "Use a skill" };
    case "dash":
      return k.touch
        ? { key: "DASH", text: "Tap Dash to dodge an attack" }
        : { key: k.dash, text: "Dash to dodge an attack" };
    case "goal":
      return { key: "GOAL", text: coachGoal(k.rounds) };
  }
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function coachMarkup(step: CoachStep, k: CoachKeys) {
  const line = coachLine(step, k);
  const at = COACH_STEPS.indexOf(step);
  return `<kbd>${escape(line.key)}</kbd><span>${escape(line.text)}</span><span class="coach-dots" aria-hidden="true">${COACH_STEPS.slice(
    0,
    -1,
  )
    .map(
      (_, i) =>
        `<i class="${i < at ? "is-done" : i === at ? "is-next" : ""}"></i>`,
    )
    .join("")}</span>`;
}

export interface Coach {
  readonly running: boolean;
  start(): void;
  stop(): void;
  /** Every input sent while the coach runs. */
  note(input: Input): void;
}

export function createCoach(o: {
  host: () => HTMLElement | null;
  keys: () => CoachKeys;
  now?: () => number;
  /** All steps done (the goal line has had its time). */
  onDone?: () => void;
}): Coach {
  const now = o.now ?? (() => performance.now());
  let step: CoachStep | null = null;
  let goalAt = 0;
  let el: HTMLElement | null = null;
  const show = () => {
    if (!step) return;
    if (!el) {
      el = document.createElement("div");
      el.id = "battle-coach";
      el.className = "battle-coach";
      el.setAttribute("role", "status");
      o.host()?.append(el);
    }
    el.dataset.step = step;
    el.innerHTML = coachMarkup(step, o.keys());
  };
  const stop = () => {
    step = null;
    el?.remove();
    el = null;
  };
  return {
    get running() {
      return step !== null;
    },
    start() {
      if (step) return;
      step = "move";
      show();
    },
    stop,
    note(input) {
      if (!step) return;
      if (step === "goal") {
        if (now() - goalAt >= COACH_GOAL_MS) {
          stop();
          o.onDone?.();
        }
        return;
      }
      const next = coachAdvance(step, input);
      if (!next) return;
      step = next;
      if (next === "goal") goalAt = now();
      show();
    },
  };
}
