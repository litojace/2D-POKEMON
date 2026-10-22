import type Phaser from "phaser";
import type { Fighter, Snapshot } from "@arena/shared";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Cosmetic posing only. Warning geometry, world positions and clocks stay authoritative. */
export class BossLife {
  private run = "";
  private serverTime = -1;
  private result: unknown;
  private clock = 0;
  private elapsed = 0;
  private lookX = 0;
  private lookY = 0;

  sample(state: Snapshot, boss: Fighter, clock: number, reduced: boolean) {
    const r = state.raid!;
    const run = `${state.code}:${r.boss}:${r.seed}:${boss.id}`;
    const reset =
      run !== this.run ||
      state.time < this.serverTime ||
      (!!this.result && !r.result);
    const aimX = Math.cos(boss.angle),
      aimY = Math.sin(boss.angle);
    if (reset) {
      this.run = run;
      this.elapsed = 0;
      this.lookX = aimX;
      this.lookY = aimY;
    }
    const dt =
      reset || state.phase === "paused"
        ? 0
        : Math.max(0, Math.min(0.05, clock - this.clock));
    this.clock = clock;
    this.serverTime = state.time;
    this.result = r.result;
    this.elapsed += dt;
    const follow = 1 - Math.exp(-dt * 7);
    this.lookX += (aimX - this.lookX) * follow;
    this.lookY += (aimY - this.lookY) * follow;
    // Preserve a pose during reconnect pauses; do not restart cycles on network snapshots.
    const t = reduced ? 0 : this.elapsed;
    const alive = boss.hp > 0 && r.result !== "victory";
    const move = reduced || !alive ? 0 : 1;
    let windup = 0;
    if (
      (state.phase === "playing" || state.phase === "paused") &&
      alive &&
      r.staggerUntil <= state.time
    )
      for (const w of r.warnings) {
        if ((w.casterId && w.casterId !== boss.id) || w.at < state.time)
          continue;
        const start = w.startedAt ?? w.at - 1.5;
        if (state.time < start) continue;
        windup = Math.max(
          windup,
          clamp((state.time - start) / Math.max(0.01, w.at - start)),
        );
      }
    if (reduced && windup > 0) windup = 0.65;
    const offset = (r.seed % 17) * 0.21 + (boss.id.charCodeAt(0) % 5) * 0.3;
    const blinkAt = (t + offset) % 4.8;
    const blink =
      move && windup < 0.25 && blinkAt > 4.56
        ? Math.sin(((blinkAt - 4.56) / 0.24) * Math.PI)
        : 0;
    return {
      time: t,
      breath: Math.sin(t * 1.8) * move,
      sway: Math.sin(t * 1.15) * move,
      blink,
      lookX: reduced ? aimX : this.lookX,
      lookY: reduced ? aimY : this.lookY,
      windup,
      move,
    };
  }
}
export type BossLifePose = ReturnType<BossLife["sample"]>;
const lives = new WeakMap<object, Map<string, BossLife>>();
export function bossLife(
  g: object,
  state: Snapshot,
  boss: Fighter,
  clock: number,
  reduced: boolean,
) {
  let group = lives.get(g);
  if (!group) {
    group = new Map();
    lives.set(g, group);
  }
  const key = `${state.raid!.boss}:${boss.id}`;
  let life = group.get(key);
  if (!life) {
    // A graphics layer normally holds one boss (or two twins).
    if (group.size >= 8) group.clear();
    life = new BossLife();
    group.set(key, life);
  }
  return life.sample(state, boss, clock, reduced);
}

/** Small expressive eyes, with a soft lid rather than a flashing on/off blink. */
export function bossEye(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  pose: BossLifePose,
  color: number,
  alpha = 1,
) {
  const open = Math.max(0.06, 1 - pose.blink),
    height = h * open;
  g.fillStyle(0x14213b, alpha).fillEllipse(x, y, w + 3, height + 3);
  g.fillStyle(color, alpha).fillEllipse(
    x + pose.lookX * 1.5,
    y + pose.lookY,
    w - 3,
    Math.max(1, height - 1),
  );
  if (open > 0.3)
    g.fillStyle(0xffffff, alpha * 0.95).fillEllipse(
      x - w * 0.13,
      y - height * 0.22,
      w * 0.23,
      height * 0.22,
    );
}
