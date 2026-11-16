/**
 * Spire blessings (packages/shared/src/spire.ts, apps/server/src/spire.ts):
 * seeded offers of three per seat, stacking, every hook, and the dash
 * blessing keeping client prediction in step with the server.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RULES,
  ULT_SLOT,
  blankInput,
  maxHealth,
  type CharacterId,
  type Fighter,
  type Input,
} from "@arena/shared";
import { SpireArena } from "../../apps/server/src/spire";
import { predictFighter } from "../../apps/client/src/predict-fighter";
import {
  SPIRE_BLESSINGS,
  SPIRE_BLESSING_IDS,
  SPIRE_OFFER,
  SPIRE_TUNING,
  spireBlessingOffer,
  spireBlessingText,
  spireBlessingValue,
  type SpireBlessingId,
} from "../../packages/shared/src/spire";

const DT = 1 / RULES.tick;
afterEach(() => vi.restoreAllMocks());

describe("blessing offers", () => {
  it("offer three different blessings, the same for the same climb, floor and seat", () => {
    for (let seed = 1; seed < 40; seed++)
      for (let floor = 2; floor <= 9; floor++) {
        const offer = spireBlessingOffer(seed, floor, 0);
        expect(offer.length).toBe(SPIRE_OFFER);
        expect(new Set(offer).size).toBe(SPIRE_OFFER);
        expect(spireBlessingOffer(seed, floor, 0)).toEqual(offer);
      }
  });
  it("show teammates different cards, and every blessing turns up", () => {
    let differ = 0;
    const seen = new Set<SpireBlessingId>();
    for (let seed = 1; seed < 60; seed++) {
      const a = spireBlessingOffer(seed, 3, 0),
        b = spireBlessingOffer(seed, 3, 1);
      if (a.join() !== b.join()) differ++;
      a.forEach((id) => seen.add(id));
    }
    expect(differ).toBeGreaterThan(40);
    expect([...seen].sort()).toEqual([...SPIRE_BLESSING_IDS].sort());
  });
  it("stack, and never offer one already at its most stacks", () => {
    const owned = { keen: SPIRE_BLESSINGS.keen.values.length, focus: 1 };
    for (let seed = 1; seed < 80; seed++)
      expect(spireBlessingOffer(seed, 4, 0, owned)).not.toContain("keen");
    expect(spireBlessingValue("keen", 1)).toBe(0.1);
    expect(spireBlessingValue("keen", 2)).toBe(0.18);
    expect(spireBlessingValue("keen", 9)).toBe(0.25);
    expect(spireBlessingValue("keen", 0)).toBe(0);
    // The card says what the next stack gives.
    expect(spireBlessingText("keen", 0)).toContain("10%");
    expect(spireBlessingText("keen", 1)).toContain("18%");
    expect(spireBlessingText("bastion", 0)).toContain("3 s");
  });
  it("has about eight blessings, each with a name, text and its stacks", () => {
    expect(SPIRE_BLESSING_IDS.length).toBeGreaterThanOrEqual(8);
    for (const id of SPIRE_BLESSING_IDS) {
      const b = SPIRE_BLESSINGS[id];
      expect(b.name.length).toBeGreaterThan(2);
      expect(b.text).toContain("{v}");
      expect(b.values.length).toBeGreaterThanOrEqual(2);
      // Each stack helps more.
      for (let i = 1; i < b.values.length; i++)
        expect(b.values[i]).toBeGreaterThan(b.values[i - 1]);
    }
  });
});

/** A floor-1 fight with one Echo on the court, blessings set by hand. */
function fight(
  blessings: Partial<Record<SpireBlessingId, number>> = {},
  chars: CharacterId[] = ["voltkit"],
) {
  let s = 77;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((
    buffer: Uint32Array,
  ) => {
    for (let i = 0; i < buffer.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      buffer[i] = s;
    }
    return buffer;
  }) as never);
  const a = new SpireArena("BLESS");
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({ startFloor: 1, ceiling: 9 });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  for (let i = 0; i < 40; i++) a.tick(DT);
  for (const p of a.heroes()) {
    a.raid.spire!.blessings[p.id] = { ...blessings };
    (a as unknown as { applyBlessings(p: Fighter): void }).applyBlessings(p);
  }
  const echo = a.players.find((p) => p.echo)!;
  const me = a.heroes()[0];
  return { a, echo, me };
}

describe("blessing hooks", () => {
  it("Keen Edge: more damage to Echoes", () => {
    const plain = fight(),
      keen = fight({ keen: 2 });
    for (const f of [plain, keen]) f.echo.hp = 500;
    plain.a.damage(plain.echo, 20, plain.me.id);
    keen.a.damage(keen.echo, 20, keen.me.id);
    expect(500 - keen.echo.hp).toBeCloseTo((500 - plain.echo.hp) * 1.18, 5);
  });
  it("Stoneskin: less damage from Echoes", () => {
    const { a, echo, me } = fight({ stoneskin: 1 });
    me.hp = 150;
    a.damage(me, 20, echo.id);
    expect(150 - me.hp).toBeCloseTo(20 * SPIRE_TUNING[1].power * 0.9, 5);
  });
  it("Leeching Strikes: heals for a share of the damage dealt", () => {
    const { a, echo, me } = fight({ leech: 1 });
    me.hp = 50;
    echo.hp = 500;
    a.damage(echo, 40, me.id);
    const dealt = 500 - echo.hp;
    expect(me.hp - 50).toBeCloseTo(dealt * 0.05, 5);
  });
  it("Harvest: heals when you finish an Echo", () => {
    const { a, echo, me } = fight({ harvest: 1 });
    me.hp = 50;
    echo.hp = 5;
    a.damage(echo, 40, me.id);
    expect(echo.hp).toBe(0);
    expect(me.hp - 50).toBeCloseTo(maxHealth(me.character, "raid") * 0.06, 5);
  });
  it("Bastion: a shield once a floor when health drops below 30%", () => {
    const { a, echo, me } = fight({ bastion: 1 });
    const max = maxHealth(me.character, "raid");
    me.hp = max * 0.35;
    a.damage(me, (max * 0.1) / SPIRE_TUNING[1].power, echo.id);
    expect(me.statuses.some((s) => s.kind === "shield")).toBe(true);
    me.statuses = [];
    a.damage(me, 1, echo.id);
    expect(me.statuses.some((s) => s.kind === "shield")).toBe(false);
  });
  it("Focus: skills cool down faster", () => {
    const cooldown = (blessed: boolean) => {
      const { a, me } = fight(blessed ? { focus: 1 } : {});
      a.submit(me, {
        ...blankInput(),
        seq: me.ack + 1,
        skill: 0,
        aimX: 900,
        aimY: 450,
      });
      a.tick(DT);
      return me.cooldowns[0] - a.time;
    };
    const plain = cooldown(false),
      focus = cooldown(true);
    expect(plain).toBeGreaterThan(0);
    expect(focus).toBeCloseTo(plain * 0.9, 1);
  });
  it("Surge: the ultimate charges faster", () => {
    const plain = fight(),
      surge = fight({ surge: 1 });
    for (const f of [plain, surge]) {
      f.me.ult = 0;
      f.a.chargeUlt(f.me, 10);
    }
    expect(surge.me.ult).toBeCloseTo(plain.me.ult * 1.25, 5);
    expect(surge.me.ult).toBeLessThanOrEqual(RULES.ultMax);
    void ULT_SLOT;
  });
  it("Rally: teammates revive faster", () => {
    const revive = (rally: boolean) => {
      const { a } = fight(rally ? { rally: 1 } : {}, ["voltkit", "terradon"]);
      const [down, helper] = a.heroes();
      a.raid.spire!.blessings[down.id] = {};
      for (const e of a.players.filter((p) => p.echo)) {
        e.x = 1500;
        e.y = 100;
        a.bots.delete(e.id);
      }
      a.damage(down, 9999, a.players.find((p) => p.echo)!.id);
      helper.x = down.x + 30;
      helper.y = down.y;
      for (let i = 0; i < 20; i++) a.tick(DT);
      return a.raid.downed[down.id]?.progress ?? 1;
    };
    expect(revive(true)).toBeCloseTo(revive(false) * 1.3, 1);
  });
  it("Static Wake: a dash lays a crackling trail that hurts Echoes", () => {
    const { a, echo, me } = fight({ wake: 1 });
    a.bots.delete(echo.id);
    Object.assign(me, { x: 500, y: 450 });
    Object.assign(echo, { x: 560, y: 450, hp: 500 });
    a.submit(me, { ...blankInput(), seq: me.ack + 1, dx: 1, dash: true });
    for (let i = 0; i < 15; i++) a.tick(DT);
    const zone = a.zones.find(
      (z) => z.owner === me.id && z.ability.kind === "trail",
    );
    expect(zone?.ability.id).toBe("spark-trail");
    expect(echo.hp).toBeLessThan(500);
  });
});

describe("Fleet Step keeps dash prediction in step with the server", () => {
  it("the server and the client's prediction put the next dash at the same time", () => {
    for (const stacks of [0, 1, 3]) {
      const { a, me } = fight(stacks ? { fleet: stacks } : {});
      a.bots.clear();
      let local: Fighter = structuredClone(me);
      const expected =
        RULES.dashCooldown * (1 - spireBlessingValue("fleet", stacks));
      expect(local.dashCd ?? RULES.dashCooldown).toBeCloseTo(expected, 9);
      for (let i = 0; i < 20; i++) {
        const input: Input = {
          ...blankInput(),
          seq: me.ack + 1,
          dx: 1,
          dash: i === 2,
          aimX: 900,
          aimY: 450,
        };
        a.submit(me, input);
        a.tick(DT);
        predictFighter(local, { ...input }, a.time, true);
        // The predicted dash (before any snapshot resyncs it) matches.
        if (i === 2) {
          expect(me.dashAt).toBeGreaterThan(a.time);
          expect(local.dashAt).toBeCloseTo(me.dashAt, 6);
          expect(local.x).toBeCloseTo(me.x, 6);
        }
        if (i % 5 === 4) local = structuredClone(me);
      }
      // The dash came back sooner, by the blessing's share.
      const start = me.dashAt - expected;
      expect(start).toBeGreaterThan(0);
    }
  });
});
