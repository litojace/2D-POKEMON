import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { SIGNED } from "./skill-fx-signatures";

/**
 * A layer of real-world physics under every move's own effect: what its
 * element throws about when it flies, lands, strikes or lingers. Fire sheds
 * embers and smoke and scorches the floor; water splashes in drops that fall
 * and leaves the floor wet; lightning throws sparks that bounce; earth throws
 * grit and dust and cracks the ground; shadow drips ink; light, psychic and
 * aura scatter motes and shards; nature sheds leaves and pollen.
 *
 * Purely cosmetic and capped by the effects engine's particle budget and
 * quality settings. The moves reworked in waves 1–3 and the ultimates draw
 * their own physics and are skipped here.
 */
const BESPOKE = new Set([
  "gill-siphon",
  "ember-curtain",
  "halcyon-rewind",
  "pinning-quill",
  "bush-boomerang",
  "grudge-thump",
  "ink-jet",
  "eyespot-flash",
  "radiant-flare",
  "static-clamp",
  "mochi-pound",
  "kraken-grasp",
  "crystal-cage",
  "undertow",
  "moon-gravity",
  "spark-trail",
  "sunfire-pillar",
  "mind-maze",
  // The older ultimates draw their own physics too (skill-fx-ultimates.ts).
  "overcharge",
  "electromagnet",
  "riptide-wave",
  "whiteout",
  "chestnut-storm",
  "tremor",
  "landslide",
  "void-orb",
  "skyline-lance",
  "sanctuary",
  "full-moon",
  "pinball",
  "overgrowth",
]);

type Element =
  | "fire"
  | "water"
  | "electric"
  | "earth"
  | "shadow"
  | "light"
  | "psychic"
  | "aura"
  | "nature";

interface Matter {
  /** The stuff it throws: what kind, its colours, how it falls. */
  bit: {
    kind: "ember" | "drop" | "spark" | "debris" | "mote";
    color: number[];
    grav: number;
    bounce?: number;
    drag?: number;
    up: [number, number];
    size: [number, number];
    life: [number, number];
  };
  /** Its haze: steam, smoke, dust or mist. */
  haze: { color: number[]; grav?: number };
  /** What it leaves on the floor, if anything. */
  mark?: "scorch" | "wet" | "crack";
  markColor: number;
}

const MATTER: Record<Element, Matter> = {
  fire: {
    bit: {
      kind: "ember",
      color: [0xffb347, 0xffd76a, 0xff6a2a],
      grav: -50,
      drag: 1.4,
      up: [60, 170],
      size: [0.9, 1.7],
      life: [0.6, 1.2],
    },
    haze: { color: [0x4a4240, 0x5e5450], grav: -14 },
    mark: "scorch",
    markColor: 0xff7a2a,
  },
  water: {
    bit: {
      kind: "drop",
      color: [0x6fd3ff, 0xf2fdff, 0x3fa9e0],
      grav: 1150,
      bounce: 0.12,
      drag: 1,
      up: [120, 300],
      size: [1.4, 2.8],
      life: [0.4, 0.75],
    },
    haze: { color: [0xe6f8ff, 0xcfeeff] },
    mark: "wet",
    markColor: 0x3fa9e0,
  },
  electric: {
    bit: {
      kind: "spark",
      color: [0xffffff, 0xfff6c2, 0x9fe8ff],
      grav: 1050,
      bounce: 0.45,
      up: [60, 220],
      size: [0.8, 1.5],
      life: [0.3, 0.6],
    },
    haze: { color: [0x6a7488, 0x9aa4b8], grav: -18 },
    mark: "scorch",
    markColor: 0x9fe8ff,
  },
  earth: {
    bit: {
      kind: "debris",
      color: [0x8a7a64, 0x6b5a48, 0xa8957a],
      grav: 1100,
      bounce: 0.35,
      up: [120, 280],
      size: [1.6, 3.4],
      life: [0.45, 0.8],
    },
    haze: { color: [0xc4a678, 0xd9bf8f] },
    mark: "crack",
    markColor: 0x6b5640,
  },
  shadow: {
    bit: {
      kind: "drop",
      color: [0x150b26, 0x2a1450, 0x3a2470],
      grav: 900,
      drag: 1.2,
      up: [60, 200],
      size: [1.6, 3],
      life: [0.4, 0.8],
    },
    haze: { color: [0x2a1450, 0x3a2470], grav: -12 },
    mark: "wet",
    markColor: 0x150b26,
  },
  light: {
    bit: {
      kind: "mote",
      color: [0xffd76a, 0xfff6d6, 0xffffff],
      grav: 60,
      drag: 1.8,
      up: [20, 90],
      size: [1, 2.2],
      life: [0.6, 1.1],
    },
    haze: { color: [0xfff3c4, 0xffe7a0], grav: -10 },
    markColor: 0xffd76a,
  },
  psychic: {
    bit: {
      kind: "mote",
      color: [0xff9de2, 0x9ff3ff, 0xffffff],
      grav: -20,
      drag: 2,
      up: [20, 70],
      size: [1, 2.2],
      life: [0.6, 1.1],
    },
    haze: { color: [0xb98ae0, 0xff9de2], grav: -8 },
    markColor: 0xff9de2,
  },
  aura: {
    bit: {
      kind: "debris",
      color: [0xdff4ff, 0x8ff6ff, 0xff9be0],
      grav: 1050,
      bounce: 0.45,
      up: [100, 240],
      size: [1.4, 2.6],
      life: [0.45, 0.8],
    },
    haze: { color: [0xdff4ff, 0xe8f6ff] },
    markColor: 0x8ff6ff,
  },
  nature: {
    bit: {
      kind: "debris",
      color: [0x9be07a, 0x6fbf5a, 0xb6e88a],
      grav: 160,
      drag: 3,
      up: [30, 110],
      size: [2, 3.2],
      life: [0.8, 1.4],
    },
    haze: { color: [0xe9f5c8, 0xd6ecb0], grav: -6 },
    markColor: 0x6fbf5a,
  },
};

const matterOf = (a: Ability): Matter | undefined =>
  BESPOKE.has(a.id) || SIGNED.has(a.id)
    ? undefined
    : MATTER[(a.element ?? "").toLowerCase() as Element];

function bits(
  fx: Fx,
  m: Matter,
  x: number,
  y: number,
  n: number,
  speed: [number, number],
  o: { z?: number; angle?: number; spread?: number } = {},
) {
  const b = m.bit;
  fx.burst({
    x,
    y,
    z: o.z ?? 8,
    count: n,
    kind: b.kind,
    color: b.color,
    speed,
    up: b.up,
    life: b.life,
    size: b.size,
    grav: b.grav,
    bounce: b.bounce ?? 0.3,
    drag: b.drag ?? 1.6,
    angle: o.angle,
    spread: o.spread,
  });
}
function haze(
  fx: Fx,
  m: Matter,
  x: number,
  y: number,
  n: number,
  speed: [number, number],
  size: [number, number] = [9, 15],
) {
  fx.burst({
    x,
    y,
    z: 6,
    count: n,
    kind: "smoke",
    color: m.haze.color,
    speed,
    up: [10, 45],
    life: [0.6, 1.1],
    size,
    grav: m.haze.grav ?? 0,
    drag: 2,
  });
}

/** A shot in flight sheds its element behind it. */
export function physicalTrail(scene: Phaser.Scene, pr: Projectile) {
  const m = matterOf(pr.ability);
  if (!m) return;
  const fx = fxFor(scene),
    back = Math.atan2(pr.vy, pr.vx) + Math.PI;
  fx.trail(`phys-${pr.id}`, 0.06, () =>
    bits(fx, m, pr.x, pr.y, 1, [10, 50], { z: 14, angle: back, spread: 0.6 }),
  );
}

/** A shot or blast lands: its stuff flies, haze rolls out, the floor is marked. */
export function physicalImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
) {
  const m = matterOf(a);
  if (!m) return;
  const fx = fxFor(scene),
    size = Math.max(a.explosion ?? 0, (a.radius || 12) * 2.5);
  bits(fx, m, x, y, Math.min(16, 5 + Math.round(size / 18)), [60, 120 + size]);
  haze(fx, m, x, y, Math.min(8, 2 + Math.round(size / 40)), [
    20,
    40 + size * 0.5,
  ]);
  if (m.mark)
    fx.decal({
      kind: m.mark,
      x,
      y,
      r: Math.min(70, size * 0.55),
      color: m.markColor,
      life: 2.6,
    });
}

/** A strike, a blast round the caster, or a self-cast. */
export function physicalCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
) {
  const m = matterOf(a);
  if (!m) return;
  const fx = fxFor(scene);
  if (a.kind === "melee" || a.kind === "rush" || a.kind === "blink") {
    // Feet dig in: a little dust where it pushes off, and its element flung
    // along the swing.
    haze(fx, MATTER.earth, x, y, 2, [20, 60], [7, 11]);
    const reach = a.range || 120;
    bits(
      fx,
      m,
      x + Math.cos(angle) * reach * 0.6,
      y + Math.sin(angle) * reach * 0.6,
      6,
      [60, 180],
      {
        z: 16,
        angle,
        spread: 0.8,
      },
    );
  } else if (a.kind === "nova") {
    // A ring of haze rolls out over the blast and its stuff is thrown wide.
    const r = a.radius || 150;
    for (let i = 0; i < 12; i++) {
      const aa = (i / 12) * Math.PI * 2;
      fx.burst({
        x: x + Math.cos(aa) * 24,
        y: y + Math.sin(aa) * 12,
        z: 4,
        count: 1,
        kind: "smoke",
        color: m.haze.color,
        angle: aa,
        spread: 0.1,
        speed: [r * 0.9, r * 1.3],
        up: [5, 25],
        life: [0.55, 0.85],
        size: [12, 18],
        drag: 2.2,
      });
    }
    bits(fx, m, x, y, 14, [r * 0.4, r * 1.2]);
    if (m.mark)
      fx.decal({
        kind: m.mark,
        x,
        y,
        r: r * 0.45,
        color: m.markColor,
        life: 3,
      });
  } else if (
    ["buff", "barrier", "counter", "clone", "rest", "veil"].includes(a.kind)
  ) {
    // Gathering power: its element rises round the caster.
    bits(fx, m, x, y, 6, [10, 40], { z: 4 });
  }
}

/** A beam: its element shed all along the line, and a hit where it ends. */
export function physicalBeam(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  tx: number,
  ty: number,
) {
  const m = matterOf(a);
  if (!m) return;
  const fx = fxFor(scene),
    len = Math.hypot(tx - x, ty - y);
  for (let d = 40; d < len; d += 70)
    bits(
      fx,
      m,
      x + ((tx - x) * d) / len,
      y + ((ty - y) * d) / len,
      1,
      [10, 50],
      { z: 14 },
    );
  physicalImpact(scene, a, tx, ty);
}

/** A lingering area: its element drifts about inside it while it lasts. */
export function physicalZone(scene: Phaser.Scene, z: Zone) {
  const m = matterOf(z.ability);
  if (!m) return;
  const fx = fxFor(scene),
    r = z.radius;
  fx.trail(`phys-zone-${z.id}`, 0.1, () => {
    const aa = Math.random() * Math.PI * 2,
      d = Math.sqrt(Math.random()) * r * 0.9;
    bits(
      fx,
      m,
      z.x + Math.cos(aa) * d,
      z.y + Math.sin(aa) * d * 0.82,
      1,
      [5, 30],
      { z: 4 },
    );
  });
  if (z.ability.ground && m.mark)
    fx.trail(`phys-zone-mark-${z.id}`, 999, () =>
      fx.decal({
        kind: m.mark!,
        x: z.x,
        y: z.y,
        r: r * 0.8,
        color: m.markColor,
        life: z.ability.duration + 1,
      }),
    );
}

/** A held cone (Crest Flare, Frost Breath): its stuff blown out along it. */
export function physicalChannel(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
) {
  const m = matterOf(a);
  if (!m) return;
  const fx = fxFor(scene);
  fx.trail(`phys-cone-${a.id}-${Math.round(x)}-${Math.round(y)}`, 0.05, () =>
    bits(
      fx,
      m,
      x + Math.cos(angle) * 30,
      y + Math.sin(angle) * 30,
      2,
      [120, (a.range || 200) * 1.2],
      {
        z: 14,
        angle,
        spread: Math.acos(a.arc ?? 0.7) * 0.8,
      },
    ),
  );
}

/** Being hit: a few bits of the attacker's element. */
export function physicalHit(
  scene: Phaser.Scene,
  element: string,
  x: number,
  y: number,
) {
  const m = MATTER[element.toLowerCase() as Element];
  if (!m) return;
  bits(fxFor(scene), m, x, y, 3, [40, 120], { z: 18 });
}
