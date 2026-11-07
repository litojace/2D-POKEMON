import { fxFor } from "./fx-engine";
import { TAU, type FxKit } from "./fx-kits";
/**
 * Signature physics for every move that has no bespoke rework: what each
 * one really throws about, layered on its own drawing. Liquid fire drips
 * and splatters, ice shatters into chunks that bounce, a lance of
 * lightning leaves ozone and a scorch, and so on. They replace the shared
 * element layer in fx-physics.ts for these moves (see SIGNED).
 *
 * Purely cosmetic; sizes come from the abilities, and the effects engine's
 * particle budget and quality settings apply.
 */
type Fx = ReturnType<typeof fxFor>;
type CastFn = NonNullable<FxKit["cast"]>[string];
type ZoneFn = NonNullable<FxKit["zone"]>[string];
type ImpactFn = NonNullable<FxKit["impact"]>[string];
type ProjectileFn = NonNullable<FxKit["projectile"]>[string];
type ChannelFn = NonNullable<FxKit["channel"]>[string];
type BeamFn = NonNullable<FxKit["beam"]>[string];
const SQ = 0.82;
const WHITE = 0xffffff;

// ───────────── Shared bits ─────────────
const ring = (n: number, f: (a: number, i: number) => void) => {
  for (let i = 0; i < n; i++) f((i / n) * TAU, i);
};
/** Embers drifting up. */
const embers = (fx: Fx, x: number, y: number, n: number, spread = 50) =>
  fx.burst({
    x,
    y,
    z: 8,
    count: n,
    kind: "ember",
    color: [0xffb347, 0xffd76a, 0xff6a2a],
    speed: [10, spread],
    up: [60, 170],
    life: [0.6, 1.2],
    size: [0.9, 1.7],
    grav: -50,
    drag: 1.4,
  });
/** Smoke rising and drifting. */
const smoke = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color = [0x4a4240, 0x5e5450],
  size: [number, number] = [10, 18],
) =>
  fx.burst({
    x,
    y,
    z: 14,
    count: n,
    kind: "smoke",
    color,
    speed: [8, 35],
    up: [25, 60],
    life: [0.8, 1.4],
    size,
    grav: -14,
    drag: 1.3,
  });
/** Liquid that splashes up and falls back (water, lava, slush). */
const splash = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color: number[],
  power = 1,
  o: { angle?: number; spread?: number; z?: number } = {},
) =>
  fx.burst({
    x,
    y,
    z: o.z ?? 8,
    count: n,
    kind: "drop",
    color,
    speed: [50 * power, 200 * power],
    up: [120 * power, 320 * power],
    life: [0.45, 0.8],
    size: [1.5, 3],
    grav: 1150,
    bounce: 0.12,
    drag: 1,
    angle: o.angle,
    spread: o.spread,
  });
/** Hard bits that fly, fall and bounce (stone, ice, shell, crystal). */
const chunks = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color: number[],
  speed: [number, number] = [60, 200],
  size: [number, number] = [1.6, 3.2],
  o: { angle?: number; spread?: number; z?: number } = {},
) =>
  fx.burst({
    x,
    y,
    z: o.z ?? 6,
    count: n,
    kind: "debris",
    color,
    speed,
    up: [140, 320],
    life: [0.5, 0.9],
    size,
    grav: 1100,
    bounce: 0.4,
    angle: o.angle,
    spread: o.spread,
  });
/** Sparks that skitter and bounce. */
const sparks = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color = [WHITE, 0xfff6c2, 0x9fe8ff],
  power = 1,
  o: { angle?: number; spread?: number; z?: number } = {},
) =>
  fx.burst({
    x,
    y,
    z: o.z ?? 12,
    count: n,
    kind: "spark",
    color,
    speed: [70 * power, 240 * power],
    up: [80 * power, 260 * power],
    life: [0.3, 0.65],
    size: [0.8, 1.6],
    grav: 1050,
    bounce: 0.45,
    angle: o.angle,
    spread: o.spread,
  });
/** A shot sheds something behind it, at most every `every` seconds. */
const shed =
  (
    every: number,
    emit: (fx: Fx, x: number, y: number, back: number, r: number) => void,
  ): ProjectileFn =>
  (g, pr) => {
    const fx = fxFor(g.scene);
    fx.trail(`sig-${pr.id}`, every, () =>
      emit(
        fx,
        pr.x,
        pr.y,
        Math.atan2(pr.vy, pr.vx) + Math.PI,
        pr.ability.radius,
      ),
    );
  };
const LAVA = [0xff6a2a, 0xffb347, 0xffd76a];
const WATER = [0x6fd3ff, 0xf2fdff, 0x3fa9e0];
const ICE = [0xdff8ff, 0xb8ecff, 0x8fd8ff];
const SPARK = [WHITE, 0xfff6c2, 0x9fe8ff];
const CHESTNUT = [0x7a4a24, 0x4a2c14, 0xc98b4a];

// ───────────── Fire ─────────────
const emberLobTrail = shed(0.05, (fx, x, y, back) => {
  embers(fx, x, y, 1, 20);
  fx.burst({
    x,
    y,
    z: 14,
    count: 1,
    kind: "smoke",
    color: [0x5e5450],
    angle: back,
    spread: 0.3,
    speed: [10, 30],
    up: [10, 30],
    life: [0.4, 0.7],
    size: [5, 8],
    grav: -10,
    drag: 1.4,
  });
});
const emberLobHit: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  embers(fx, x, y, 6, 70);
  sparks(fx, x, y, 4, [0xffd76a, WHITE], 0.7);
  fx.decal({ kind: "scorch", x, y, r: 14, color: 0xff7a2a, life: 2 });
};
const mortarLand: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene),
    a = z.ability;
  if (progress < (a.tickDelay ?? 0.35) / a.duration) return;
  fx.trail(`sig-mortar${z.id}`, 999, () => {
    // The chestnut bursts: shell shards bounce, a lick of flame, a puff of smoke.
    chunks(fx, z.x, z.y, 10, CHESTNUT, [80, 220], [2, 3.6]);
    fx.burst({
      x: z.x,
      y: z.y,
      z: 10,
      count: 10,
      kind: "flame",
      color: [0xff8a3d, 0xffd76a],
      speed: [30, z.radius],
      up: [40, 120],
      life: [0.25, 0.5],
      size: [8, 13],
      drag: 3,
    });
    smoke(fx, z.x, z.y, 5, undefined, [14, 22]);
    embers(fx, z.x, z.y, 10, z.radius);
  });
};
const hotCoals: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene),
    r = z.radius;
  if (progress > 0.96) return;
  // Glowing coals on the floor that pop, throwing sparks and embers.
  fx.trail(`sig-coals${z.id}`, 0.07, () => {
    const aa = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r * 0.85,
      x = z.x + Math.cos(aa) * d,
      y = z.y + Math.sin(aa) * d * SQ;
    if (Math.random() < 0.3)
      sparks(fx, x, y, 2, [0xffd76a, 0xff8a3d, WHITE], 0.6, { z: 2 });
    else embers(fx, x, y, 1, 15);
  });
  for (let i = 0; i < 4; i++) {
    const aa = i * 1.7 + z.id,
      d = r * (0.25 + (i % 2) * 0.35);
    fx.glow(
      z.x + Math.cos(aa) * d,
      z.y + Math.sin(aa) * d * SQ,
      22,
      0xff7a2a,
      0.35 + 0.15 * Math.sin(progress * 40 + i),
      true,
    );
  }
  // Heat haze above.
  fx.glow(z.x, z.y - 40, r * 0.8, 0xffd76a, 0.08, false, 1.8);
};
const cinderSnap: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    reach = (a.range || 120) * 0.7;
  // Each rake of the claws throws sparks off along the swing.
  for (const off of [-0.35, 0, 0.35])
    sparks(
      fx,
      x + Math.cos(angle + off) * reach,
      y + Math.sin(angle + off) * reach,
      3,
      [0xffd76a, 0xff8a3d, WHITE],
      0.8,
      { angle: angle + off, spread: 0.5, z: 16 },
    );
  embers(fx, x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, 4, 40);
};
const crestFlare: ChannelFn = (g, a, x, y, angle) => {
  const fx = fxFor(g.scene),
    reach = a.range || 200,
    tx = x + Math.cos(angle) * reach,
    ty = y + Math.sin(angle) * reach;
  // Smoke rolls off the end of the flames, embers ride the heat.
  fx.trail(`sig-crest-${Math.round(x)}-${Math.round(y)}`, 0.06, () => {
    smoke(fx, tx, ty, 1, undefined, [12, 20]);
    embers(
      fx,
      x + Math.cos(angle) * reach * Math.random(),
      y + Math.sin(angle) * reach * Math.random(),
      2,
      40,
    );
  });
  // Tongues of flame lick out along the crest, licking upward as they go.
  fx.trail(`sig-crestf-${Math.round(x)}-${Math.round(y)}`, 0.05, () =>
    fx.burst({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      z: 14,
      count: 2,
      kind: "flame",
      color: [0xffd76a, 0xff8a3d, 0xe0461f],
      angle,
      spread: 0.35,
      speed: [reach * 1.1, reach * 1.6],
      up: [10, 40],
      life: [0.35, 0.55],
      size: [5, 9],
      grav: -60,
      drag: 1.2,
    }),
  );
  fx.glow(tx, ty, reach * 0.35, 0xff8a3d, 0.25, true);
  fx.glow((x + tx) / 2, (y + ty) / 2, reach * 0.3, 0xffb054, 0.18, true);
};
const magmaTrail = shed(0.04, (fx, x, y, back) => {
  // Molten rock drips off it and smokes.
  splash(fx, x, y, 1, LAVA, 0.3, { angle: back, spread: 0.6, z: 14 });
  fx.burst({
    x,
    y,
    z: 16,
    count: 1,
    kind: "smoke",
    color: [0x4a4240],
    angle: back,
    spread: 0.3,
    speed: [10, 30],
    up: [10, 30],
    life: [0.5, 0.8],
    size: [7, 11],
    grav: -12,
    drag: 1.4,
  });
});
const magmaSplat: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.explosion ?? 110;
  // Lava splatters and pools, rock chips fly, smoke rolls up.
  fx.decal({ kind: "molten", x, y, r: r * 0.55, color: 0xff6a2a, life: 4 });
  splash(fx, x, y, 22, LAVA, 1.2);
  chunks(fx, x, y, 8, [0x4a2318, 0x6b5a48], [60, 200]);
  smoke(fx, x, y, 6, undefined, [16, 26]);
  embers(fx, x, y, 10, r);
};
const heatCracks: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene);
  if (progress > 0.95) return;
  // The ground cracks where Cindrake walks, glowing; embers and heat spit out.
  fx.trail(`sig-hc${z.id}`, 0.28, () => {
    fx.decal({
      kind: "crack",
      x: z.x,
      y: z.y,
      r: 26,
      color: 0xff7a2a,
      life: 2.2,
    });
    fx.decal({
      kind: "molten",
      x: z.x,
      y: z.y,
      r: 10,
      color: 0xff6a2a,
      life: 1.6,
    });
  });
  fx.trail(`sig-hce${z.id}`, 0.08, () => {
    const aa = Math.random() * TAU,
      d = Math.random() * z.radius * 0.8;
    embers(fx, z.x + Math.cos(aa) * d, z.y + Math.sin(aa) * d * SQ, 1, 25);
  });
};

// ───────────── Water and ice ─────────────
const needleTrail = shed(0.05, (fx, x, y, back) =>
  splash(fx, x, y, 1, WATER, 0.35, { angle: back, spread: 0.5, z: 14 }),
);
const needleHit: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  splash(fx, x, y, 8, WATER, 0.8);
  fx.decal({ kind: "wet", x, y, r: 16, color: 0x3fa9e0, life: 2 });
};
const tideDouble: CastFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // Tidefin slips away in a burst of spray, leaving a puddle where it stood.
  splash(fx, x, y, 14, WATER, 0.9, { z: 20 });
  smoke(fx, x, y, 5, [0xe6f8ff, 0xcfeeff], [12, 18]);
  fx.decal({ kind: "wet", x, y, r: 30, color: 0x3fa9e0, life: 3 });
};
const iceTrail = shed(0.06, (fx, x, y) =>
  fx.burst({
    x,
    y,
    z: 14,
    count: 1,
    kind: "mote",
    color: ICE,
    speed: [5, 20],
    up: [-10, 10],
    life: [0.4, 0.7],
    size: [1, 2],
    grav: 40,
    drag: 1.4,
  }),
);
const shatter: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    big = a.id === "hailstone";
  // Ice breaks into chunks that skitter and bounce, with a puff of frost.
  chunks(
    fx,
    x,
    y,
    big ? 14 : 7,
    ICE,
    big ? [80, 240] : [50, 160],
    big ? [2, 3.8] : [1.4, 2.6],
  );
  fx.burst({
    x,
    y,
    z: 10,
    count: big ? 6 : 3,
    kind: "smoke",
    color: [0xf2fdff, 0xdff8ff],
    speed: [20, 70],
    up: [10, 40],
    life: [0.5, 0.9],
    size: [9, 15],
    drag: 2,
  });
  if (big) fx.decal({ kind: "wet", x, y, r: 28, color: 0xdff8ff, life: 3 });
};
const frostBloomBurst: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene),
    a = z.ability;
  if (progress < (a.tickDelay ?? 0.35) / a.duration) return;
  fx.trail(`sig-fb${z.id}`, 999, () => {
    // Ice crystals punch up through the floor; cold fog rolls out over it.
    ring(10, (aa) =>
      chunks(
        fx,
        z.x + Math.cos(aa) * z.radius * 0.6,
        z.y + Math.sin(aa) * z.radius * 0.6 * SQ,
        2,
        ICE,
        [40, 140],
        [2, 3.4],
      ),
    );
    ring(12, (aa) =>
      fx.burst({
        x: z.x,
        y: z.y,
        z: 4,
        count: 1,
        kind: "smoke",
        color: [0xf2fdff, 0xdff8ff],
        angle: aa,
        spread: 0.15,
        speed: [z.radius * 0.8, z.radius * 1.2],
        up: [5, 20],
        life: [0.7, 1.1],
        size: [14, 20],
        drag: 2,
      }),
    );
    fx.decal({
      kind: "wet",
      x: z.x,
      y: z.y,
      r: z.radius * 0.9,
      color: 0xdff8ff,
      life: 3.5,
    });
  });
};
const frostBreath: ChannelFn = (g, a, x, y, angle) => {
  const fx = fxFor(g.scene),
    reach = a.range || 200,
    spread = Math.acos(a.arc ?? 0.7) * 0.8;
  const tx = x + Math.cos(angle) * reach,
    ty = y + Math.sin(angle) * reach;
  // A cold fog hangs where the breath lands.
  fx.soft(tx, ty, reach * 0.28, 0xdff8ff, 0.22, 0.7);
  fx.glow(tx, ty, reach * 0.32, 0x9fe8ff, 0.2, true);
  // A blizzard of frost blown out, freezing to chips at the far end.
  fx.trail(`sig-fbr-${Math.round(x)}-${Math.round(y)}`, 0.03, () => {
    fx.burst({
      x: x + Math.cos(angle) * 24,
      y: y + Math.sin(angle) * 24,
      z: 16,
      count: 2,
      kind: "mote",
      color: [WHITE, 0xdff8ff],
      angle,
      spread,
      speed: [reach * 1.2, reach * 1.8],
      up: [-10, 10],
      life: [0.4, 0.6],
      size: [1, 2.2],
      drag: 0.6,
    });
  });
  fx.trail(`sig-fbc-${Math.round(x)}-${Math.round(y)}`, 0.12, () =>
    chunks(
      fx,
      x + Math.cos(angle) * reach,
      y + Math.sin(angle) * reach,
      1,
      ICE,
      [20, 70],
      [1.2, 2.2],
    ),
  );
};

// ───────────── Electric ─────────────
const sparkTrail = shed(0.04, (fx, x, y, back) =>
  sparks(fx, x, y, 1, SPARK, 0.4, { angle: back, spread: 0.8, z: 14 }),
);
const zap: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    lance = a.id === "static-lance";
  sparks(fx, x, y, lance ? 10 : 5, SPARK, lance ? 1.1 : 0.8);
  if (lance)
    fx.burst({
      x,
      y,
      z: 16,
      count: 3,
      kind: "smoke",
      color: [0x6a7488, 0x9aa4b8],
      speed: [10, 40],
      up: [30, 60],
      life: [0.7, 1.1],
      size: [9, 14],
      grav: -18,
      drag: 1.4,
    });
  fx.decal({
    kind: "scorch",
    x,
    y,
    r: lance ? 20 : 12,
    color: 0x9fe8ff,
    life: 2.2,
  });
};
const ballTrail = shed(0.03, (fx, x, y) => {
  // Sparks spin off the ball in every direction.
  const aa = Math.random() * TAU;
  sparks(fx, x, y, 1, SPARK, 0.6, { angle: aa, spread: 0.2, z: 18 });
});
const ballBurst: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.explosion ?? 100;
  sparks(fx, x, y, 22, SPARK, 1.3);
  fx.burst({
    x,
    y,
    z: 16,
    count: 6,
    kind: "smoke",
    color: [0x6a7488, 0x9aa4b8],
    speed: [20, r * 0.6],
    up: [30, 70],
    life: [0.8, 1.3],
    size: [12, 20],
    grav: -18,
    drag: 1.4,
  });
  fx.decal({ kind: "scorch", x, y, r: r * 0.5, color: 0x9fe8ff, life: 3 });
};
const staticGlide: CastFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // Charged up: static crackles off the fur and stands motes on end.
  sparks(fx, x, y, 10, SPARK, 0.7, { z: 24 });
  // Short arcs crackle off the body to the ground for a moment. A bolt lasts
  // one frame, so it is drawn again a few times.
  for (let k = 0; k < 5; k++)
    scene.time.delayedCall(k * 55, () => {
      const t = Math.random() * Math.PI * 2,
        d = 26 + Math.random() * 18;
      fx.bolt(
        x,
        y - 14,
        x + Math.cos(t) * d,
        y + Math.sin(t) * d * 0.6,
        0xfff6c2,
        {
          width: 1.5,
          jag: 0.3,
          alpha: 0.9,
        },
      );
      fx.glow(x, y, 46, 0x9fe8ff, 0.35, true);
    });
  fx.burst({
    x,
    y,
    z: 10,
    count: 8,
    kind: "mote",
    color: [0xfff6c2, 0x9fe8ff],
    speed: [10, 50],
    up: [40, 110],
    life: [0.6, 1],
    size: [1, 2],
    grav: -30,
    drag: 1.6,
  });
};
const coilSwipe: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    reach = (a.range || 120) * 0.7;
  sparks(
    fx,
    x + Math.cos(angle) * reach,
    y + Math.sin(angle) * reach,
    6,
    SPARK,
    0.9,
    { angle, spread: 0.9, z: 16 },
  );
};
const magnetTrail = shed(0.05, (fx, x, y, back) =>
  fx.burst({
    x,
    y,
    z: 14,
    count: 1,
    kind: "debris",
    color: [0xd4dde9, 0x8a94a4],
    angle: back,
    spread: 0.5,
    speed: [20, 60],
    up: [20, 60],
    life: [0.4, 0.6],
    size: [1, 1.8],
    grav: 600,
    bounce: 0.4,
  }),
);
const magnetHit: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  sparks(fx, x, y, 6, [WHITE, 0xff5f57, 0x9fe8ff], 0.9);
};

// ───────────── Wiring ─────────────
interface Sig {
  cast?: CastFn;
  zone?: ZoneFn;
  impact?: ImpactFn;
  projectile?: ProjectileFn;
  channel?: ChannelFn;
  beam?: BeamFn;
}
// ───────────── Earth ─────────────
const STONE = [0x8a7f72, 0x6f655a, 0xb0a493];
const MUD = [0x6b4a2b, 0x8a6238, 0x4a3220];
const DUST = [0xcdb994, 0xb8a27a];
/** A low puff of dust kicked off the ground. */
const dust = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number] = [20, 70],
  o: { angle?: number; spread?: number } = {},
) =>
  fx.burst({
    x,
    y,
    z: 2,
    count: n,
    kind: "smoke",
    color: DUST,
    speed,
    up: [5, 30],
    life: [0.5, 0.9],
    size: [8, 14],
    grav: -6,
    drag: 2.2,
    angle: o.angle,
    spread: o.spread,
  });
const tip = (x: number, y: number, angle: number, d: number) =>
  [x + Math.cos(angle) * d, y + Math.sin(angle) * d] as const;
const boulderSwipe: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    [tx, ty] = tip(x, y, angle, (a.range || 150) * 0.75);
  // The boulder scrapes the ground: gravel thrown along the swing.
  chunks(fx, tx, ty, 8, STONE, [90, 230], [1.8, 3.6], {
    angle,
    spread: 0.9,
    z: 10,
  });
  dust(fx, tx, ty, 4, [30, 90], { angle, spread: 1 });
  fx.decal({ kind: "crack", x: tx, y: ty, r: 16, color: 0x5a4a3a, life: 2.4 });
};
const mudMire: ZoneFn = (g, z) => {
  const fx = fxFor(g.scene),
    r = z.radius;
  // The mud lies wet; bubbles swell and pop, flicking little gobs up.
  fx.trail(`sig-mud-mark${z.id}`, 999, () =>
    fx.decal({
      kind: "wet",
      x: z.x,
      y: z.y,
      r: r * 0.85,
      color: 0x5a3e22,
      life: z.ability.duration + 1,
    }),
  );
  fx.trail(`sig-mud${z.id}`, 0.22, () => {
    const t = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r * 0.8,
      bx = z.x + Math.cos(t) * d,
      by = z.y + Math.sin(t) * d * SQ;
    splash(fx, bx, by, 3, MUD, 0.35, { z: 1 });
    fx.soft(bx, by, 6, 0x8a6238, 0.5, 0.6);
  });
};
const shellBash: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    [tx, ty] = tip(x, y, angle, (a.range || 150) * 0.6);
  // A hard shell meets the ground: a thump of dust and chips knocked loose.
  ring(8, (t) =>
    dust(fx, tx + Math.cos(t) * 10, ty + Math.sin(t) * 6, 1, [50, 90], {
      angle: t,
      spread: 0.2,
    }),
  );
  chunks(fx, tx, ty, 5, [0x9a8a6a, 0x6f655a, 0xd8c8a0], [60, 160], [1.4, 2.6]);
};
const shellUp: CastFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // It drops into its shell: dust puffs out round the rim and loose
  // pebbles patter down off its back.
  ring(10, (t) =>
    dust(fx, x + Math.cos(t) * 16, y + Math.sin(t) * 9, 1, [30, 60], {
      angle: t,
      spread: 0.25,
    }),
  );
  chunks(fx, x, y, 5, STONE, [20, 60], [1.2, 2.2], { z: 26 });
};
const burrowRush: CastFn = (scene, _a, x, y, angle) => {
  const fx = fxFor(scene),
    back = angle + Math.PI;
  // Claws dig in: clods of earth thrown back out of the hole it leaves.
  chunks(fx, x, y, 9, MUD, [80, 200], [1.8, 3.4], {
    angle: back,
    spread: 0.7,
  });
  dust(fx, x, y, 4, [30, 80], { angle: back, spread: 0.8 });
  fx.decal({ kind: "crack", x, y, r: 14, color: 0x4a3220, life: 2.2 });
};
const burrowLand: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // It bursts out of the ground: soil and stones heave up and rain back.
  chunks(fx, x, y, 12, [...MUD, ...STONE], [40, 170], [1.8, 3.8]);
  ring(10, (t) =>
    dust(fx, x + Math.cos(t) * 12, y + Math.sin(t) * 7, 1, [60, 110], {
      angle: t,
      spread: 0.2,
    }),
  );
};
const rumpBump: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    [tx, ty] = tip(x, y, angle, (a.range || 140) * 0.5);
  // A heavy rump lands: the ground jumps, pebbles hop, dust rolls out.
  ring(6, (t) =>
    dust(fx, tx + Math.cos(t) * 8, ty + Math.sin(t) * 5, 1, [40, 80], {
      angle: t,
      spread: 0.3,
    }),
  );
  chunks(fx, tx, ty, 4, STONE, [30, 90], [1.2, 2], { z: 2 });
};

// ───────────── Shadow ─────────────
const GHOST = [0x7dffe1, 0xbfffee, 0x3fd6b8];
const INK = [0x1b1430, 0x2c2048, 0x0e0a1c];
const SOOT = [0x2a2438, 0x3a3248];
/** Cold ghost flame that licks upward. */
const coldFlame = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  o: {
    angle?: number;
    spread?: number;
    z?: number;
    speed?: [number, number];
  } = {},
) =>
  fx.burst({
    x,
    y,
    z: o.z ?? 12,
    count: n,
    kind: "flame",
    color: GHOST,
    speed: o.speed ?? [10, 40],
    up: [30, 90],
    life: [0.3, 0.55],
    size: [3, 6],
    grav: -80,
    drag: 1.4,
    angle: o.angle,
    spread: o.spread,
  });
const ghostfireTrail = shed(0.04, (fx, x, y, back) => {
  coldFlame(fx, x, y, 1, { angle: back, spread: 0.5 });
  smoke(fx, x, y, 1, SOOT, [5, 8]);
});
const ghostfireHit: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // The flame breaks on it: a cold flare and a curl of soot.
  coldFlame(fx, x, y, 7, { speed: [30, 90] });
  smoke(fx, x, y, 3, SOOT, [8, 13]);
  fx.glow(x, y, 26, 0x7dffe1, 0.4);
};
const hauntedLantern: ZoneFn = (g, z) => {
  const fx = fxFor(g.scene);
  // The lantern flickers: cold flame curls out of its top, soot rises,
  // and ghost motes circle the light.
  fx.trail(`sig-lantern${z.id}`, 0.12, () => {
    coldFlame(fx, z.x, z.y, 1, { z: 30, speed: [4, 14] });
    smoke(fx, z.x, z.y, 1, SOOT, [5, 9]);
  });
  fx.trail(`sig-lantern-m${z.id}`, 0.3, () => {
    const t = Math.random() * TAU;
    fx.burst({
      x: z.x + Math.cos(t) * z.radius,
      y: z.y + Math.sin(t) * z.radius * SQ,
      z: 20,
      count: 1,
      kind: "mote",
      color: GHOST,
      angle: t + Math.PI / 2,
      spread: 0.2,
      speed: [20, 40],
      up: [-10, 20],
      life: [0.8, 1.2],
      size: [1, 2],
      drag: 0.8,
    });
  });
  fx.glow(z.x, z.y, z.radius * 1.6, 0x7dffe1, 0.12, true);
};
const wispTrail = shed(0.05, (fx, x, y, back) =>
  fx.burst({
    x,
    y,
    z: 14,
    count: 2,
    kind: "mote",
    color: [0xe9fff9, 0x7dffe1],
    angle: back,
    spread: 0.9,
    speed: [10, 40],
    up: [10, 40],
    life: [0.5, 0.9],
    size: [1, 2],
    grav: -20,
    drag: 1.2,
  }),
);
const wispPop: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // The wisp comes apart into pale motes and a breath of mist.
  fx.burst({
    x,
    y,
    z: 14,
    count: 10,
    kind: "mote",
    color: [0xe9fff9, 0x7dffe1],
    speed: [40, 120],
    up: [20, 80],
    life: [0.5, 0.9],
    size: [1, 2.2],
    grav: -30,
    drag: 1.6,
  });
  smoke(fx, x, y, 2, [0xcfe9e4, 0xa8d4cc], [8, 12]);
};
const crawlTrail = shed(0.05, (fx, x, y, back, r) => {
  // A shadow creeping on the ground: a dark smear and low murk behind it.
  fx.burst({
    x,
    y,
    z: 1,
    count: 1,
    kind: "smoke",
    color: INK,
    angle: back,
    spread: 0.5,
    speed: [5, 20],
    up: [0, 8],
    life: [0.5, 0.8],
    size: [r * 0.7, r * 1.1],
    grav: 0,
    drag: 2,
  });
});
const crawlRise: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // It rears up out of the ground and splashes like ink.
  splash(fx, x, y, 8, INK, 0.7, { z: 2 });
  fx.decal({ kind: "wet", x, y, r: 16, color: 0x1b1430, life: 2.4 });
};
const inkCloud: CastFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // A squirt of ink: drops spatter, a puddle spreads, the cloud billows.
  splash(fx, x, y, 12, INK, 0.8, { z: 14 });
  ring(8, (t) =>
    fx.burst({
      x: x + Math.cos(t) * 10,
      y: y + Math.sin(t) * 6,
      z: 10,
      count: 1,
      kind: "smoke",
      color: INK,
      angle: t,
      spread: 0.3,
      speed: [40, 90],
      up: [10, 40],
      life: [0.9, 1.4],
      size: [16, 24],
      grav: -8,
      drag: 1.8,
    }),
  );
};
const inkStrike: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    [tx, ty] = tip(x, y, angle, (a.range || 150) * 0.7);
  // Ink flung off the tentacle spatters along the swing.
  splash(fx, tx, ty, 9, INK, 0.7, { angle, spread: 0.8, z: 14 });
  fx.decal({ kind: "wet", x: tx, y: ty, r: 14, color: 0x1b1430, life: 2.2 });
};
const tentacleLash: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    [tx, ty] = tip(x, y, angle, (a.range || 150) * 0.8);
  // A wet slap: sea water flicked off the tentacle, a dust slap at the end.
  splash(fx, tx, ty, 7, [0x9ad7e8, 0xe9f8ff, 0x6a5a9a], 0.6, {
    angle,
    spread: 1,
    z: 12,
  });
  dust(fx, tx, ty, 2, [20, 60], { angle, spread: 0.8 });
};

// ───────────── Nature ─────────────
const LEAF = [0x6fbf5a, 0x9fd86a, 0x3f8f3a];
const HUSK = [0x8a6a3a, 0xc9a46a, 0x5a4020];
const SOIL = [0x6b4a2b, 0x4a3220, 0x8a6238];
/** Leaves tossed up that flutter down slowly. */
const leaves = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number] = [30, 110],
  o: { angle?: number; spread?: number; z?: number } = {},
) =>
  fx.burst({
    x,
    y,
    z: o.z ?? 10,
    count: n,
    kind: "debris",
    color: LEAF,
    speed,
    up: [80, 200],
    life: [0.9, 1.5],
    size: [1.6, 2.8],
    grav: 260,
    drag: 2.4,
    bounce: 0.05,
    angle: o.angle,
    spread: o.spread,
  });
const pollen = (fx: Fx, x: number, y: number, n: number, r = 30) =>
  fx.burst({
    x,
    y,
    z: 10,
    count: n,
    kind: "mote",
    color: [0xfff2a8, 0xe9f5c8],
    speed: [5, r],
    up: [10, 50],
    life: [0.9, 1.5],
    size: [0.8, 1.6],
    grav: -10,
    drag: 1.4,
  });
const lazySwapGo: CastFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // Where it was: a swirl of leaves left hanging in the air.
  leaves(fx, x, y, 8, [20, 80], { z: 16 });
  pollen(fx, x, y, 5);
};
const lazySwapLand: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  leaves(fx, x, y, 8, [40, 110], { z: 16 });
  dust(fx, x, y, 3, [20, 60]);
};
const seedSpitTrail = shed(0.08, (fx, x, y, back) =>
  pollen(fx, x - Math.cos(back) * 2, y - Math.sin(back) * 2, 1, 10),
);
const seedCrack: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // The seed cracks open: husk chips skitter and a puff of soil.
  chunks(fx, x, y, 6, HUSK, [50, 150], [1.2, 2.2]);
  dust(fx, x, y, 2, [20, 50]);
};
const seedlingGrow: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene);
  // The sprout pushes through: soil crumbs heave, pollen drifts off it.
  if (progress < 0.25)
    fx.trail(`sig-sprout${z.id}`, 0.1, () =>
      chunks(fx, z.x, z.y, 1, SOIL, [10, 40], [1, 1.8], { z: 1 }),
    );
  fx.trail(`sig-sprout-p${z.id}`, 0.5, () => pollen(fx, z.x, z.y, 1, 15));
};
const seedlingPop: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // Roots tear up through the ground: clods and torn leaves fly.
  chunks(fx, x, y, 10, SOIL, [50, 170], [1.6, 3.2]);
  leaves(fx, x, y, 6, [40, 120]);
};
const slothTime: ZoneFn = (g, z) => {
  const fx = fxFor(g.scene),
    r = z.radius;
  // Time thickens: dust and leaves hang in the air, barely sinking.
  fx.trail(`sig-sloth${z.id}`, 0.18, () => {
    const t = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r * 0.85;
    fx.burst({
      x: z.x + Math.cos(t) * d,
      y: z.y + Math.sin(t) * d * SQ,
      z: 20 + Math.random() * 30,
      count: 1,
      kind: Math.random() < 0.5 ? "debris" : "mote",
      color: [...LEAF, 0xe9f5c8],
      speed: [2, 8],
      up: [-4, 4],
      life: [1.6, 2.4],
      size: [1, 2],
      grav: 6,
      drag: 3,
    });
  });
};
const curlRollGo: CastFn = (scene, _a, x, y, angle) => {
  const fx = fxFor(scene);
  // It tucks and pushes off: grass and dust kicked out behind.
  leaves(fx, x, y, 5, [60, 140], { angle: angle + Math.PI, spread: 0.7 });
  dust(fx, x, y, 3, [30, 80], { angle: angle + Math.PI, spread: 0.8 });
};
const curlRollHit: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // An armoured ball slams home: dust, a chipped scale, a dent.
  ring(8, (t) =>
    dust(fx, x + Math.cos(t) * 10, y + Math.sin(t) * 6, 1, [50, 100], {
      angle: t,
      spread: 0.2,
    }),
  );
  chunks(fx, x, y, 4, [0x8fae5a, 0x5a7a3a, 0xc9d89a], [60, 150], [1.2, 2.2]);
};
const scaleTrail = shed(0.06, (fx, x, y, back) =>
  fx.burst({
    x,
    y,
    z: 14,
    count: 1,
    kind: "spark",
    color: [0xe9f5c8, WHITE],
    angle: back,
    spread: 0.4,
    speed: [20, 60],
    up: [0, 20],
    life: [0.15, 0.3],
    size: [0.6, 1.1],
  }),
);
const scaleClink: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // A hard scale strikes and skitters: a glint and a few chips.
  sparks(fx, x, y, 3, [0xe9f5c8, WHITE], 0.5);
  chunks(fx, x, y, 3, [0x8fae5a, 0xc9d89a], [40, 110], [1, 1.8]);
};
const scaleShrapnelGo: CastFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  // The scales flare out: a rattle of glints off its back.
  sparks(fx, x, y, 6, [0xe9f5c8, WHITE], 0.6, { z: 22 });
};
const scaleSwipe: CastFn = (scene, a, x, y, angle) => {
  const fx = fxFor(scene),
    [tx, ty] = tip(x, y, angle, (a.range || 150) * 0.7);
  // Sharp scales cut through grass: clippings fly, dust trails the arc.
  leaves(fx, tx, ty, 7, [80, 180], { angle, spread: 0.9 });
  dust(fx, tx, ty, 2, [20, 60], { angle, spread: 0.8 });
};
const tongueLick: BeamFn = (scene, _a, x, y, tx, ty) => {
  const fx = fxFor(scene),
    len = Math.hypot(tx - x, ty - y) || 1;
  // A sticky tongue: drips fall from it and it splats where it lands.
  for (let d = 60; d < len; d += 90)
    splash(
      fx,
      x + ((tx - x) * d) / len,
      y + ((ty - y) * d) / len,
      1,
      [0xf2a0b8, 0xffd6e2],
      0.2,
      { z: 16 },
    );
  splash(fx, tx, ty, 5, [0xf2a0b8, 0xffd6e2], 0.5, { z: 10 });
};

const SIGNATURES: Record<string, Sig> = {
  // Fire
  "ember-lob": { projectile: emberLobTrail, impact: emberLobHit },
  "chestnut-mortar": { zone: mortarLand },
  "hot-coals": { zone: hotCoals },
  "cinder-snap": { cast: cinderSnap },
  "crest-flare": { channel: crestFlare },
  "magma-bomb": { projectile: magmaTrail, impact: magmaSplat },
  "heat-cracks": { zone: heatCracks },
  // Water and ice
  "tide-needle": { projectile: needleTrail, impact: needleHit },
  "tide-double": { cast: tideDouble },
  "rime-shard": { projectile: iceTrail, impact: shatter },
  hailstone: { projectile: iceTrail, impact: shatter },
  "frost-bloom": { zone: frostBloomBurst },
  "frost-breath": { channel: frostBreath },
  // Electric
  "spark-dart": { projectile: sparkTrail, impact: zap },
  "static-lance": { projectile: sparkTrail, impact: zap },
  "ball-lightning": { projectile: ballTrail, impact: ballBurst },
  "static-glide": { cast: staticGlide },
  "coil-swipe": { cast: coilSwipe },
  "magnet-lash": { projectile: magnetTrail, impact: magnetHit },
  "boulder-swipe": { cast: boulderSwipe },
  "mud-mire": { zone: mudMire },
  "shell-bash": { cast: shellBash },
  "shell-up": { cast: shellUp },
  "burrow-rush": { cast: burrowRush, impact: burrowLand },
  "rump-bump": { cast: rumpBump },
  ghostfire: { projectile: ghostfireTrail, impact: ghostfireHit },
  "haunted-lantern": { zone: hauntedLantern },
  "lantern-wisp": { projectile: wispTrail, impact: wispPop },
  "shade-crawl": { projectile: crawlTrail, impact: crawlRise },
  "ink-cloud": { cast: inkCloud },
  "ink-strike": { cast: inkStrike },
  "tentacle-lash": { cast: tentacleLash },
  "lazy-swap": { cast: lazySwapGo, impact: lazySwapLand },
  "seed-spit": { projectile: seedSpitTrail, impact: seedCrack },
  seedling: { zone: seedlingGrow, impact: seedlingPop },
  "sloth-time": { zone: slothTime },
  "curl-roll": { cast: curlRollGo, impact: curlRollHit },
  "scale-shrapnel": {
    projectile: scaleTrail,
    impact: scaleClink,
    cast: scaleShrapnelGo,
  },
  "scale-swipe": { cast: scaleSwipe },
  "tongue-grapple": { beam: tongueLick },
};
/** The moves drawn with a signature here (the shared physics layer skips them). */
export const SIGNED = new Set(Object.keys(SIGNATURES));

type Scene = Parameters<typeof fxFor>[0];
/**
 * The move's own drawing, then its signature physics on top. Like the shared
 * layer they replace, the physics are left out under reduced motion. A
 * signature only ever adds to a drawing: with none to add to, the move would
 * lose its classic fallback, so it is skipped and listed in `unbacked`.
 */
const then =
  <A extends unknown[]>(
    base: (...a: A) => void,
    extra: (...a: A) => void,
    sceneOf: (...a: A) => Scene | undefined,
  ) =>
  (...a: A) => {
    base(...a);
    const scene = sceneOf(...a);
    if (scene && !fxFor(scene).reduced) extra(...a);
  };
/** Signatures with no drawing under them (for tests: should be empty). */
export const unbacked: string[] = [];
export function withSignatures(kit: Required<FxKit>): Required<FxKit> {
  const out: Required<FxKit> = {
    ...kit,
    cast: { ...kit.cast },
    zone: { ...kit.zone },
    impact: { ...kit.impact },
    projectile: { ...kit.projectile },
    channel: { ...kit.channel },
    beam: { ...kit.beam },
  };
  const add = <A extends unknown[]>(
    map: Record<string, (...a: A) => void>,
    id: string,
    hook: string,
    extra: ((...a: A) => void) | undefined,
    sceneOf: (...a: A) => Scene | undefined,
  ) => {
    if (!extra) return;
    const base = map[id];
    if (base) map[id] = then(base, extra, sceneOf);
    else unbacked.push(`${id} ${hook}`);
  };
  const scene = (s: Scene) => s;
  const ofG = (g: { scene?: Scene }) => g.scene;
  for (const [id, s] of Object.entries(SIGNATURES)) {
    add(out.cast, id, "cast", s.cast, scene);
    add(out.impact, id, "impact", s.impact, scene);
    add(out.beam, id, "beam", s.beam, scene);
    add(out.zone, id, "zone", s.zone, ofG);
    add(out.projectile, id, "projectile", s.projectile, ofG);
    add(out.channel, id, "channel", s.channel, ofG);
  }
  return out;
}
