/**
 * The combat scenes, shared by the website's stills (scenes.spec.ts, the
 * court only) and Instagram's (scripts/instagram/battles.spec.ts, the whole
 * phone screen with its HUD and touch controls): the real client drawing
 * the real server simulation, stepped tick by tick, with every fighter
 * firing its ultimate within a few ticks of the others.
 */
import type { Page } from "@playwright/test";

/** Ticks captured after the first cast, one frame each. */
export const TICKS = 36;
/** The court only: no HUD, buttons or banners over the fight. */
export const CLEAN = `
  #hud, #mobile-controls, #abilities, .battle-footer, #arena-overlay,
  .map-label, .topbar, #practice-controls, #spectate, #toast,
  .stadium-crowd { display: none !important; }
`;

export type Fighter = [name: string, id: string, x: number, y: number];
export type Scene = {
  name: string;
  room: [kind: "pvp" | "raid" | "spire", options: Record<string, unknown>];
  mode: "duel" | "teams" | "ffa" | "raid" | "spire";
  arena?: string;
  boss?: string;
  fighters: Fighter[];
};

export const SCENES: Scene[] = [
  {
    name: "duels",
    room: ["pvp", { mode: "duel", phase: "playing" }],
    mode: "duel",
    arena: "classic",
    fighters: [
      ["Blaze", "halcyra", 640, 600],
      ["Frost", "coilemur", 860, 580],
    ],
  },
  {
    name: "teams",
    room: ["pvp", { mode: "teams", phase: "playing" }],
    mode: "teams",
    arena: "shifting-ruins",
    fighters: [
      ["Blaze", "voltkit", 620, 560],
      ["Moss", "cindrake", 660, 440],
      ["Frost", "tidefin", 880, 550],
      ["Hoot", "glacelle", 920, 430],
    ],
  },
  {
    name: "ffa",
    room: ["pvp", { mode: "ffa", phase: "playing" }],
    mode: "ffa",
    arena: "ember-forge",
    fighters: [
      ["Blaze", "pyranda", 620, 540],
      ["Zap", "lumoth", 880, 560],
      ["Ink", "shadopus", 660, 400],
      ["Sunny", "halcyra", 900, 420],
    ],
  },
  {
    name: "raids",
    room: ["raid", { boss: "emberwing" }],
    mode: "raid",
    boss: "emberwing",
    fighters: [
      ["Blaze", "voltkit", 620, 560],
      ["Frost", "glacelle", 980, 560],
      ["Moss", "cindrake", 560, 330],
      ["Hoot", "halcyra", 1040, 330],
    ],
  },
  {
    // A real Spire floor (the harness's SpireArena): two climbers and the
    // floor's Echoes, the Echoes moved in close.
    name: "spire",
    room: ["spire", { stage: "playing", floor: 9, seats: 2 }],
    mode: "spire",
    fighters: [
      ["Blaze", "voltkit", 380, 420],
      ["Kai", "cindrake", 420, 680],
    ],
  },
];

export async function stage(page: Page, s: Scene) {
  await page.evaluate(async (s) => {
    const w = window as any;
    const m = await import("/rooms.ts");
    const spire = s.mode === "spire";
    const a: any = spire
      ? w.__spireArena
      : s.mode === "raid"
        ? m.createRaidArena("RAID42", s.boss)
        : new m.Arena("PVP123", s.mode);
    if (!spire) {
      // Carry on the event numbering, or the client skips the casts.
      a.serial = (w.__arena?.serial ?? 0) + 5000;
      if (s.arena) a.arenaId = s.arena;
      s.fighters.forEach(([name, id], i) =>
        a.add(i ? `p${i + 1}` : "me", name, id),
      );
      if (s.mode === "raid") a.configure(1);
      a.start();
      a.phase = "playing";
    }
    let heroes = a.players;
    const echoes = spire
      ? a.players.filter((e: any) => e.echo && e.hp > 0)
      : [];
    const echoSpots = [
      [900, 330],
      [1000, 540],
      [880, 760],
    ];
    if (spire) {
      heroes = a.heroes();
      // The harness's account is "tester": the same player name as the other scenes.
      heroes[0].name = s.fighters[0][0];
    }
    if (s.mode === "raid") {
      a.raid.gilded = false;
      a.nextAttack = 1e6;
      if (s.boss === "emberwing") a.takeoff();
      a.boss().hp *= 0.72;
      heroes = a.heroes();
    }
    heroes.forEach((h: any, i: number) => {
      h.x = s.fighters[i][2];
      h.y = s.fighters[i][3];
    });
    const full = heroes.map((h: any) => h.hp);
    const echoFull = echoes.map((e: any) => e.hp);
    w.__arena = a;
    w.__shot = {
      a,
      m,
      tick: 0,
      keep() {
        a.deadline = a.time + 80;
        heroes.forEach((h: any, i: number) => {
          h.hp = Math.max(h.hp, full[i] * 0.6);
        });
        echoes.forEach((e: any, i: number) => {
          e.hp = Math.max(e.hp, echoFull[i] * 0.5);
          if (echoSpots[i]) [e.x, e.y] = echoSpots[i];
        });
      },
      inputs(p: any, i: number, tick: number) {
        const hero = heroes.indexOf(p);
        if (hero < 0) return null; // the boss plays itself
        const foe = spire
          ? echoes[hero % echoes.length]
          : s.mode === "raid"
            ? a.boss()
            : s.mode === "teams"
              ? heroes.find((o: any) => o.team !== p.team)
              : heroes[(hero + 1) % heroes.length];
        // Everyone's ultimate, two ticks apart, then a skill, basics between.
        if (tick === 1 + hero * 2) p.ult = 100;
        const skill =
          tick === 1 + hero * 2 ? 3 : tick === 12 + hero * 2 ? 0 : -1;
        return { aimX: foe.x, aimY: foe.y, basic: tick > 0, skill };
      },
    };
  }, s);
}

export async function step(page: Page, ticks: number, draw: boolean) {
  await page.evaluate(
    async ({ ticks, draw }) => {
      const w = window as any;
      const { a, m, inputs } = w.__shot;
      for (let t = 0; t < ticks; t++) {
        w.__shot.tick++;
        for (const [i, p] of a.players.entries()) {
          const input = inputs(p, i, w.__shot.tick);
          if (input)
            a.submit(p, { ...m.blankInput(), seq: p.ack + 1, ...input });
        }
        w.__shot.keep?.();
        a.tick();
      }
      if (!draw) return;
      w.__snap = m.packSnapshot(a.snapshot());
      w.__push();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    },
    { ticks, draw },
  );
}
