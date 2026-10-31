import { drawSomnara } from "../../apps/client/src/raid-somnara-art";
import { describe, it, expect, vi } from "vitest";
import {
  CHARACTERS,
  blankInput,
  type CharacterId,
  packSnapshot,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { SomnaraArena } from "../../apps/server/src/raid-somnara";
import {
  DREAM_RUNES,
  SOMNARA,
  RAID_BOSSES,
  RAID_BOSS_ATTACKS,
  ritesFor,
  somnaraSequenceLength,
  quietZoneAt,
  type RaidAttack,
  type DreamRune,
} from "../../packages/shared/src/raid";
import { dreamRuneKey } from "../../apps/client/src/somnara-controls";
import {
  raidCue,
  featureLabel,
  raidContributions,
} from "../../apps/client/src/raid-presentation";
const setup = (chars: CharacterId[] = ["voltkit"], peril = 1) => {
  const a = createRaidArena("DREAM", "somnara") as SomnaraArena;
  chars.forEach((c, i) => a.add(`p${i}`, `Player ${i}`, c));
  a.configure(peril, false);
  a.start();
  a.phase = "playing";
  a.raid.gilded = false;
  a.raid.trait = "starry-night";
  (a as any).started = true;
  (a as any).nextAttack = Infinity;
  return a;
};
const run = (a: SomnaraArena, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) a.tick();
};
const attack = (a: SomnaraArena, kind: RaidAttack) =>
  (a as any).startAttack(kind, a.heroes()[0]);
const sequence = (a: SomnaraArena) => {
  const d = a.raid.dream!,
    view = a.dreamFor(d.dreamerId)!;
  return view.backwards ? [...view.runes].reverse() : view.runes;
};
const enter = (a: SomnaraArena, rune: DreamRune, who = a.heroes()[0]) => {
  Object.assign(who, { x: 800, y: 700, lastInput: blankInput() });
  run(a, 0.35);
  const pad = SOMNARA.pads.find((p) => p.rune === rune)!;
  Object.assign(who, { x: pad.x, y: pad.y });
  a.tick();
};
const solve = (a: SomnaraArena) => {
  for (const rune of sequence(a)) enter(a, rune);
};
const addStacks = (a: SomnaraArena, id: string, n = 3, bubble = false) => {
  for (let i = 0; i < n; i++)
    (a as any).addDrowsy(
      a.heroes().find((p) => p.id === id),
      bubble,
    );
};

describe("Somnara's encounter", () => {
  it("is playable on a wall-free Cloud Deck, with its own phases, attacks and themed rite", () => {
    const a = setup(["voltkit", "terradon"]);
    expect(a).toBeInstanceOf(SomnaraArena);
    expect(RAID_BOSSES.somnara.playable).toBe(true);
    expect(a.arenaId).toBe("cloud-deck");
    expect(a.walls()).toEqual([]);
    expect(a.raid.pillars).toEqual([]);
    expect(
      a.raid.maxHp / (a.raid.maxHp > 2200 ? SOMNARA.health.gilded : 1),
    ).toBeCloseTo(2050, 0);
    expect(ritesFor("somnara")).toContain("lucid");
    expect(ritesFor("grumblecrag")).not.toContain("lucid");
    for (const phase of [1, 2, 3]) {
      a.raid.phase = phase;
      for (const kind of (a as any).pattern())
        expect(RAID_BOSS_ATTACKS.somnara).toContain(kind);
    }
  });
  it("gives solo shorter sequences and 14 seconds; teams get 10 seconds", () => {
    for (const peril of [1, 2, 3]) {
      expect(somnaraSequenceLength(2, peril, 1, "starry-night")).toBe(
        somnaraSequenceLength(2, peril, 4, "starry-night") - 1,
      );
    }
    for (const chars of [
      ["voltkit"],
      ["voltkit", "terradon"],
    ] as CharacterId[][]) {
      const a = setup(chars);
      attack(a, "dream-sequence");
      expect(a.raid.dream!.until - a.time).toBe(chars.length === 1 ? 14 : 10);
      const seq = sequence(a);
      expect(seq.every((r, i) => !i || r !== seq[i - 1])).toBe(true);
    }
    expect(somnaraSequenceLength(2, 3, 4, "deep-slumber")).toBe(6);
    expect(somnaraSequenceLength(2, 3, 4, "restless-dream")).toBe(4);
  });
  it("keeps the full sequence out of public snapshots and grants only Lucid's first-rune hint", () => {
    const a = setup(["voltkit", "lumoth"]);
    attack(a, "dream-sequence");
    const d = a.raid.dream!,
      other = a.heroes().find((p) => p.id !== d.dreamerId)!;
    expect(a.dreamFor(d.dreamerId)?.full).toBe(true);
    expect(a.dreamFor(other.id)).toBeUndefined();
    expect(a.dreamFor("spectator")).toBeUndefined();
    expect(JSON.stringify(packSnapshot(a.snapshot()))).not.toMatch(
      /"runes"|"sequence"/,
    );
    a.raid.rites[other.id] = ["lucid"];
    expect(a.dreamFor(other.id)).toMatchObject({
      full: false,
      runes: [sequence(a)[0]],
      backwards: false,
    });
    expect(a.dreamFor(other.id)!.runes).toHaveLength(1);
  });
  it("accepts one pad entry per step, exposes the heart, and credits correct rune contributions", () => {
    const a = setup();
    attack(a, "dream-sequence");
    const count = sequence(a).length;
    solve(a);
    expect(a.raid.dream).toBeUndefined();
    expect(a.raid.dreamsSolved).toBe(1);
    expect(a.raid.exposedUntil - a.time).toBeCloseTo(6, 1);
    expect(a.raid.contributions!.p0.pillars).toBe(count);
    expect(a.dreamFor("p0")).toBeUndefined();
    const boss = a.boss()!,
      before = boss.hp;
    a.damage(boss, 10, "p0");
    expect(before - boss.hp).toBeCloseTo(16);
  });
  it("does not count someone already standing on a pad when the dream starts", () => {
    const a = setup();
    Object.assign(a.heroes()[0], SOMNARA.pads[0]);
    attack(a, "dream-sequence");
    run(a, 0.7);
    expect(a.raid.dream!.step).toBe(0);
    expect(a.raid.dreamMistakes).toBe(0);
  });
  it("bursts a Nightmare on a wrong rune and changes Dreamer without leaking the new sequence", () => {
    const a = setup(["voltkit", "lumoth"]);
    attack(a, "dream-sequence");
    const old = a.raid.dream!,
      wrong = DREAM_RUNES.find((r) => r !== sequence(a)[0])!;
    enter(a, wrong);
    expect(a.raid.dreamMistakes).toBe(1);
    expect(a.raid.dream!.dreamerId).not.toBe(old.dreamerId);
    expect(a.heroes().every((p) => p.hp < CHARACTERS[p.character].health)).toBe(
      true,
    );
    expect(a.dreamFor(old.dreamerId)).toBeUndefined();
    expect(a.raid.dream!.step).toBe(0);
  });
  it("times out, reassigns a downed Dreamer, and never awards the feat without solving", () => {
    const a = setup(["voltkit", "lumoth"]);
    attack(a, "dream-sequence");
    a.raid.dream!.until = a.time;
    a.tick();
    expect(a.raid.dreamMistakes).toBe(1);
    const old = a.raid.dream!.dreamerId;
    a.heroes().find((p) => p.id === old)!.hp = 0;
    a.tick();
    expect(a.raid.dream!.dreamerId).not.toBe(old);
    a.raid.result = "victory";
    expect(a.feat()).toBe(false);
  });
  it("extends Deep Slumber's exposure and offers backwards dreams only in the final Peril 3 chapter", () => {
    const a = setup(["voltkit"], 3);
    a.raid.trait = "deep-slumber";
    attack(a, "dream-sequence");
    expect(a.raid.dream!.backwards).toBe(false);
    solve(a);
    expect(a.raid.exposedUntil - a.time).toBeCloseTo(8, 1);
    a.raid.phase = 3;
    const random = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation((buffer: any) => {
        buffer.fill(1);
        return buffer;
      });
    try {
      (a as any).beginDream();
      expect(a.raid.dream!.backwards).toBe(true);
      const view = a.dreamFor("p0")!;
      expect(sequence(a)).toEqual([...view.runes].reverse());
      solve(a);
      expect(a.raid.dreamsSolved).toBe(2);
    } finally {
      random.mockRestore();
    }
  });
  it("clears private dreams, sleep and attacks on chapter breaks, practice switches and retry", () => {
    const a = setup();
    attack(a, "dream-sequence");
    addStacks(a, "p0");
    a.damage(a.boss()!, 1e6, "p0");
    a.tick();
    expect(a.raid.phase).toBe(2);
    expect(a.phase).toBe("playing");
    expect(a.raid.dream).toBeUndefined();
    expect(a.dreamFor("p0")).toBeUndefined();
    expect(a.heroes()[0].statuses.some((s) => s.kind === "sleep")).toBe(false);
    a.phase = "playing";
    a.raid.drill = "dream-sequence";
    attack(a, "dream-sequence");
    expect(a.setDrill("lullaby")).toBe(true);
    expect(a.raid.dream).toBeUndefined();
  });
});

describe("Drowsy, sleep, bubbles and champion tricks", () => {
  it("sleeps after three stacks, stops moving, and wakes naturally after two seconds", () => {
    const a = setup();
    const p = a.heroes()[0];
    addStacks(a, p.id);
    expect(a.has(p, "sleep")).toBe(true);
    expect(a.raid.drowsy![p.id].stacks).toBe(0);
    const x = p.x;
    p.lastInput = { ...blankInput(), dx: 1 };
    run(a, 0.5);
    expect(p.x).toBe(x);
    run(a, 1.7);
    expect(a.has(p, "sleep")).toBe(false);
  });
  it("wakes from an ally's melee hit without taking friendly damage or losing Hibernate", () => {
    const a = setup(["cindrake", "terradon"]);
    const [p, ally] = a.heroes();
    ally.x = p.x + 100;
    ally.y = p.y;
    p.angle = 0;
    addStacks(a, ally.id);
    a.status(ally, "sleep", 5); // Adds/refreshes the boss's sleep; add a separate Hibernate below.
    ally.statuses.push({
      kind: "sleep",
      until: a.time + 5,
      nextTick: a.time + 5,
      amount: 1,
    });
    const hp = ally.hp;
    a.cast(p, CHARACTERS.cindrake.basic);
    expect(ally.hp).toBe(hp);
    expect(ally.statuses.filter((s) => s.kind === "sleep")).toHaveLength(1);
    expect(ally.statuses.find((s) => s.kind === "sleep")!.amount).toBe(1);
  });
  it("wakes from a friendly projectile and Ember Gust; enemy damage wakes it at normal damage", () => {
    const a = setup(["voltkit", "cindrake"]);
    const [p, ally] = a.heroes();
    addStacks(a, ally.id);
    a.projectiles.push({
      id: 999,
      owner: p.id,
      x: ally.x - 30,
      y: ally.y,
      vx: 900,
      vy: 0,
      remaining: 100,
      color: 0xffffff,
      ability: CHARACTERS.voltkit.basic,
    });
    a.tick();
    expect(a.has(ally, "sleep")).toBe(false);
    addStacks(a, p.id);
    ally.angle = Math.atan2(p.y - ally.y, p.x - ally.x);
    a.cast(ally, CHARACTERS.cindrake.skills[0]);
    expect(a.has(p, "sleep")).toBe(false);
    addStacks(a, p.id);
    const hp = p.hp;
    a.damage(p, 10, a.boss()!.id);
    expect(hp - p.hp).toBeCloseTo(10);
  });
  it("Lucid blocks bubble Drowsy but still allows ring Drowsy", () => {
    const a = setup();
    a.raid.rites.p0 = ["lucid"];
    addStacks(a, "p0", 3, true);
    expect(a.raid.drowsy?.p0).toBeUndefined();
    addStacks(a, "p0", 1);
    expect(a.raid.drowsy!.p0.stacks).toBe(1);
  });
  it("pops bubbles with projectile sweeps, melee attacks and Shade Crawl's trail", () => {
    const a = setup(["cindrake", "duskveil"]),
      p = a.heroes()[0];
    a.raid.dreamBubbles = [{ id: 100, x: p.x + 80, y: p.y, until: 99 }];
    p.angle = 0;
    a.cast(p, CHARACTERS.cindrake.basic);
    expect(a.raid.dreamBubbles).toHaveLength(0);
    a.raid.dreamBubbles = [{ id: 101, x: 800, y: 700, until: 99 }];
    a.projectiles.push({
      id: 1000,
      owner: p.id,
      x: 760,
      y: 700,
      vx: 2000,
      vy: 0,
      remaining: 300,
      color: 0xffffff,
      ability: CHARACTERS.voltkit.basic,
    });
    a.tick();
    expect(a.raid.dreamBubbles).toHaveLength(0);
    const shade = a.heroes()[1];
    a.status(shade, "stealth", 2);
    a.raid.dreamBubbles = [{ id: 102, x: shade.x + 20, y: shade.y, until: 99 }];
    a.tick();
    expect(a.raid.dreamBubbles).toHaveLength(0);
    expect(a.raid.dreamTrails!.length).toBeGreaterThan(0);
  });
  it("Thoughtstrike reveals only the current sequence to the team; a new dream restores privacy", () => {
    const a = setup(["mystowl", "lumoth"]);
    attack(a, "dream-sequence");
    a.cast(
      a.heroes()[0],
      CHARACTERS.mystowl.skills.find((s) => s.id === "thoughtstrike")!,
    );
    expect(a.heroes().every((p) => a.dreamFor(p.id)?.full)).toBe(true);
    (a as any).beginDream();
    const other = a.heroes().find((p) => p.id !== a.raid.dream!.dreamerId)!;
    expect(a.dreamFor(other.id)).toBeUndefined();
    expect(JSON.stringify(a.snapshot())).not.toContain('"runes"');
  });
  it("lets a new Tidefin clone enter a correct pad and credits its owner", () => {
    const a = setup(["tidefin"]);
    attack(a, "dream-sequence");
    run(a, 0.4);
    const pad = SOMNARA.pads.find((p) => p.rune === sequence(a)[0])!;
    a.heroes()[0].clone = { x: pad.x, y: pad.y, until: a.time + 3 };
    a.tick();
    expect(a.raid.dream!.step).toBe(1);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
  });
});

describe("Somnara's attacks, controls and progression", () => {
  it("hits once per expanding ring and lets jumps dodge it", () => {
    const a = setup(["voltkit", "terradon"]),
      [p, q] = a.heroes();
    Object.assign(p, { x: 900, y: 370 });
    Object.assign(q, { x: 900, y: 370, jumpUntil: 10 });
    a.raid.dreamRings = [
      { id: 500, x: 800, y: 370, radius: 0, startedAt: a.time },
    ];
    run(a, 0.7);
    expect(a.raid.drowsy!.p0.stacks).toBe(1);
    expect(a.raid.drowsy!.p1).toBeUndefined();
    const hp = p.hp;
    run(a, 0.7);
    expect(p.hp).toBe(hp);
  });
  it("damages only the tail lane and constellation points", () => {
    const a = setup(["voltkit", "terradon"]),
      [p, q] = a.heroes();
    Object.assign(p, { x: 800, y: 600 });
    Object.assign(q, { x: 300, y: 750 });
    (a as any).resolveWarning(
      { kind: "tail-splash", x: 800, y: 370, tx: 800, ty: 700, radius: 57.5 },
      a.boss(),
    );
    expect(p.hp).toBeLessThan(CHARACTERS[p.character].health);
    expect(q.hp).toBe(CHARACTERS[q.character].health);
    const hp = q.hp;
    (a as any).resolveWarning(
      { kind: "falling-stars", x: q.x, y: q.y, radius: 64 },
      a.boss(),
    );
    expect(q.hp).toBeLessThan(hp);
  });
  it("protects everyone following the moving Quiet Zone and increases its radius on Starry Night", () => {
    const a = setup(["voltkit", "terradon"]);
    attack(a, "whale-song");
    expect(a.raid.quietZone!.radius).toBe(SOMNARA.song.radius[1] + 35);
    const [safe, outside] = a.heroes();
    const hp = safe.hp,
      other = outside.hp;
    outside.x = 1500;
    outside.y = 800;
    for (let i = 0; i < 125; i++) {
      if (a.raid.quietZone)
        Object.assign(safe, quietZoneAt(a.raid.quietZone, a.time));
      a.tick();
    }
    expect(safe.hp).toBe(hp);
    expect(outside.hp).toBeLessThan(other - 28);
    expect(outside.hp).toBeGreaterThan(other - 32);
    expect(a.raid.quietZone).toBeUndefined();
  });
  it("keeps all constellation points distinct and inside the arena at its corners", () => {
    for (const [x, y] of [
      [30, 30],
      [1570, 30],
      [30, 870],
      [1570, 870],
    ]) {
      const a = setup();
      Object.assign(a.heroes()[0], { x, y });
      attack(a, "falling-stars");
      const stars = a.raid.warnings.filter((w) => w.kind === "falling-stars");
      expect(stars).toHaveLength(7);
      expect(new Set(stars.map((w) => `${w.x}:${w.y}`)).size).toBe(7);
      for (const w of stars) {
        expect(w.x).toBeGreaterThanOrEqual(100);
        expect(w.x).toBeLessThanOrEqual(1500);
        expect(w.y).toBeGreaterThanOrEqual(100);
        expect(w.y).toBeLessThanOrEqual(800);
      }
    }
  });
  it("counts a full Whale Song practice channel as one hit or dodge per raider", () => {
    const a = setup(["voltkit", "terradon"]);
    a.raid.drill = "whale-song";
    a.raid.drillStats = { hits: 0, dodges: 0 };
    attack(a, "whale-song");
    const [safe, outside] = a.heroes();
    outside.x = 1500;
    outside.y = 800;
    for (let i = 0; i < 125; i++) {
      if (a.raid.quietZone)
        Object.assign(safe, quietZoneAt(a.raid.quietZone, a.time));
      a.tick();
    }
    expect(a.raid.drillStats).toEqual({ hits: 1, dodges: 1 });
  });
  it("offers 1–4 only to the active Dreamer and keeps other controls untouched", () => {
    const a = setup(["voltkit", "lumoth"]);
    attack(a, "dream-sequence");
    const d = a.raid.dream!;
    expect(dreamRuneKey(a.snapshot(), d.dreamerId, "Digit1")).toBe("circle");
    expect(dreamRuneKey(a.snapshot(), d.dreamerId, "Digit4")).toBe("wave");
    expect(dreamRuneKey(a.snapshot(), "nobody", "Digit1")).toBeUndefined();
    expect(dreamRuneKey(a.snapshot(), d.dreamerId, "KeyQ")).toBeUndefined();
    expect(a.callRune("nobody", "circle")).toBe(false);
    expect(a.callRune(d.dreamerId, "circle")).toBe(true);
    expect(a.callRune(d.dreamerId, "star")).toBe(false);
    run(a, 0.35);
    expect(a.callRune(d.dreamerId, "star")).toBe(true);
    expect(a.raid.runeCalls!.at(-1)?.step).toBe(0);
  });
  it("shows Somnara cues and rune contributions without mountain terminology", () => {
    const a = setup();
    attack(a, "dream-sequence");
    const snapshot = { ...a.snapshot(), raidDream: a.dreamFor("p0") };
    expect(raidCue(snapshot, "p0")).toContain("Dreamer");
    expect(featureLabel("somnara")).toBe("Runes");
    const html = raidContributions(snapshot);
    expect(html).toContain("Correct runes");
    expect(html).not.toContain("Pillars credit");
    addStacks(a, "p0");
    expect(raidCue(a.snapshot(), "p0")).toContain("Asleep");
  });
});

describe("Somnara stand-ins and a full raid", () => {
  it("can walk and dash a slow solo fighter through a final Peril 3 Deep Slumber dream", () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = setup(["terradon"], 3);
      a.raid.phase = 3;
      a.raid.trait = "deep-slumber";
      a.standIn("p0");
      attack(a, "dream-sequence");
      run(a, 13.95);
      expect(
        a.raid.dreamsSolved,
        JSON.stringify({
          dream: a.raid.dream,
          pos: a.heroes()[0],
          mistakes: a.raid.dreamMistakes,
        }),
      ).toBeGreaterThan(0);
      expect(a.raid.dreamMistakes).toBe(0);
    }
  });
  it("runs every chapter and attack with stand-ins without stuck dreams or invalid positions", () => {
    const a = createRaidArena("SLEEP", "somnara") as SomnaraArena;
    for (const [i, c] of (
      ["voltkit", "cindrake", "tidefin", "mystowl"] as CharacterId[]
    ).entries())
      a.add(`b${i}`, `Bot ${i}`, c);
    a.configure(3, false);
    a.start();
    a.raid.trait = "starry-night";
    a.heroes().forEach((p) => a.standIn(p.id));
    a.phase = "playing";
    const seen = new Set<string>();
    let finalFor = 0,
      dreams = 0;
    const chip = a.raid.maxHp / 3 / 75 / 30;
    for (let t = 0; t < 470 && !a.raid.result && finalFor < 75; t += 1 / 30) {
      const boss = a.boss()!,
        before = boss.hp;
      a.tick();
      boss.hp = before - (a.phase === "playing" ? chip : 0);
      for (const w of a.raid.warnings) seen.add(w.kind);
      if (a.raid.dream) seen.add("dream-sequence");
      dreams = Math.max(dreams, a.raid.dreamsSolved ?? 0);
      if (a.phase === "intermission")
        for (const [id, offer] of Object.entries(a.raid.offers))
          a.pickRite(id, offer[0]);
      // Combat balance is covered separately; hold health here to exercise all mechanics.
      for (const p of a.heroes()) {
        p.hp = CHARACTERS[p.character].health;
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      if (a.raid.phase === 3) finalFor += 1 / 30;
    }
    expect(a.raid.phase).toBe(3);
    expect(dreams).toBeGreaterThan(1);
    for (const kind of RAID_BOSS_ATTACKS.somnara!)
      expect(seen, kind).toContain(kind);
  });
});

it("restores Somnara's normal pose on a daily retry with the same seed", () => {
  const a = setup();
  const seed = a.raid.seed;
  const bodies: number[] = [];
  const g: any = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args: number[]) => {
          if (method === "fillEllipse" && args[2] === 250 && args[3] === 144)
            bodies.push(args[1]);
          return g;
        },
    },
  );
  drawSomnara(g, a.snapshot(), false, 0);
  a.phase = "finished";
  a.raid.result = "victory";
  for (let frame = 1; frame <= 40; frame++)
    drawSomnara(g, a.snapshot(), false, frame * 0.05);
  expect(bodies.at(-1)!).toBeLessThan(a.boss()!.y - 100);
  a.start();
  a.raid.seed = seed;
  a.phase = "playing";
  drawSomnara(g, a.snapshot(), false, 3);
  expect(bodies.at(-1)).toBeCloseTo(a.boss()!.y - 62);
});
