import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation.js";
import {
  CHARACTERS,
  COMBOS,
  RULES,
  ULT_SLOT,
  blankInput,
  hasMark,
  maxHealth,
  type CharacterId,
  type Fighter,
} from "../../packages/shared/src/index.js";

// The skill revolution, wave A (docs/skill-revolution.md): Tidefin, Voltkit,
// Duskveil and Lumoth.

const arena = (me: CharacterId, them: CharacterId = "terradon") => {
  const a = new Arena("REVOLUTION", "duel");
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
const slot = (c: CharacterId, id: string) =>
  CHARACTERS[c].skills.findIndex((k) => k.id === id);
/** Cast through the input path, as a player would (cooldowns, wind-ups). */
const press = (a: Arena, p: Fighter, c: CharacterId, id: string) => {
  const s = slot(c, id);
  if (s === ULT_SLOT) p.ult = RULES.ultMax;
  p.lastInput = { ...p.lastInput, skill: s };
  a.tick();
};
/** Open ground on the classic arena's top row. */
const Y = 150;

describe("River Dash (Tidefin)", () => {
  it("dashes through an enemy, hits it once, soaks it and refunds the cooldown", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 430, Y);
    const hp = them.hp;
    press(a, me, "tidefin", "river-dash");
    seconds(a, 0.5);
    // Through it, the whole length.
    expect(me.x).toBeGreaterThan(560);
    expect(hp - them.hp).toBeCloseTo(skill("tidefin", "river-dash").damage, 5);
    expect(hasMark(them, me.id, a.time)).toBe(true);
    const left = me.cooldowns[slot("tidefin", "river-dash")] - a.time;
    expect(left).toBeLessThanOrEqual(3);
    expect(left).toBeGreaterThan(2);
  });
  it("keeps its full cooldown when it goes through nobody", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 1400, 800);
    press(a, me, "tidefin", "river-dash");
    seconds(a, 0.5);
    const left = me.cooldowns[slot("tidefin", "river-dash")] - a.time;
    expect(left).toBeGreaterThan(8);
  });
});

describe("Riptide Wave (Tidefin)", () => {
  it("crosses the court: it reaches an enemy far away, carries it and slams it into the wall", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(me, 200, Y, 1500, Y);
    place(them, 1450, Y + 60);
    const hp = them.hp;
    press(a, me, "tidefin", "riptide-wave");
    seconds(a, 2.6);
    const w = skill("tidefin", "riptide-wave");
    // The first hit and the slam (the court's edge is 126 px past it).
    expect(hp - them.hp).toBeCloseTo(w.damage * (1 + w.wallSlam!), 4);
    expect(them.x).toBeGreaterThan(1520);
    expect(a.events.some((e) => e.kind === "burst" && e.slam)).toBe(true);
  });
  it("carries an enemy in the open along with it, then lets it go", () => {
    const a = arena("tidefin");
    const [me, them] = a.players;
    place(me, 200, Y, 1500, Y);
    place(them, 400, Y);
    press(a, me, "tidefin", "riptide-wave");
    seconds(a, 1.4);
    const carry = skill("tidefin", "riptide-wave").wave!.carry;
    const speed = skill("tidefin", "riptide-wave").speed;
    expect(them.x - 400).toBeGreaterThan(speed * carry * 0.8);
    expect(them.x - 400).toBeLessThan(speed * carry * 1.25);
  });
  it("misses an enemy that jumps it, and one beside it", () => {
    for (const [y, jump] of [
      [Y, true],
      [Y + 320, false],
    ] as const) {
      const a = arena("tidefin");
      const [me, them] = a.players;
      place(me, 200, Y, 1500, Y);
      place(them, 700, y);
      const hp = them.hp;
      press(a, me, "tidefin", "riptide-wave");
      // In the air as the front passes it (0.35 s wind-up, 650 px/s).
      seconds(a, 0.35 + 400 / 650 - 0.2);
      if (jump) them.jumpUntil = a.time + 0.6;
      seconds(a, 1);
      expect(them.hp).toBe(hp);
    }
  });
});

describe("Ball Lightning (Voltkit)", () => {
  it("flies through enemies, zapping them, and bursts at the end of its flight", () => {
    const a = arena("voltkit");
    const [me, them] = a.players;
    place(me, 300, Y, 1200, Y);
    place(them, 520, Y + 60);
    const hp = them.hp;
    a.cast(me, skill("voltkit", "ball-lightning"));
    seconds(a, 0.6);
    const zaps = a.events.filter(
      (e) => e.kind === "beam" && e.abilityId === "ball-lightning",
    ).length;
    expect(zaps).toBeGreaterThanOrEqual(2);
    expect(hp - them.hp).toBeGreaterThan(0);
    // Still flying past it.
    expect(a.projectiles.some((p) => p.ability.id === "ball-lightning")).toBe(
      true,
    );
    seconds(a, 1.5);
    expect(a.projectiles.some((p) => p.ability.id === "ball-lightning")).toBe(
      false,
    );
  });
});

describe("Thunderstorm (Voltkit)", () => {
  it("strikes an enemy anywhere three times, and a stealthed one never", () => {
    for (const stealthed of [false, true]) {
      const a = arena("voltkit", "shadopus");
      const [me, them] = a.players;
      place(me, 200, Y, 300, Y);
      place(them, 1400, 750);
      if (stealthed)
        them.statuses.push({ kind: "stealth", until: a.time + 9, nextTick: 0 });
      const hp = them.hp;
      press(a, me, "voltkit", "thunderstorm");
      seconds(a, 3);
      const st = skill("voltkit", "thunderstorm");
      if (stealthed) expect(them.hp).toBe(hp);
      else expect(hp - them.hp).toBeGreaterThanOrEqual(st.damage * 3 - 0.01);
    }
  });
  it("strikes only the enemy nearest the aim when there are several", () => {
    const a = new Arena("REVOLUTION-FFA", "ffa");
    const me = a.add("me", "Me", "voltkit");
    const near = a.add("near", "Near", "terradon");
    const far = a.add("far", "Far", "terradon");
    a.start();
    a.phase = "playing";
    a.deadline = 999;
    place(me, 200, Y, 1200, 750);
    place(near, 1200, 750);
    place(far, 1400, 150);
    const [hpNear, hpFar] = [near.hp, far.hp];
    press(a, me, "voltkit", "thunderstorm");
    seconds(a, 3);
    expect(hpNear - near.hp).toBeGreaterThanOrEqual(
      skill("voltkit", "thunderstorm").damage * 3 - 0.01,
    );
    expect(far.hp).toBe(hpFar);
  });
  it("is dodged by stepping out of the mark", () => {
    const a = arena("voltkit");
    const [me, them] = a.players;
    place(me, 200, Y, 300, Y);
    place(them, 1200, 750);
    const hp = them.hp;
    press(a, me, "voltkit", "thunderstorm");
    // Each mark lands 0.55 s after it appears: move 150 px away from each.
    for (let wave = 0; wave < 3; wave++) {
      seconds(a, 0.4 + (wave ? 0 : 0.4));
      them.x += wave % 2 ? -150 : 150;
      seconds(a, 0.4);
    }
    seconds(a, 0.6);
    expect(them.hp).toBe(hp);
  });
});

describe("Shade Crawl (Duskveil)", () => {
  it("roots the first enemy it reaches; Lit, it roots longer and hits harder", () => {
    const a = arena("duskveil");
    const [me, them] = a.players;
    place(me, 300, Y, 900, Y);
    place(them, 600, Y);
    a.cast(me, skill("duskveil", "shade-crawl"));
    seconds(a, 0.4);
    const root = them.statuses.find((s) => s.kind === "root");
    expect(root).toBeDefined();
    expect(COMBOS.duskveil.status).toBe("root");
    expect(COMBOS.duskveil.statusDuration!).toBeGreaterThan(
      skill("duskveil", "shade-crawl").statusDuration!,
    );
  });
});

describe("Wraith Hunt (Duskveil)", () => {
  it("hunts the nearest enemy through walls, hurts it, and reaps it when it is low", () => {
    const a = arena("duskveil");
    const [me, them] = a.players;
    place(me, 300, 450);
    // Behind the centre block.
    place(them, 900, 450);
    const full = maxHealth("terradon");
    them.hp = full * 0.22;
    press(a, me, "duskveil", "wraith-hunt");
    seconds(a, 3.5);
    expect(them.hp).toBe(0);
    expect(a.events.some((e) => e.combo === "REAPED")).toBe(true);
  });
  it("only hurts a healthy enemy that stands in its way, and is gone after it lasts", () => {
    const a = arena("duskveil");
    const [me, them] = a.players;
    place(me, 300, 450);
    place(them, 600, 450);
    const hp = them.hp;
    press(a, me, "duskveil", "wraith-hunt");
    seconds(a, 3.5);
    expect(them.hp).toBeLessThan(hp);
    expect(them.hp).toBeGreaterThan(0);
    expect(a.zones.some((z) => z.ability.id === "wraith-hunt")).toBe(false);
  });
});

describe("Radiant Flare (Lumoth)", () => {
  it("draws enemies toward the light, then bursts and stuns them", () => {
    const a = arena("lumoth");
    const [me, them] = a.players;
    place(me, 200, Y, 700, Y);
    place(them, 880, Y);
    const hp = them.hp;
    press(a, me, "lumoth", "radiant-flare");
    seconds(a, 1.2);
    // Drawn toward the flare, which hangs at the aim.
    expect(Math.abs(them.x - 700)).toBeLessThan(120);
    seconds(a, 1.4);
    expect(hp - them.hp).toBeCloseTo(
      skill("lumoth", "radiant-flare").damage,
      4,
    );
    expect(
      a.events.some((e) => e.kind === "hit" && e.abilityId === "radiant-flare"),
    ).toBe(true);
  });
  it("is escaped by dashing out of the pull", () => {
    const a = arena("lumoth");
    const [me, them] = a.players;
    place(me, 200, Y, 700, Y);
    place(them, 720, Y);
    const hp = them.hp;
    press(a, me, "lumoth", "radiant-flare");
    seconds(a, 0.4);
    // Dash out and keep walking out.
    them.x = 1000;
    seconds(a, 2);
    expect(them.hp).toBe(hp);
  });
  it("Kindled, it pulls and bursts 25% wider", () => {
    const a = arena("lumoth");
    const [me] = a.players;
    place(me, 200, Y, 700, Y);
    a.cast(me, skill("lumoth", "kindle"));
    press(a, me, "lumoth", "radiant-flare");
    seconds(a, 0.5);
    const z = a.zones.find((q) => q.ability.id === "radiant-flare")!;
    expect(z.radius).toBeCloseTo(
      skill("lumoth", "radiant-flare").radius * 1.25,
      4,
    );
    expect(z.ability.explosion).toBeCloseTo(
      skill("lumoth", "radiant-flare").explosion! * 1.25,
      4,
    );
  });
});
