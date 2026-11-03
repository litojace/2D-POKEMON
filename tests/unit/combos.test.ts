import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  CHARACTERS,
  COMBOS,
  FIGHTER_IDS,
  hasMark,
  type CharacterId,
} from "@arena/shared";

const duel = (one: CharacterId, two: CharacterId = "terradon") => {
  const arena = new Arena("COMBO");
  arena.add("one", "One", one);
  arena.add("two", "Two", two);
  arena.start();
  arena.phase = "playing";
  arena.deadline = 999;
  const [p, q] = arena.players;
  Object.assign(p, { x: 600, y: 150, angle: 0 });
  Object.assign(q, { x: 700, y: 150 });
  return { arena, p, q };
};
const skill = (c: CharacterId, id: string) =>
  [CHARACTERS[c].basic, ...CHARACTERS[c].skills].find((a) => a.id === id)!;
/** Damage dealt by one payoff hit, primed or not. */
const payoffDamage = (c: CharacterId, primed: boolean) => {
  const { arena, p, q } = duel(c);
  const combo = COMBOS[c];
  if (primed) arena.status(combo.self ? p : q, "mark", 2, p.id);
  const before = q.hp;
  arena.damage(q, 20, p.id, skill(c, combo.payoff));
  return before - q.hp;
};

describe("signature combos", () => {
  it("every fighter has one, naming real skills of its own kit", () => {
    for (const id of FIGHTER_IDS) {
      const combo = COMBOS[id];
      const ids = CHARACTERS[id].skills.map((a) => a.id);
      expect(ids).toContain(combo.setup);
      expect(ids).toContain(combo.payoff);
      expect(combo.setup).not.toBe(combo.payoff);
      expect(combo.text.length).toBeGreaterThan(20);
    }
  });
  it("the setup marks the target, for the attacker only", () => {
    const { arena, p, q } = duel("tidefin");
    arena.damage(q, 4, p.id, skill("tidefin", "eddy"));
    expect(hasMark(q, p.id, arena.time)).toBe(true);
    expect(hasMark(q, q.id, arena.time)).toBe(false);
    arena.time += COMBOS.tidefin.window + 0.1;
    expect(hasMark(q, p.id, arena.time)).toBe(false);
  });
  it("a payoff on a marked target hits harder and spends the mark", () => {
    for (const id of [
      "tidefin",
      "cindrake",
      "mystowl",
      "terradon",
      "duskveil",
    ] as const) {
      const plain = payoffDamage(id, false);
      const boosted = payoffDamage(id, true);
      expect(boosted).toBeCloseTo(
        Math.min(CHARACTERS.terradon.health, plain * COMBOS[id].damage!),
      );
    }
    const { arena, p, q } = duel("tidefin");
    arena.status(q, "mark", 2, p.id);
    arena.damage(q, 20, p.id, skill("tidefin", "riptide-wave"));
    expect(hasMark(q, p.id, arena.time)).toBe(false);
    expect(arena.events[arena.events.length - 1]?.combo).toBe("Soaked");
  });
  it("someone else's mark doesn't count", () => {
    const { arena, p, q } = duel("tidefin");
    arena.status(q, "mark", 2, "somebody-else");
    const before = q.hp;
    arena.damage(q, 20, p.id, skill("tidefin", "riptide-wave"));
    expect(before - q.hp).toBe(20);
    expect(arena.events[arena.events.length - 1]?.combo).toBeUndefined();
  });
  it("Voltkit's Static Lance stuns instead of paralysing after Static Glide, even though it lands later", () => {
    const lance = skill("voltkit", "static-lance");
    const throwLance = (glideFirst: boolean) => {
      const { arena, p, q } = duel("voltkit");
      // Out of the takeoff pop's reach, so only the lance lands.
      Object.assign(q, { x: 1000, y: 150 });
      if (glideFirst) {
        arena.cast(p, skill("voltkit", "static-glide"));
        expect(hasMark(p, p.id, arena.time)).toBe(true);
      }
      const before = q.hp;
      arena.cast(p, lance);
      // A self mark is spent by casting the payoff; the shot carries it.
      expect(hasMark(p, p.id, arena.time)).toBe(false);
      for (let k = 0; k < 30 && q.hp === before; k++) arena.tick();
      return { arena, q, dealt: before - q.hp };
    };
    const plain = throwLance(false);
    expect(plain.q.statuses.some((s) => s.kind === "paralysis")).toBe(true);
    const charged = throwLance(true);
    expect(charged.q.statuses.some((s) => s.kind === "stun")).toBe(true);
    expect(charged.q.statuses.some((s) => s.kind === "paralysis")).toBe(false);
    expect(charged.dealt).toBeCloseTo(plain.dealt * COMBOS.voltkit.damage!);
    expect(charged.arena.events.some((e) => e.combo === "Charged")).toBe(true);
  });
  it("Lumoth's Radiant Flare is wider while Kindled, then the mark is spent", () => {
    const flare = skill("lumoth", "radiant-flare");
    const reach = flare.radius * 1.15;
    const hit = (kindle: boolean) => {
      const { arena, p, q } = duel("lumoth");
      Object.assign(q, { x: p.x + reach, y: p.y });
      if (kindle) arena.cast(p, skill("lumoth", "kindle"));
      const before = q.hp;
      arena.cast(p, flare);
      return { dealt: before - q.hp, marked: hasMark(p, p.id, arena.time) };
    };
    expect(hit(false).dealt).toBe(0);
    const kindled = hit(true);
    expect(kindled.dealt).toBeGreaterThan(0);
    expect(kindled.marked).toBe(false);
  });
  it("Auralynx is primed by absorbing a hit with Facet Guard", () => {
    const { arena, p, q } = duel("auralynx", "voltkit");
    arena.cast(p, skill("auralynx", "facet-guard"));
    expect(hasMark(p, p.id, arena.time)).toBe(false);
    arena.damage(p, 10, q.id, CHARACTERS.voltkit.basic);
    expect(hasMark(p, p.id, arena.time)).toBe(true);
    const before = q.hp;
    arena.cast(p, skill("auralynx", "shatter-paw"));
    expect(before - q.hp).toBeCloseTo(28 * COMBOS.auralynx.damage!);
    expect(hasMark(p, p.id, arena.time)).toBe(false);
  });
  it("Duskveil's Ghostfire lights the target up for Shade Crawl", () => {
    const { arena, p, q } = duel("duskveil");
    arena.damage(q, 6, p.id, skill("duskveil", "ghostfire"));
    expect(hasMark(q, p.id, arena.time)).toBe(true);
    const before = q.hp;
    arena.damage(q, 20, p.id, skill("duskveil", "shade-crawl"));
    expect(before - q.hp).toBeCloseTo(20 * COMBOS.duskveil.damage!);
    expect(arena.events[arena.events.length - 1]?.combo).toBe("Lit");
    expect(hasMark(q, p.id, arena.time)).toBe(false);
  });
});
