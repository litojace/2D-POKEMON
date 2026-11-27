/**
 * The Plaza over a real network: other walkers and the ball, smoothly.
 *
 * The server sends the Plaza ten times a second, and a phone's network
 * delivers those snapshots unevenly: two together, then a gap. Chasing the
 * newest one (as the Plaza did) makes everyone else speed up and stall in
 * turn. Here each walker keeps the last second of snapshots with the
 * server's time on them, and is drawn a fixed moment in the past, between
 * the two snapshots around it (interpolation, as networked games do), so
 * an uneven delivery doesn't show.
 *
 * The ball is different: you kick it. Drawn from the server alone, it only
 * moved a network trip after you reached it (a quarter of a second on a
 * phone), so you ran into it before it went. The browser now runs the ball
 * on the same shared rules (plazaBallStep) in your own timeline, where your
 * fighter already is: touching it kicks it at once. Each snapshot, the
 * server's ball is run forward to the same moment and the browser's ball
 * eases onto it, so the server still decides where it goes (goals, other
 * kickers), and a kick it didn't see is undone a moment later.
 */
import {
  PLAZA,
  PLAZA_BALL,
  plazaBallStep,
  type PlazaBall,
  type PlazaBody,
} from "../../../../packages/shared/src/plaza";

export const PLAZA_NET = {
  /**
   * Other walkers are drawn this far behind the server's clock (ms): one
   * snapshot interval and a margin on a steady network, more on an uneven
   * one (the late arrivals of the last few seconds), up to `maxDelay`.
   */
  delay: 120,
  maxDelay: 360,
  /** Snapshots whose lateness sets the extra delay. */
  jitterWindow: 40,
  /** Past the newest snapshot, carry on along its velocity at most this long (ms). */
  extrapolate: 200,
  /** Snapshots kept per walker (ms). */
  keep: 1000,
  /** The server's clock offset drifts back down toward later arrivals this
   * much per snapshot (a lasting slower route is followed in a few seconds). */
  clockDecay: 0.04,
  /** Ball: after you touch it, the browser's ball is trusted this long (ms)
   * past the network lag before the server's corrections apply again. */
  touchTrust: 250,
  /** Ball: corrections smaller than this are left alone (px). */
  ballDeadZone: 6,
  /** Ball: past this the browser's ball jumps to the server's (px): only a
   * restart or a lost stream. Anything nearer (someone else's kick, seen a
   * network trip late) glides over quickly: a jump of a few hundred px
   * looked like the ball vanishing (owner, 23 Nov). */
  ballSnap: 700,
  /** Ball: while your own kick is trusted, a disagreement past this is
   * still taken (someone else kicked it too) (px). */
  ballTrustMax: 220,
  /** Ball: a correction eases in with this time constant (s). */
  ballEase: 0.12,
} as const;

/** The server's clock, seen from the browser's (performance.now) clock. */
export class ServerClock {
  private off: number | null = null;
  private late: number[] = [];
  /** A snapshot stamped `serverT` arrived at `localT`. */
  sample(serverT: number, localT: number) {
    const o = serverT - localT;
    // The least delayed arrival is the truest: a late one only nudges.
    if (this.off === null || o > this.off) this.off = o;
    else this.off += (o - this.off) * PLAZA_NET.clockDecay;
    this.late.push(this.off - o);
    if (this.late.length > PLAZA_NET.jitterWindow) this.late.shift();
  }
  /** How far behind the server's clock to draw others now (ms). */
  delay() {
    const l = [...this.late].sort((a, b) => a - b),
      p90 = l.length ? l[Math.floor(l.length * 0.9)] : 0;
    return Math.min(PLAZA_NET.maxDelay, PLAZA_NET.delay + p90);
  }
  now(localT: number) {
    return this.off === null ? null : localT + this.off;
  }
}

interface Sample {
  t: number;
  x: number;
  y: number;
  z: number;
}
/** One walker's (or the ball's) recent snapshots, drawn in the past. */
export class SnapTrack {
  private s: Sample[] = [];
  push(t: number, x: number, y: number, z = 0) {
    const s = this.s;
    if (s.length && t <= s[s.length - 1].t) {
      // The same moment again (a resend): keep the newer values.
      if (t === s[s.length - 1].t) s[s.length - 1] = { t, x, y, z };
      return;
    }
    s.push({ t, x, y, z });
    while (s.length > 2 && s[1].t < t - PLAZA_NET.keep) s.shift();
  }
  /** A teleport (a bounce pad landing, a rejoin): forget the path. */
  reset(t: number, x: number, y: number, z = 0) {
    this.s = [{ t, x, y, z }];
  }
  get newest() {
    return this.s[this.s.length - 1];
  }
  /** Where it was at server time `t`. */
  at(t: number): { x: number; y: number; z: number } | undefined {
    const s = this.s;
    if (!s.length) return undefined;
    if (t <= s[0].t) return s[0];
    const last = s[s.length - 1];
    if (t >= last.t) {
      if (s.length < 2) return last;
      const prev = s[s.length - 2],
        span = last.t - prev.t,
        ahead = Math.min(t - last.t, PLAZA_NET.extrapolate);
      if (span <= 0) return last;
      const k = ahead / span;
      return {
        x: last.x + (last.x - prev.x) * k,
        y: last.y + (last.y - prev.y) * k,
        z: Math.max(0, last.z + (last.z - prev.z) * k),
      };
    }
    let lo = 0,
      hi = s.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = s[lo],
      b = s[hi],
      k = (t - a.t) / (b.t - a.t);
    return {
      x: a.x + (b.x - a.x) * k,
      y: a.y + (b.y - a.y) * k,
      z: a.z + (b.z - a.z) * k,
    };
  }
}

/** Run a ball forward `ms` with no one touching it (the shared rules). */
export function ballAhead(ball: PlazaBall, ms: number): PlazaBall {
  const b = { ...ball };
  const last: { key?: number } = {};
  let left = Math.min(Math.max(ms, 0), 1000) / 1000;
  while (left > 1e-6) {
    const dt = Math.min(left, 1 / 60);
    plazaBallStep(b, [], dt, last);
    left -= dt;
    if (b.lock > 0) break;
  }
  return b;
}

/**
 * The ball as you see it: the shared rules, run in your own timeline with
 * you touching it, kept on the server's ball run forward to now.
 */
export class BallPrediction {
  readonly ball: PlazaBall;
  /** Where the ball is drawn, less where it is (px): a jump the server
   * forced (a goal it didn't give) glides away instead of blinking. */
  readonly vis = { x: 0, y: 0 };
  private touchedAt = -Infinity;
  private owe = { x: 0, y: 0 };
  private started = false;
  /** The server's last snapshot had the ball in a goal (its restart is a jump). */
  private srvGoal = false;
  constructor(start: PlazaBall) {
    this.ball = { ...start };
  }
  /** One frame: you (and only you) touch it. Returns true if you did. */
  step(me: PlazaBody, dt: number, now: number) {
    const b = this.ball;
    const kv = Math.exp(-dt / PLAZA_NET.ballEase);
    this.vis.x *= kv;
    this.vis.y *= kv;
    // Ease in what the server corrected, before the frame's own movement.
    if (this.owe.x || this.owe.y) {
      const k = 1 - Math.exp(-dt / PLAZA_NET.ballEase);
      b.x += this.owe.x * k;
      b.y += this.owe.y * k;
      this.owe.x *= 1 - k;
      this.owe.y *= 1 - k;
    }
    if (b.lock > 0) return false;
    const d = Math.hypot(b.x - me.x, b.y - me.y);
    const touching = me.z <= 30 && d < PLAZA_BALL.radius + PLAZA.radius;
    if (touching) this.touchedAt = now;
    const last: { key?: number } = {};
    plazaBallStep(b, [{ key: 1, body: me }], dt, last);
    // A goal is the server's to give: the browser's ball just waits there.
    if (b.lock > 0) b.lock = 9;
    return touching;
  }
  /**
   * The server's ball `srv`, `lagMs` behind your timeline (a network trip
   * and the snapshot's age): run it forward and steer the browser's ball
   * onto it, unless you touched the ball too recently for the server to
   * have seen that yet.
   */
  server(srv: PlazaBall, lagMs: number, now: number) {
    const b = this.ball;
    if (!this.started || srv.lock > 0) {
      // A goal the server gave: the ball glides on into the net from where
      // you see it (it used to blink there).
      if (this.started && !this.srvGoal) {
        this.vis.x += b.x - srv.x;
        this.vis.y += b.y - srv.y;
      }
      this.started = true;
      this.srvGoal = srv.lock > 0;
      Object.assign(b, srv);
      this.owe = { x: 0, y: 0 };
      return;
    }
    if (b.lock > 0) {
      const ox = b.x,
        oy = b.y;
      Object.assign(b, ballAhead(srv, lagMs));
      // The browser saw a goal the server didn't give: back in play,
      // gliding out of the net to where the server has it. (After a goal
      // the server gave, the restart at the centre spot is a jump.)
      if (!this.srvGoal && b.lock <= 0) {
        this.vis.x += ox - b.x;
        this.vis.y += oy - b.y;
      }
      this.srvGoal = false;
      this.owe = { x: 0, y: 0 };
      return;
    }
    this.srvGoal = false;
    const target = ballAhead(srv, lagMs);
    const dx = target.x - b.x,
      dy = target.y - b.y,
      err = Math.hypot(dx, dy);
    const trusting = now - this.touchedAt < lagMs + PLAZA_NET.touchTrust;
    if (err > PLAZA_NET.ballSnap) {
      Object.assign(b, target);
      this.owe = { x: 0, y: 0 };
      return;
    }
    if (trusting && err <= PLAZA_NET.ballTrustMax) return;
    // Take the server's speed; ease the position (no visible jump).
    b.vx = target.vx;
    b.vy = target.vy;
    b.vz = target.vz;
    if (Math.abs(target.z - b.z) > 30) b.z = target.z;
    this.owe = err < PLAZA_NET.ballDeadZone ? { x: 0, y: 0 } : { x: dx, y: dy };
  }
}
