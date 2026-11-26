import { describe, expect, it } from "vitest";
import { blankInput } from "@arena/shared";
import {
  COACH_GOAL_MS,
  coachAdvance,
  coachLine,
  coachMarkup,
  createCoach,
  type CoachKeys,
} from "../../apps/client/src/battle-coach";

// The first match's coach: move, attack, skill, dash, then the goal.

// Just enough DOM for the coach: an element with children, a dataset,
// attributes and innerHTML (no DOM library in this repo's unit tests).
class El {
  children: El[] = [];
  parent: El | null = null;
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  id = "";
  className = "";
  innerHTML = "";
  append(c: El) {
    c.parent = this;
    this.children.push(c);
  }
  remove() {
    if (this.parent)
      this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  setAttribute(k: string, v: string) {
    this.attrs[k] = v;
  }
  get textContent() {
    return this.innerHTML.replace(/<[^>]+>/g, " ");
  }
}
(globalThis as { document?: unknown }).document = {
  createElement: () => new El(),
};
const line = (host: El) => host.children.find((c) => c.id === "battle-coach");
const keys: CoachKeys = {
  touch: false,
  move: "WASD",
  basic: "J",
  skills: "1 2 3 4",
  dash: "SHIFT",
};
const input = (extra: Partial<ReturnType<typeof blankInput>> = {}) => ({
  ...blankInput(),
  ...extra,
});

describe("the first match's coach", () => {
  it("moves on only when the player does the step", () => {
    expect(coachAdvance("move", input())).toBeNull();
    expect(coachAdvance("move", input({ basic: true }))).toBeNull();
    expect(coachAdvance("move", input({ dx: -1 }))).toBe("attack");
    expect(coachAdvance("attack", input({ dx: 1 }))).toBeNull();
    expect(coachAdvance("attack", input({ basic: true }))).toBe("skill");
    expect(coachAdvance("skill", input({ skill: -1 }))).toBeNull();
    expect(coachAdvance("skill", input({ skill: 0 }))).toBe("dash");
    expect(coachAdvance("dash", input({ jump: true }))).toBe("goal");
    expect(coachAdvance("goal", input({ dash: true }))).toBeNull();
  });
  it("names the player's own keys, or the touch buttons", () => {
    expect(coachLine("attack", keys).key).toBe("J");
    expect(coachLine("skill", keys).key).toBe("1 2 3 4");
    expect(coachLine("move", { ...keys, touch: true }).text).toContain("Drag");
    expect(coachLine("goal", keys).text).toContain("Win 3 rounds");
    // A new player's first match is one round, the second first to two.
    expect(coachLine("goal", { ...keys, rounds: 1 }).text).toBe(
      "Win this round to take the match!",
    );
    expect(coachLine("goal", { ...keys, rounds: 2 }).text).toContain(
      "Win 2 rounds",
    );
    // Key labels are escaped.
    expect(coachMarkup("move", { ...keys, move: "<b>" })).toContain(
      "&lt;b&gt;",
    );
  });
  it("shows one line, follows the steps, and ends after the goal", () => {
    const host = new El();
    let t = 0,
      done = 0;
    const coach = createCoach({
      host: () => host as unknown as HTMLElement,
      keys: () => keys,
      now: () => t,
      onDone: () => done++,
    });
    expect(coach.running).toBe(false);
    coach.start();
    coach.start();
    expect(host.children).toHaveLength(1);
    expect(line(host)!.dataset.step).toBe("move");
    expect(line(host)!.attrs.role).toBe("status");
    expect(line(host)!.textContent).toContain("WASD");
    coach.note(input({ dy: 1 }));
    coach.note(input({ basic: true }));
    coach.note(input({ skill: 2 }));
    expect(line(host)!.dataset.step).toBe("dash");
    expect(line(host)!.innerHTML.match(/class="is-done"/g)).toHaveLength(3);
    coach.note(input({ dash: true }));
    expect(line(host)!.dataset.step).toBe("goal");
    t = COACH_GOAL_MS - 1;
    coach.note(input());
    expect(coach.running).toBe(true);
    t = COACH_GOAL_MS;
    coach.note(input());
    expect(coach.running).toBe(false);
    expect(line(host)).toBeUndefined();
    expect(done).toBe(1);
  });
  it("goes away when stopped (the match ended or the player left)", () => {
    const host = new El();
    const coach = createCoach({
      host: () => host as unknown as HTMLElement,
      keys: () => keys,
    });
    coach.start();
    coach.stop();
    expect(host.children).toHaveLength(0);
    coach.note(input({ dx: 1 }));
    expect(host.children).toHaveLength(0);
  });
});
