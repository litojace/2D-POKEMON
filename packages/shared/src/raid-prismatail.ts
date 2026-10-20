import type { RaidAttack } from "./raid.js";
export interface LightPoint {
  x: number;
  y: number;
}
export interface PrismMirror extends LightPoint {
  angle: number;
}
export interface LightLink extends LightPoint {
  tx: number;
  ty: number;
  beam: number;
}
export const PRISMATAIL = {
  health: { base: 1350, perExtraPlayer: 880, gilded: 1.12 },
  perilDamage: [1, 1, 1.12, 1.24],
  cadence: { normal: 4.4, restless: 4, finalPhase: 0.78 },
  source: { x: 350, y: 450 },
  mirrors: [
    { x: 600, y: 300 },
    { x: 880, y: 300 },
    { x: 600, y: 600 },
    { x: 880, y: 600 },
  ],
  range: 300,
  heartRange: 260,
  burn: 3,
  expose: 6,
  lance: { delay: 1.1, width: 26, damage: 25 },
  fan: { delay: 1.45, radius: 650, damage: 24 },
  glare: { delay: 1, blind: 1.5 },
  halo: { delay: 2, radius: 150, width: 38, gap: 0.65, damage: 28 },
} as const;
export const PRISM_COLORS = [
  0xff899e, 0xffd778, 0x9aefb5, 0x80e1ff, 0xa5adff, 0xe5a0ff, 0xffb784,
  0xc4f8ef,
];
export const angleDifference = (a: number, b: number) =>
  Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** Mirrors point in eight visible directions; tolerance includes the width of the beam. */
export const mirrorReaches = (mirror: PrismMirror, target: LightPoint) =>
  angleDifference(
    mirror.angle,
    Math.atan2(target.y - mirror.y, target.x - mirror.x),
  ) <=
  Math.PI / 8 + 0.12;
export function prismatailPattern(phase: number, trait = ""): RaidAttack[] {
  const attacks: RaidAttack[] =
    phase === 1
      ? ["prism-lance", "fan-display", "glare"]
      : ["refraction", "halo-crush", "fan-display", "glare", "prism-lance"];
  if (trait === "dazzling") attacks.push("glare");
  return trait === "overcast"
    ? attacks.filter((a) => a !== "prism-lance")
    : attacks;
}
export interface RelayNode extends LightPoint {
  id: string;
  angle?: number;
  range?: number;
  player?: boolean;
  broadcast?: boolean;
}
/** Bounded graph search: no repeated node, no dead-player links, deterministic nearest-first routes. */
export function traceLight(
  source: LightPoint,
  nodes: RelayNode[],
  heart: LightPoint,
  range = 300,
  minimum = 2,
  blocked = new Set<string>(),
): RelayNode[] {
  const queue = nodes
    .filter(
      (n) =>
        n.player &&
        !blocked.has(n.id) &&
        Math.hypot(n.x - source.x, n.y - source.y) <= range,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - source.x, a.y - source.y) -
        Math.hypot(b.x - source.x, b.y - source.y),
    )
    .map((n) => [n]);
  for (let i = 0; i < queue.length && i < 4096; i++) {
    const path = queue[i],
      last = path[path.length - 1];
    const aligned = (n: LightPoint) =>
      last.angle === undefined ||
      mirrorReaches({ ...last, angle: last.angle }, n);
    if (
      path.length >= minimum &&
      aligned(heart) &&
      Math.hypot(last.x - heart.x, last.y - heart.y) <= PRISMATAIL.heartRange
    )
      return path;
    if (path.length >= 8) continue;
    const next = nodes
      .filter(
        (n) =>
          !blocked.has(n.id) &&
          !path.some((p) => p.id === n.id) &&
          aligned(n) &&
          Math.hypot(n.x - last.x, n.y - last.y) <= (last.range ?? range),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - last.x, a.y - last.y) -
          Math.hypot(b.x - last.x, b.y - last.y),
      );
    for (const n of next) {
      if (queue.length >= 4096) break;
      queue.push([...path, n]);
    }
  }
  return [];
}

/** Clip a ray to arena bounds without changing its locked direction. */
export function prismRayEnd(start: LightPoint, target: LightPoint): LightPoint {
  const dx = target.x - start.x,
    dy = target.y - start.y;
  if (Math.hypot(dx, dy) < 0.001) return { x: start.x - 1, y: start.y };
  const tx =
    dx > 0 ? (1560 - start.x) / dx : dx < 0 ? (40 - start.x) / dx : Infinity;
  const ty =
    dy > 0 ? (860 - start.y) / dy : dy < 0 ? (40 - start.y) / dy : Infinity;
  const t = Math.max(0, Math.min(tx, ty));
  return { x: start.x + dx * t, y: start.y + dy * t };
}
