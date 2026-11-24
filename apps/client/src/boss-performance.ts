import type { Fighter, Snapshot } from "@arena/shared";
import type { RaidWarning } from "../../../packages/shared/src/raid";
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const easeBoss = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export interface BossCast {
  id: number;
  kind: RaidWarning["kind"];
  age: number;
  angle: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  radius: number;
  spread?: number;
}
/** Presentation follows confirmed server telegraphs; an interrupted windup never
 * turns into a cosmetic hit. Each twin owns its own caster-filtered performance. */
export class BossPerformance {
  private pending = new Map<number, RaidWarning>();
  private fired = new Set<number>();
  private bursts: BossCast[] = [];
  private lastHp = 0;
  private recoil = 0;
  private lastPhase = 1;
  private phaseAge = 10;
  private lastServer = -1;
  private lastX = 0;
  private lastY = 0;
  private velocity = 0;
  reset(b: Fighter, phase: number) {
    this.pending.clear();
    this.fired.clear();
    this.bursts = [];
    this.lastHp = b.hp;
    this.recoil = 0;
    this.lastPhase = phase;
    this.phaseAge = 10;
    this.lastServer = -1;
    this.lastX = b.x;
    this.lastY = b.y;
    this.velocity = 0;
  }
  sample(
    state: Snapshot,
    b: Fighter,
    dt: number,
    reduced: boolean,
    windup: number,
  ) {
    const r = state.raid!,
      alive = b.hp > 0 && r.result !== "victory";
    const paused = state.phase === "paused";
    if (b.hp < this.lastHp && alive) this.recoil = 1;
    this.lastHp = b.hp;
    this.recoil = Math.max(0, this.recoil - dt * 5);
    if (r.phase !== this.lastPhase) this.pending.clear();
    if (r.phase > this.lastPhase) this.phaseAge = 0;
    this.lastPhase = r.phase;
    this.phaseAge += dt;
    const serverDt = state.time - this.lastServer;
    if (!paused && this.lastServer >= 0 && serverDt > 0) {
      const speed = Math.min(
        500,
        Math.hypot(b.x - this.lastX, b.y - this.lastY) / serverDt,
      );
      this.velocity += (speed - this.velocity) * 0.35;
    }
    this.lastServer = state.time;
    this.lastX = b.x;
    this.lastY = b.y;
    for (const event of this.bursts) event.age += dt;
    this.bursts = this.bursts.filter((e) => e.age < 0.85);
    const relevant = r.warnings.filter(
      (w) => !w.casterId || w.casterId === b.id,
    );
    const active = new Set(relevant.map((w) => w.id));
    for (const w of relevant) {
      if (w.at >= state.time - 0.25 && !this.fired.has(w.id))
        this.pending.set(w.id, { ...w });
    }
    const cancelled =
      !alive || r.staggerUntil > state.time || state.phase !== "playing";
    if (!paused)
      for (const [id, w] of this.pending) {
        const due = state.time - w.at;
        if (cancelled || (!active.has(id) && due < 0)) {
          this.pending.delete(id);
          continue;
        }
        if (due >= 0) {
          if (due < 0.3 && !reduced) {
            this.bursts.push({
              id,
              kind: w.kind,
              spread: w.spread,
              age: 0,
              x: w.x,
              y: w.y,
              tx: w.tx,
              ty: w.ty,
              radius: w.radius,
              angle: Math.atan2(w.ty - w.y, w.tx - w.x),
            });
          }
          this.fired.add(id);
          this.pending.delete(id);
        }
      }
    if (this.fired.size > 256) this.fired = new Set(relevant.map((w) => w.id));
    if (cancelled && !paused) this.pending.clear();
    this.bursts = this.bursts.slice(-8);
    const latest = this.bursts[this.bursts.length - 1];
    const age = latest?.age ?? 10;
    const strike = alive && !reduced ? Math.exp(-age * 12) : 0;
    const follow =
      alive && !reduced ? Math.sin(age * 13) * Math.exp(-age * 6) : 0;
    return {
      gather: alive ? easeBoss(windup) : 0,
      strike,
      follow,
      recoil: reduced ? 0 : this.recoil,
      enrage: reduced || !alive ? 0 : Math.max(0, 1 - this.phaseAge / 1.2),
      locomotion: reduced || !alive ? 0 : clamp(this.velocity / 170),
      casts: reduced || !alive ? [] : this.bursts.map((e) => ({ ...e })),
    };
  }
}
