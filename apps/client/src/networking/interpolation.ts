import {
  RULES,
  type Snapshot,
  type Vec,
} from "../../../../packages/shared/src/index";
type Pose = Vec & { angle: number };
type Frame = {
  time: number;
  received: number;
  players: Record<string, Pose & { vx: number; vy: number }>;
};

/**
 * Remote-fighter playback tuning.
 *
 * The delay behind the server timeline adapts to how irregularly snapshots
 * arrive: about one snapshot interval plus the recent 95th-percentile
 * lateness, within [min, max]. A steady connection plays close to `min`;
 * a jittery one buys itself enough buffer not to freeze.
 *
 * The playhead never jumps or rewinds: it runs at 0.8–1.6× real time
 * towards where it should be, so after a stall the opponent fast-forwards
 * briefly instead of teleporting, and a growing delay slows playback
 * gently. Only a gap of over half a second resynchronises at once.
 */
export const INTERPOLATION = {
  /** Fixed delay until enough arrivals are measured (s). */
  initial: 0.1,
  min: 0.08,
  max: 0.2,
  /** Extra headroom above measured lateness (s). */
  margin: 0.01,
  /** Arrivals measured for the lateness estimate (~4 s at 15 Hz). */
  window: 60,
  /** Arrivals needed before adapting. */
  warmup: 8,
  /** When the newest snapshot runs out, keep moving on its velocity (s). */
  extrapolate: 0.05,
  /** ...and never further than this (px). */
  extrapolateReach: 14,
  slowest: 0.8,
  fastest: 1.6,
  /** Seconds to close a playhead error at the rate limits above. */
  settle: 0.25,
  resync: 0.5,
};

/** Render remote positions slightly behind the server timeline to absorb jitter. */
export class InterpolationBuffer {
  frames: Frame[] = [];
  /** received - time·1000 for recent arrivals (ms). */
  private arrivals: number[] = [];
  private offset = 0;
  private playhead = -Infinity;
  private clock = -Infinity;
  private target = INTERPOLATION.initial;
  /** Server time (s) of the last sampled pose, for measurements. */
  get lastSampleTime() {
    return this.playhead;
  }
  /** The delay playback is currently aiming for (s). */
  get delay() {
    return this.target;
  }
  clear() {
    this.frames = [];
    this.arrivals = [];
    this.offset = 0;
    this.playhead = -Infinity;
    this.clock = -Infinity;
    this.target = INTERPOLATION.initial;
  }
  add(state: Snapshot, received: number) {
    const players: Frame["players"] = {};
    for (const p of state.players)
      players[p.id] = { x: p.x, y: p.y, angle: p.angle, vx: p.vx, vy: p.vy };
    this.frames.push({ time: state.time, received, players });
    if (this.frames.length > 12) this.frames.shift();
    this.arrivals.push(received - state.time * 1000);
    if (this.arrivals.length > INTERPOLATION.window) this.arrivals.shift();
    // A late packet must not reset the render clock backwards. Use the least
    // delayed arrival in the recent window as the server/client clock offset.
    let offset = Infinity;
    for (const a of this.arrivals) if (a < offset) offset = a;
    this.offset = offset;
    if (this.arrivals.length >= INTERPOLATION.warmup) {
      const late = this.arrivals.map((a) => a - offset).sort((a, b) => a - b);
      const p95 =
        late[Math.min(late.length - 1, Math.floor(late.length * 0.95))];
      // Snapshot spacing on the server timeline (slower if the server lags).
      let spacing = 1 / RULES.snapshot;
      if (this.frames.length >= 3) {
        const gaps = this.frames
          .slice(1)
          .map((f, i) => f.time - this.frames[i].time)
          .sort((a, b) => a - b);
        spacing = Math.max(spacing, gaps[gaps.length >> 1]);
      }
      this.target = Math.max(
        INTERPOLATION.min,
        Math.min(
          INTERPOLATION.max,
          spacing + p95 / 1000 + INTERPOLATION.margin,
        ),
      );
    }
  }
  /** Advance the playhead once per distinct clock reading. */
  private advance(now: number, delay: number) {
    const last = this.frames.at(-1)!;
    const desired = (now - this.offset) / 1000 - delay;
    if (this.playhead === -Infinity || now < this.clock) {
      this.playhead = desired;
    } else if (now > this.clock) {
      const dt = (now - this.clock) / 1000;
      const error = desired - this.playhead;
      if (Math.abs(error) > INTERPOLATION.resync) {
        // A long gap or a new timeline: resynchronise, never rewinding.
        this.playhead = Math.max(this.playhead, desired);
      } else {
        const rate = Math.max(
          INTERPOLATION.slowest,
          Math.min(INTERPOLATION.fastest, 1 + error / INTERPOLATION.settle),
        );
        this.playhead += dt * rate;
      }
    }
    this.clock = Math.max(this.clock, now);
    // Never further ahead than the newest data allows.
    const limit = last.time + INTERPOLATION.extrapolate;
    if (this.playhead > limit) this.playhead = limit;
    return this.playhead;
  }
  sample(id: string, now: number, delay = this.target): Pose | undefined {
    const last = this.frames.at(-1);
    if (!last) return;
    const target = this.advance(now, delay);
    if (target >= last.time) {
      const p = last.players[id];
      if (!p) return;
      // Briefly carry on along the newest velocity, then hold.
      const ahead = Math.min(target - last.time, INTERPOLATION.extrapolate);
      let dx = p.vx * ahead,
        dy = p.vy * ahead;
      const reach = Math.hypot(dx, dy);
      // A dash would overshoot: never guess more than a short step.
      if (reach > INTERPOLATION.extrapolateReach) {
        dx *= INTERPOLATION.extrapolateReach / reach;
        dy *= INTERPOLATION.extrapolateReach / reach;
      }
      return { x: p.x + dx, y: p.y + dy, angle: p.angle };
    }
    let before = this.frames[0],
      after = last;
    for (const frame of this.frames) {
      if (frame.time <= target) before = frame;
      if (frame.time >= target) {
        after = frame;
        break;
      }
    }
    const a = before.players[id],
      b = after.players[id];
    if (!a || !b) return last.players[id];
    const ratio =
      after.time > before.time
        ? Math.max(
            0,
            Math.min(1, (target - before.time) / (after.time - before.time)),
          )
        : 1;
    const angleDelta = Math.atan2(
      Math.sin(b.angle - a.angle),
      Math.cos(b.angle - a.angle),
    );
    return {
      x: a.x + (b.x - a.x) * ratio,
      y: a.y + (b.y - a.y) * ratio,
      angle: a.angle + angleDelta * ratio,
    };
  }
}
