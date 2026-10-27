import type Phaser from "phaser";
import type { BossLifePose } from "./raid-boss-life";
import { paintBoss, type BossPart, type BossPaint } from "./boss-painted-rig";

type G = Phaser.GameObjects.Graphics;
interface Look {
  x: number;
  y: number;
  life: BossLifePose;
  alpha?: number;
  gilded?: boolean;
  hurt?: boolean;
  exposed?: boolean;
  dead?: boolean;
  key?: string;
  stagger?: boolean;
}
const part = (
  name: string,
  art: string,
  x: number,
  y: number,
  width: number,
  rest: Partial<BossPart> = {},
): BossPart => ({ name, art, x, y, width, ...rest });
const look = (o: Look): BossPaint => ({
  key: o.key,
  alpha: o.alpha,
  tint: o.hurt ? 0xffe8ed : o.gilded ? 0xffdda0 : 0xffffff,
});
const coreRing = (
  g: G,
  x: number,
  y: number,
  radius: number,
  color = 0xaaffdd,
) => {
  g.fillStyle(color, 0.14).fillCircle(x, y, radius);
  g.lineStyle(2.5, color, 0.85).strokeCircle(x, y, radius);
};

export function paintedGrumble(
  g: G,
  o: Look & {
    lift: number;
    stride: number;
    collapse: number;
    groundY: number;
    phase: number;
  },
) {
  const { x, y, life: l } = o,
    sway = l.sway * 0.025;
  const parts = [
    part("footL", "footL", x - 40, y + 52 + o.stride, 65, { oy: 0.8 }),
    part("footR", "footR", x + 40, y + 52 - o.stride, 65, { oy: 0.8 }),
    part("armL", "armL", x - 59, y - 33, 78, {
      ox: 0.8,
      oy: 0.14,
      rotation: 0.08 + sway + o.lift * 0.95 + l.windup * 0.5,
    }),
    part("armR", "armR", x + 59, y - 33, 78, {
      ox: 0.2,
      oy: 0.14,
      rotation: -0.08 + sway - o.lift * 0.95 - l.windup * 0.5,
    }),
    part("body", "body", x, y + 2, 151, {
      stretch: 1 + l.breath * 0.012,
      alpha: o.phase === 3 ? 0.78 : 1,
    }),
    part("head", "head", x + l.lookX * 3, y - 41 - l.windup * 5, 103, {
      oy: 0.88,
      rotation: l.lookX * 0.025 + sway * 0.3,
    }),
    part("core", "core", x, y + 18, o.exposed ? 34 : 26, {
      tint: o.exposed ? 0xbaffef : 0xffffff,
    }),
  ];
  if (o.phase === 3 && !o.dead)
    for (let i = 0; i < 4; i++) {
      const a = l.time * 1.2 + (i * Math.PI) / 2;
      parts.push(
        part(
          `rock${i}`,
          "rock",
          x + Math.cos(a) * 100,
          y + Math.sin(a) * 33,
          23,
          { rotation: a },
        ),
      );
    }
  return paintBoss(g, "grumblecrag", parts, {
    ...look(o),
    pivot: {
      x,
      y: o.groundY + 54,
      sx: 1 + o.collapse * 0.35,
      sy: 1 - o.collapse * 0.85,
    },
    front: (fg) => {
      if (o.exposed && !o.dead) coreRing(fg, x, y + 18, 27 + l.breath * 2);
    },
  });
}

export function paintedTide(
  g: G,
  o: Look & { facing: number; stranded: boolean; rise: number; sink: number },
) {
  const { x, y, life: l } = o,
    flip = o.facing < 0;
  const headWidth = o.stranded ? 95 : 99;
  const headY = y + (o.stranded ? 0 : 9);
  const headOrigin = o.stranded ? 0.93 : 0.72;
  const headAngle = o.facing * (l.sway * 0.025 + (o.stranded ? 0.16 : 0));
  // Measured pearl location in the complete head, transformed with its pivot.
  const jx = o.facing * (0.716 - 0.5) * headWidth;
  const jy = ((0.258 - headOrigin) * headWidth * 472) / 455;
  const pearlX = x + Math.cos(headAngle) * jx - Math.sin(headAngle) * jy;
  const pearlY = headY + Math.sin(headAngle) * jx + Math.cos(headAngle) * jy;
  // The head stump overlaps the intact coil's neck socket. Neither is a cut strip.
  return paintBoss(
    g,
    "tidewyrm",
    [
      part(
        "coil",
        "body",
        x - o.facing * (o.stranded ? 100 : 18),
        y + (o.stranded ? -32 : 27),
        o.stranded ? 180 : 157,
        {
          ox: flip ? 0.67 : 0.33,
          oy: o.stranded ? 0.45 : 0.28,
          flip,
          stretch:
            (o.stranded ? 0.42 : 1) * Math.max(0.08, o.rise * (1 - o.sink)),
          rotation: l.sway * 0.025,
        },
      ),
      part("head", "head", x, headY, headWidth, {
        oy: headOrigin,
        flip,
        rotation: headAngle,
      }),
    ],
    {
      ...look(o),
      alpha: Math.max(0, 1 - o.sink),
      front: (fg) => {
        if (o.exposed && !o.dead) coreRing(fg, pearlX, pearlY, 15, 0xffecc1);
      },
    },
  );
}

export function paintedGloom(
  g: G,
  o: Look & { facing: number; flicker: boolean; motion: number },
) {
  const { x, y, life: l } = o;
  const tailAlpha = o.flicker
    ? 0.3 + 0.7 * Math.abs(Math.sin(l.time * 7.3) * Math.sin(l.time * 3.1 + 1))
    : 1;
  return paintBoss(
    g,
    "gloomshade",
    [
      part("tail", "tail", x - o.facing * 35, y + 22, 80, {
        ox: o.facing > 0 ? 0.9 : 0.1,
        oy: 0.6,
        flip: o.facing > 0,
        rotation: Math.sin(l.time * 1.7) * 0.04 * o.motion,
        alpha: tailAlpha,
      }),
      part("earL", "earL", x - 31, y - 28, 53, {
        ox: 0.88,
        oy: 0.19,
        rotation: -0.12 - l.sway * 0.07 + l.windup * 0.2,
      }),
      part("earR", "earR", x + 31, y - 28, 53, {
        ox: 0.12,
        oy: 0.19,
        rotation: 0.12 - l.sway * 0.07 - l.windup * 0.2,
      }),
      part("footL", "footL", x - 27, y + 40, 39, { oy: 0.55 }),
      part("footR", "footR", x + 27, y + 40, 39, { oy: 0.55 }),
      part("body", "body", x, y, 109, { stretch: 1 + l.breath * 0.018 }),
      part("armL", "armL", x - 43, y + 18, 35, {
        ox: 0.8,
        oy: 0.2,
        rotation: -l.windup * 0.65 + l.sway * 0.05,
      }),
      part("armR", "armR", x + 43, y + 18, 35, {
        ox: 0.2,
        oy: 0.2,
        rotation: l.windup * 0.65 + l.sway * 0.05,
      }),
      ...(o.exposed && !o.dead ? [part("core", "core", x, y + 28, 22)] : []),
    ],
    {
      ...look(o),
      front: (fg) => {
        if (o.exposed && !o.dead) coreRing(fg, x, y + 28, 25, 0xffe6a4);
        if (o.stagger && !o.dead)
          for (let i = 0; i < 3; i++) {
            const a = l.time * 4 + (i * Math.PI * 2) / 3;
            fg.fillStyle(0xfff1a0, 1).fillCircle(
              x + Math.cos(a) * 36,
              y - 62 + Math.sin(a) * 8,
              4,
            );
          }
      },
    },
  );
}

export function paintedSomnara(g: G, o: Look) {
  const { x, y, life: l } = o,
    stroke = Math.sin(l.time * 1.65) * l.move;
  return paintBoss(
    g,
    "somnara",
    [
      part("tail", "tail", x + 94, y + 49, 96, {
        ox: 0.04,
        oy: 0.96,
        rotation: stroke * 0.13 - l.windup * 0.12,
      }),
      part("farFin", "finL", x - 18, y + 27, 49, {
        ox: 0.35,
        oy: 0.1,
        rotation: -0.35 - stroke * 0.18,
      }),
      part("body", "body", x, y, 253, { stretch: 1 + l.breath * 0.012 }),
      part("cottage", "cottage", x + 16, y - 52, 71, {
        oy: 1,
        rotation: l.sway * 0.012,
      }),
      part("cap", "cap", x - 65, y - 51, 66, {
        oy: 0.8,
        rotation: stroke * 0.035,
      }),
      part("nearFin", "finR", x + 24, y + 29, 51, {
        ox: 0.25,
        oy: 0.12,
        rotation: 0.25 + stroke * 0.15 + l.windup * 0.28,
      }),
      ...(o.exposed && !o.dead
        ? [part("core", "core", x - 32, y + 24, 32)]
        : []),
    ],
    {
      ...look(o),
      front: (fg) => {
        if (o.exposed && !o.dead) coreRing(fg, x - 32, y + 24, 29, 0xffdf8d);
      },
    },
  );
}

export function paintedPrisma(g: G, o: Look) {
  const { x, y, life: l } = o,
    fan = 1 + l.breath * 0.025 - l.windup * 0.12 - (o.exposed ? 0.1 : 0);
  const parts: BossPart[] = [];
  for (let i = 0; i < 9; i++) {
    const a =
      -Math.PI +
      (i * Math.PI) / 8 +
      Math.sin(l.time * 1.25 + i * 0.55) * 0.035 * l.move;
    parts.push(
      part(`feather${i}`, "feather", x, y + 24, 77 * fan, {
        oy: 0.96,
        rotation: a + Math.PI / 2,
        tint: [0xb0ecff, 0xd0b8ff, 0xffcadd, 0xffe7a0, 0xc2ffe7][i % 5],
      }),
    );
  }
  parts.push(
    part("footL", "footL", x - 23, y + 51, 27, { oy: 0.15 }),
    part("footR", "footR", x + 23, y + 51, 27, { oy: 0.15 }),
    part("body", "body", x, y + 12, 107, { stretch: 1 + l.breath * 0.012 }),
    part(
      "head",
      "head",
      x + l.lookX * 5,
      y - 24 - l.windup * 9 + l.breath * 2,
      55,
      { oy: 0.87, rotation: l.lookX * 0.035 },
    ),
    part(
      "crest",
      "crest",
      x + l.lookX * 5 + 2,
      y - 117 - l.windup * 9 + l.breath * 2,
      29,
      { oy: 1, rotation: l.sway * 0.035 },
    ),
    part("wingL", "wingL", x - 39, y + 4, 41, {
      ox: 0.8,
      oy: 0.16,
      rotation: 0.15 + l.windup * 0.45 + l.breath * 0.025,
    }),
    part("wingR", "wingR", x + 39, y + 4, 41, {
      ox: 0.2,
      oy: 0.16,
      rotation: -0.15 - l.windup * 0.45 + l.breath * 0.025,
    }),
    part("core", "core", x, y + 24, 29),
  );
  return paintBoss(g, "prismatail", parts, {
    ...look(o),
    front: (fg) => {
      if (!o.dead) {
        if (o.exposed) coreRing(fg, x, y + 24, 36 + l.breath * 2, 0xffe9a0);
        else {
          fg.fillStyle(0x9adfff, 0.08).fillEllipse(x, y + 15, 118, 136);
          fg.lineStyle(2.5, 0xc6efff, 0.7).strokeEllipse(x, y + 15, 118, 136);
        }
      }
    },
  });
}

export function paintedEmber(g: G, o: Look & { flight: number }) {
  const { x, y, life: l } = o;
  const flap =
    Math.sin(l.time * (o.flight > 0 ? 5.8 : 1.7)) *
    (o.flight > 0 ? 0.5 : 0.055) *
    l.move;
  const angle = -0.25 + flap - l.windup * 0.26 + (1 - o.flight) * 0.7;
  const hx = x + l.lookX * 5,
    hy = y - 44 - l.windup * 8 + l.breath * 2;
  return paintBoss(
    g,
    "emberwing",
    [
      part("tail", "tail", x + 34, y + 35, 91, {
        ox: 0.4,
        oy: 0.1,
        rotation: -0.8 + l.sway * 0.04,
      }),
      part("wingL", "wingL", x - 47, y - 8, 129, {
        ox: 0.87,
        oy: 0.13,
        rotation: angle,
      }),
      part("wingR", "wingR", x + 47, y - 8, 129, {
        ox: 0.13,
        oy: 0.13,
        rotation: -angle,
      }),
      part("footL", "footL", x - 29, y + 47 - o.flight * 8, 38, { oy: 0.2 }),
      part("footR", "footR", x + 29, y + 47 - o.flight * 8, 38, { oy: 0.2 }),
      part("body", "body", x, y, 140, { stretch: 1 + l.breath * 0.015 }),
      part("crest", "crest", hx, hy - 22, 74, {
        oy: 0.95,
        rotation: l.sway * 0.03,
      }),
      part("head", "head", hx, hy, 104, { oy: 0.63, rotation: l.lookX * 0.03 }),
      ...(o.exposed && !o.dead ? [part("core", "core", x, y + 22, 28)] : []),
    ],
    {
      ...look(o),
      front: (fg) => {
        if (o.exposed && !o.dead) coreRing(fg, x, y + 22, 34, 0xffe6ad);
        if (l.move)
          for (let i = 0; i < 4; i++) {
            const k = (l.time * 0.35 + i * 0.25) % 1;
            fg.fillStyle(i % 2 ? 0xffce87 : 0xff8b65, (1 - k) * 0.5).fillCircle(
              x + 50 + i * 14,
              y + 25 + k * 65,
              2.5,
            );
          }
      },
    },
  );
}

export function paintedTwin(g: G, o: Look & { blue: boolean; pulse: number }) {
  const { x, y, life: l } = o,
    suffix = o.blue ? "Blue" : "Gold",
    parts: BossPart[] = [];
  for (let j = 0; j < 5; j++)
    parts.push(
      part(`tail${j}`, `tail${suffix}`, x - 36 + j * 18, y + 26, 26, {
        ox: 0.5,
        oy: 0.06,
        rotation:
          Math.sin(l.time * (o.blue ? 2.5 : 3.4) - j * 0.3 - 0.7) *
          0.13 *
          l.move,
        stretch: 1 - o.pulse * 0.06,
      }),
    );
  parts.push(
    part("body", o.blue ? "blue" : "gold", x, y, 130 + o.pulse * 5, {
      stretch: 1 - o.pulse * 0.035 - l.windup * 0.04,
    }),
    part("cap", `cap${suffix}`, x, y - 42, 73, {
      oy: 0.85,
      rotation: l.sway * 0.025,
    }),
    part("bolt", `bolt${suffix}`, x + 9, y - 57, 23, {
      rotation: l.sway * 0.025,
    }),
    ...(o.exposed && !o.dead ? [part("core", "core", x, y + 18, 27)] : []),
  );
  return paintBoss(g, "storm-twins", parts, {
    ...look(o),
    front: (fg) => {
      if (o.exposed && !o.dead) coreRing(fg, x, y + 18, 25);
      if (o.dead) {
        fg.lineStyle(2.5, 0x243752, 0.9);
        for (const side of [-1, 1]) {
          const ex = x + side * 25,
            ey = y;
          fg.lineBetween(ex - 5, ey - 4, ex + 5, ey + 4).lineBetween(
            ex + 5,
            ey - 4,
            ex - 5,
            ey + 4,
          );
        }
      }
    },
  });
}
