/**
 * Your own walker in the Plaza: the browser moves you at once (the shared
 * plazaStep) and the server, a network trip later, decides. The server's
 * position is always a trip old, so comparing it with where you are *now*
 * reads every run or dash as an error and pulls you back (the old rubber
 * band on the dash track).
 *
 * Instead each stick or dash goes out numbered (`s`), and the server says
 * which number it has applied last and for how long it has moved you with it
 * (`ack: [s, ms]`). Its position then matches where the browser had you
 * `ms` after it sent that number, so that's what it's compared with: only a
 * real disagreement (a dash it refused, a hurdle one side tripped on, a
 * bump) is left, and it is eased in over a few frames.
 */
export const PLAZA_PREDICT = {
  /** How long the browser remembers where it had you (ms). */
  keepMs: 3000,
  /** Disagreements smaller than this are rounding: left alone (px). */
  deadZone: 4,
  /** Past this, jump straight to the server (teleports, a lost stream). */
  snap: 200,
  /** Ease a disagreement out with this time constant (s). */
  ease: 0.1,
} as const;

export interface Point {
  x: number;
  y: number;
}

export class PlazaPrediction {
  private seq = 0;
  private sentAt = new Map<number, number>();
  private trail: { t: number; x: number; y: number }[] = [];
  /** Correction still to ease in (px). */
  private owe = { x: 0, y: 0 };

  /** Number the next stick or dash sent at `now` (ms, the browser's clock). */
  send(now: number) {
    const s = ++this.seq;
    this.sentAt.set(s, now);
    return s;
  }

  /** Where the browser has you after a frame at `now`. */
  record(now: number, x: number, y: number) {
    this.trail.push({ t: now, x, y });
    const old = now - PLAZA_PREDICT.keepMs;
    let cut = 0;
    while (cut < this.trail.length - 1 && this.trail[cut + 1].t < old) cut++;
    if (cut) this.trail.splice(0, cut);
    for (const [s, t] of this.sentAt) if (t < old) this.sentAt.delete(s);
  }

  /** Where the browser had you at `t` (between frames, in a straight line). */
  at(t: number): Point | undefined {
    const tr = this.trail;
    if (!tr.length || t < tr[0].t) return undefined;
    if (t >= tr[tr.length - 1].t) return tr[tr.length - 1];
    let lo = 0,
      hi = tr.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tr[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = tr[lo],
      b = tr[hi],
      k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  }

  /**
   * The server says you are at `srv`, having applied stick or dash `ack[0]`
   * for `ack[1]` ms. `me` is where the browser has you now. Returns how far
   * off the browser was then (px); the correction is owed and eased in by
   * `ease`, or `snap` is true when it is too far to ease.
   */
  server(srv: Point, ack: [number, number] | undefined, me: Point) {
    const sent = ack && this.sentAt.get(ack[0]);
    // No numbered input to line up with (none yet, or long ago while standing
    // still): you and the server are both where you stopped.
    const then = (sent !== undefined && this.at(sent + ack![1])) || me;
    const dx = srv.x - then.x,
      dy = srv.y - then.y,
      err = Math.hypot(dx, dy);
    if (err > PLAZA_PREDICT.snap) {
      this.owe = { x: 0, y: 0 };
      return { err, snap: true, dx, dy };
    }
    this.owe = err < PLAZA_PREDICT.deadZone ? { x: 0, y: 0 } : { x: dx, y: dy };
    return { err, snap: false, dx, dy };
  }

  /** The part of the owed correction to apply this frame (px). */
  ease(dt: number): Point {
    const k = 1 - Math.exp(-dt / PLAZA_PREDICT.ease),
      x = this.owe.x * k,
      y = this.owe.y * k;
    this.owe.x -= x;
    this.owe.y -= y;
    return { x, y };
  }

  /** Move what the browser remembers by a correction it applied, so the next
   * comparison sees only what is still off. */
  shift(dx: number, dy: number) {
    if (!dx && !dy) return;
    for (const p of this.trail) {
      p.x += dx;
      p.y += dy;
    }
  }

  /** A fresh start (joining, a new Plaza copy). */
  reset() {
    this.trail = [];
    this.sentAt.clear();
    this.owe = { x: 0, y: 0 };
  }
}
