import { TOWN_PLAZA_ROAD } from "../../../packages/shared/src/town";
import { WORLD_ART } from "../../../packages/shared/src/world-art";
import type { Sprite } from "./town-art";
import type { DogPose, HenPose } from "./town-animals";
import {
  henCanStand,
  henRoamStart,
  planHenRoam,
  type HenRoam,
} from "./town-hen-roaming";

export const MOTION_ATLAS = {
  width: 1536,
  height: 800,
  cellW: 192,
  cellH: 160,
} as const;
export function animalMotionCell(
  kind: "dog" | "hen" | "gull",
  pose: string,
  frame: number,
  brown = false,
) {
  return kind === "dog"
    ? pose === "walk"
      ? frame % 8
      : pose === "idle"
        ? 8
        : pose === "sit"
          ? 11
          : [10, 9, 9, 10][frame % 4]
    : kind === "hen"
      ? 12 +
        (brown ? 8 : 0) +
        (pose === "walk" ? frame % 4 : pose === "idle" ? 4 : 4 + (frame % 4))
      : 28 + (frame % 8);
}
/** Complete poses share fixed body scale and authored feet/body anchors.
 * They are never re-fitted to the changing wing/leg silhouette each frame. */
export function animalMotionSprite(
  source: CanvasImageSource,
  kind: "dog" | "hen" | "gull",
  pose: string,
  index: number,
  brown: boolean,
  frame: Sprite,
): Sprite {
  const cell = animalMotionCell(kind, pose, index, brown),
    h = kind === "dog" ? 128 : 160;
  const anchorY = kind === "dog" ? 125 : kind === "hen" ? 157 : 80;
  const scale = (frame.w - 4) / 192;
  return {
    ...frame,
    draw(ctx) {
      ctx.drawImage(
        source,
        (cell % 8) * 192,
        Math.floor(cell / 8) * 160,
        192,
        h,
        frame.ax - 96 * scale,
        frame.ay - anchorY * scale,
        192 * scale,
        h * scale,
      );
    },
  };
}
const TAU = Math.PI * 2;
const noise = (n: number) => {
  const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
};
const stepTime = (dt: number) => Math.max(0, Math.min(0.08, dt));
const ease = (current: number, target: number, dt: number, rate = 6) =>
  target + (current - target) * Math.exp(-dt * rate);

export function gullMotion(
  t: number,
  phase: number,
  vx: number,
  vy: number,
  sideProfile = true,
) {
  const cycle = (((t + phase) % 6) + 6) % 6,
    flapping = cycle < 4 / 3;
  const facing = vx < 0 ? -1 : 1;
  return {
    frame: flapping ? (2 + Math.floor(cycle * 12)) % 8 : 2,
    flapping,
    flipX: sideProfile && facing < 0,
    rotation: sideProfile
      ? facing * Math.max(-0.14, Math.min(0.14, Math.atan2(vy, Math.abs(vx))))
      : Math.atan2(vy, vx) + Math.PI / 2,
    lift: Math.sin((t + phase) * 1.7) * 1.5,
  };
}

export interface DogMotion {
  a: number;
  speed: number;
  gait: number;
  rest: number;
  pauseIn: number;
  clock: number;
  facing: number;
  restPose: "sniff" | "sit";
}
export const createDogMotion = (): DogMotion => ({
  a: 1.2,
  speed: 0,
  gait: 0,
  rest: 0,
  pauseIn: 6,
  clock: 0,
  facing: -1,
  restPose: "sniff",
});
export function stepDog(d: DogMotion, t: number, elapsed: number) {
  const dt = stepTime(elapsed);
  if (d.rest <= 0) {
    d.pauseIn -= dt;
    if (d.pauseIn <= 0) {
      d.rest = 2 + noise(t) * 2;
      d.pauseIn = 7 + noise(t * 3) * 7;
      d.clock = 0;
      d.restPose = noise(t * 5) > 0.6 ? "sit" : "sniff";
    }
  }
  d.speed = ease(d.speed, d.rest > 0 ? 0 : 42, dt);
  const groundSpeedFactor = Math.hypot(
    Math.sin(d.a),
    Math.cos(d.a) * WORLD_ART.groundY,
  );
  d.a += (d.speed * dt) / (455 * groundSpeedFactor);
  d.gait += (d.speed * dt) / 28;
  if (d.rest > 0 && d.speed < 3) {
    d.rest -= dt;
    d.clock += dt;
  }
  const vx = -Math.sin(d.a) * d.speed;
  if (Math.abs(vx) > 4) d.facing = vx < 0 ? -1 : 1;
  const moving = d.speed > 3;
  const pose: DogPose = moving
    ? "walk"
    : d.rest > 0 && d.clock > 0.25
      ? d.restPose
      : "idle";
  return {
    x: TOWN_PLAZA_ROAD.x + Math.cos(d.a) * 455,
    y: TOWN_PLAZA_ROAD.y + Math.sin(d.a) * 455 * WORLD_ART.groundY,
    facing: d.facing,
    pose,
    frame:
      pose === "walk"
        ? Math.floor(d.gait * 8) % 8
        : pose === "sniff"
          ? Math.floor(d.clock * 5) % 4
          : 0,
    breath: moving ? 1 : 1 + Math.sin(t * 2.2) * 0.005,
  };
}

export interface HenMotion {
  x: number;
  y: number;
  vx: number;
  vy: number;
  home: { x: number; y: number };
  phase: number;
  target: { x: number; y: number };
  remaining: number;
  walking: boolean;
  gait: number;
  clock: number;
  facing: number;
  choices: number;
  roam?: HenRoam;
}
export function createHenMotion(
  home: { x: number; y: number },
  phase: number,
  roaming = false,
): HenMotion {
  const start = roaming ? henRoamStart(home) : home;
  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    home,
    phase,
    target: start,
    remaining: 0.2 + noise(phase) * 1.5,
    walking: false,
    gait: noise(phase),
    clock: 0,
    facing: 1,
    choices: 0,
    roam: roaming ? { points: [], trip: 0, destination: start } : undefined,
  };
}
export function stepHen(c: HenMotion, elapsed: number) {
  const dt = stepTime(elapsed);
  c.remaining -= dt;
  if (c.remaining <= 0) {
    c.walking = !c.walking;
    c.clock = 0;
    c.choices++;
    c.remaining = c.walking
      ? (c.roam ? 12 : 1.5) +
        noise(c.phase + c.choices * 7) * (c.roam ? 14 : 1.5)
      : 1.8 + noise(c.phase + c.choices * 11) * 2;
    if (c.walking) {
      if (c.roam) {
        if (!c.roam.points.length)
          c.roam = planHenRoam(c, c.phase, c.roam.trip);
        c.target = c.roam.points[0] ?? { x: c.x, y: c.y };
      } else {
        const a = noise(c.phase + c.choices * 19) * TAU,
          r = 20 + noise(c.phase + c.choices * 23) * 42;
        c.target = {
          x: c.home.x + Math.cos(a) * r,
          y: c.home.y + Math.sin(a) * r * WORLD_ART.groundY,
        };
      }
    }
  }
  if (
    c.walking &&
    c.roam &&
    Math.hypot(c.target.x - c.x, c.target.y - c.y) < 3
  ) {
    c.roam.points.shift();
    if (c.roam.points.length) c.target = c.roam.points[0];
    else {
      c.walking = false;
      c.remaining = 2 + noise(c.phase + c.choices) * 2;
      c.clock = 0;
    }
  }
  const dx = c.target.x - c.x,
    dy = c.target.y - c.y,
    distance = Math.hypot(dx, dy);
  const speed = c.walking ? Math.min(c.roam ? 31 : 25, distance * 3) : 0;
  c.vx = ease(c.vx, distance > 1 ? (dx / distance) * speed : 0, dt);
  c.vy = ease(c.vy, distance > 1 ? (dy / distance) * speed : 0, dt);
  const oldX = c.x,
    oldY = c.y,
    nextX = c.x + c.vx * dt,
    nextY = c.y + c.vy * dt;
  if (!c.roam || henCanStand(nextX, nextY)) {
    c.x = nextX;
    c.y = nextY;
  } else {
    // Reject a blocked step instead of pushing/teleporting the bird out of
    // scenery. A fresh route after this pause resolves tight turning space.
    c.vx = c.vy = 0;
    c.walking = false;
    c.remaining = 1.2;
    c.clock = 0;
    c.roam.points = [];
  }
  const moving = Math.hypot(c.vx, c.vy) > 2;
  c.gait += Math.hypot(c.x - oldX, c.y - oldY) / 15;
  if (Math.abs(c.vx) > 3) c.facing = c.vx < 0 ? -1 : 1;
  if (!moving) c.clock += dt;
  const peck = c.clock % 2.1;
  const pose: HenPose = moving ? "walk" : peck < 1.15 ? "peck" : "idle";
  return {
    pose,
    frame: moving
      ? Math.floor(c.gait * 4) % 4
      : pose === "peck"
        ? Math.min(3, Math.floor(peck * 5))
        : 0,
    facing: c.facing,
  };
}
