import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  RULES,
  blankInput,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// Five skills the skill audit found did little (switching one off barely
// changed its champion's win rate): docs/balance-overhaul.md, "Five weak
// skills reworked".

const arena = (me: CharacterId, them: CharacterId = "terradon") => {
  const a = new Arena("REWORK", "duel");
  a.add("me", "Me", me);
  a.add("them", "Them", them);
  a.start();
  a.phase = "playing";
  a.deadline = 999;
  return a;
};
const place = (p: Fighter, x: number, y: number, aimX = x + 100, aimY = y) => {
  Object.assign(p, { x, y, vx: 0, vy: 0 });
  p.lastInput = { ...blankInput(), aimX, aimY };
  p.angle = Math.atan2(aimY - y, aimX - x);
};
const seconds = (a: Arena, s: number) => {
  for (let i = 0; i < Math.round(RULES.tick * s); i++) a.tick();
};
const skill = (c: CharacterId, id: string) =>
  CHARACTERS[c].skills.find((k) => k.id === id)!;
/** Open ground on the classic arena's top row. */
const Y = 150;

describe("Riptide Wave (Tidefin): two walls of water", () => {
  it("rolls a second wall after the first, so one jump can't clear both", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    const w = skill("tidefin", "riptide-wave");
    place(me, 200, Y, 1500, Y);
    place(them, 700, Y);
    const hp = them.hp;
    a.cast(me, w);
    // Jump the first wall as it reaches it (500 px at 650 px/s).
    seconds(a, 500 / w.speed - 0.15);
    them.jumpUntil = a.time + RULES.jumpDuration;
    seconds(a, 0.5);
    expect(them.hp).toBe(hp);
    // The second wall follows w.wave.second later: still on the ground, hit.
    seconds(a, w.wave!.second! + 0.2);
    expect(hp - them.hp).toBe(w.damage);
    expect(a.zones.filter((z) => z.ability.id === w.id)).toHaveLength(2);
  });

  it("sends only one second wall", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    const w = skill("tidefin", "riptide-wave");
    place(me, 200, Y, 1500, Y);
    place(them, 1400, Y + 600);
    a.cast(me, w);
    let most = 0;
    for (let i = 0; i < RULES.tick * 4; i++) {
      a.tick();
      most = Math.max(
        most,
        a.zones.filter((z) => z.ability.id === w.id).length,
      );
    }
    expect(most).toBe(2);
    expect(a.zones.filter((z) => z.ability.id === w.id)).toHaveLength(0);
  });
});

describe("Frost Breath (Glacelle): held in it, frozen", () => {
  it("freezes an enemy that stays in the breath, once", () => {
    const a = arena("glacelle");
    const [me, them] = a.players;
    const b = skill("glacelle", "frost-breath");
    place(me, 300, Y, 500, Y);
    place(them, 450, Y);
    a.cast(me, b);
    // Ticks at 0.1, 0.3, 0.5 s: the third freezes.
    seconds(a, 0.42);
    expect(a.has(them, "freeze")).toBe(false);
    seconds(a, 0.12);
    expect(a.has(them, "freeze")).toBe(true);
    const until = them.statuses.find((s) => s.kind === "freeze")!.until;
    expect(until - a.time).toBeLessThanOrEqual(b.cone!.freezeFor! + 1e-6);
    // Still in the breath afterwards: no second freeze.
    seconds(a, b.cone!.freezeFor! + 0.05);
    expect(a.has(them, "freeze")).toBe(false);
  });

  it("only slows an enemy that steps out in time", () => {
    const a = arena("glacelle");
    const [me, them] = a.players;
    place(me, 300, Y, 500, Y);
    place(them, 450, Y);
    a.cast(me, skill("glacelle", "frost-breath"));
    const hp = them.hp;
    // Two ticks (0.1 s, 0.3 s), then out of the breath before the third.
    seconds(a, 0.35);
    expect(them.hp).toBeLessThan(hp);
    expect(a.has(them, "slow")).toBe(true);
    place(them, 450, Y + 400);
    seconds(a, 0.7);
    expect(a.has(them, "freeze")).toBe(false);
  });
});

describe("Crest Flare (Cindrake): the flame reaches further", () => {
  it("reaches an enemy that stepped back only later in the breath", () => {
    const a = arena("cindrake");
    const [me, them] = a.players;
    const f = skill("cindrake", "crest-flare");
    const far = f.range + f.cone!.grow! * 0.8;
    place(me, 300, Y, 900, Y);
    place(them, 300 + far, Y);
    const hp = them.hp;
    a.cast(me, f);
    seconds(a, f.duration * 0.4);
    expect(them.hp).toBe(hp);
    seconds(a, f.duration * 0.55);
    expect(them.hp).toBeLessThan(hp);
  });
});

describe("Scale Shrapnel (Pangrove): blades even without plates", () => {
  it("throws count blades, plus perPlate for each plate", () => {
    const s = skill("pangrove", "scale-shrapnel");
    for (const plates of [0, 3]) {
      const a = arena("pangrove");
      const [me] = a.players;
      place(me, 300, Y);
      me.plates = plates;
      a.cast(me, s);
      const blades = a.projectiles.filter((p) => p.ability.id === s.id);
      expect(blades).toHaveLength(s.count! + s.perPlate! * plates);
      expect(me.plates).toBe(0);
    }
  });
});

describe("Shell Up (Terradon): the shell bursts open", () => {
  it("shoves away an enemy close by when it ends, not one far off", () => {
    for (const [gap, shoved] of [
      [100, true],
      [400, false],
    ] as const) {
      const a = arena("terradon", "glacelle");
      const [me, them] = a.players;
      const s = skill("terradon", "shell-up");
      place(me, 500, Y);
      place(them, 500 + gap, Y);
      a.cast(me, s);
      expect(a.has(me, "shell")).toBe(true);
      seconds(a, s.duration - 0.1);
      expect(them.x).toBe(500 + gap);
      seconds(a, 0.3);
      expect(a.has(me, "shell")).toBe(false);
      if (shoved) expect(them.x).toBeGreaterThan(500 + gap + 100);
      else expect(them.x).toBe(500 + gap);
    }
  });
});
