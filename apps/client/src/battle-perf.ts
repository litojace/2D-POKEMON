/**
 * How smoothly battles really run on players' devices.
 *
 * The meter sees every rendered frame of live play (never menus, hidden
 * tabs or rounds not being played). Unlike the quality governor it keeps
 * frames slower than 250 ms, counted as stalls too: on the slowest phones
 * nearly every frame is that slow, and those are the phones it must hear
 * from. Only a gap over 2 s (a device that slept) is left out. Once per
 * match, at its end, the client sends a summary as
 * "battle-perf" and the server logs it as "arena-perf": frame rate, slowest
 * frames, how much of the time stuttered, and the graphics level. No name or
 * account goes with it. With `?perf=1` the same numbers show on screen
 * (perf-overlay.ts) for a player to screenshot.
 */
import { buildId } from "./build-id";

/** A frame slower than this is a stall (counted, and in the numbers). */
export const PERF_STALL = 250;
/** A gap longer than this is a pause, not a frame: left out. */
export const PERF_PAUSE = 2000;
/** A frame that missed 30 fps. */
export const PERF_JANK = 34;
/** At most this many frames are kept (about 11 minutes at 60 fps). */
const MAX_FRAMES = 40_000;
/** A match shorter than this (live play) is not worth a report. */
export const PERF_MIN_SECONDS = 10;

export interface PerfSummary {
  /** Seconds of live play measured. */
  seconds: number;
  frames: number;
  /** Frames per second at the median frame. */
  fps: number;
  /** The 95th percentile frame time (ms). */
  frameP95: number;
  /** The 99th percentile frame time (ms): the worst hitches, not their share. */
  frameP99: number;
  /** Share of the time spent in frames that missed 30 fps (0–1). */
  jank: number;
  /** Frames slower than 250 ms. */
  stalls: number;
}

/**
 * What one frame held, for the report's detail (`BattlePerfMeter.detail`):
 * where a slow phone's time goes, not only how much of it.
 */
export interface FrameSample {
  /**
   * Our own work in the frame (ms): Phaser's step from its start to the end
   * of rendering, i.e. game logic plus building the draw calls. Short work
   * in a long frame means the graphics chip (or heat) set the pace.
   */
  work?: number;
  /** The effects engine's last frame (fx-engine.ts FxFrameStats). */
  glow?: number;
  soft?: number;
  particles?: number;
  /** Objects on the battle scene's display list. */
  objects?: number;
  /** The raid boss's phase (1, 2, ...); none outside raids. */
  phase?: number;
  /** The boss attacks being warned of, as one key ("nightfall,pounce"). */
  attacks?: string;
}

/** Seconds of live play per slice of the report's timeline. */
export const PERF_SLICE_SECONDS = 15;
/** At most this many slices are reported (an hour of play). */
const MAX_SLICES = 240;

/**
 * The report's detail: how the match changed over time, how much of each
 * frame was our own work, and what the scene held in its slowest frames.
 */
export interface PerfDetail {
  /** Our work per frame (ms), median and 95th percentile. */
  workP50?: number;
  workP95?: number;
  /** Frames per second and stutter share per 15 s of live play, in order. */
  sliceFps: number[];
  sliceJank: number[];
  /**
   * The scene at the median frame and over the slowest 5% of frames:
   * glow and soft cover (screens), particles, display-list objects.
   */
  glowP50?: number;
  glowSlow?: number;
  softP50?: number;
  softSlow?: number;
  particlesP50?: number;
  particlesSlow?: number;
  objectsP50?: number;
  objectsSlow?: number;
  /** Per raid boss phase: seconds, frames per second, stutter share. */
  phases?: { phase: number; seconds: number; fps: number; jank: number }[];
  /** The boss attacks most often warned of in the slowest 5% of frames. */
  attacksSlow?: string[];
}

export class BattlePerfMeter {
  private last: number | undefined;
  private steps: number[] = [];
  private samples: (FrameSample | undefined)[] = [];
  private total = 0;
  /** Feed every rendered frame; `live` is false outside live play. */
  frame(now: number, live: boolean, sample?: FrameSample) {
    if (!live) {
      this.last = undefined;
      return;
    }
    const last = this.last;
    this.last = now;
    if (last === undefined) return;
    const step = now - last;
    if (step <= 0 || step > PERF_PAUSE) return;
    if (this.steps.length >= MAX_FRAMES) {
      // Keep the most recent half: a long match still reports its whole
      // shape closely enough, in bounded memory.
      const dropped = this.steps.splice(0, MAX_FRAMES / 2);
      this.samples.splice(0, MAX_FRAMES / 2);
      this.total -= dropped.reduce((a, b) => a + b, 0);
    }
    this.steps.push(step);
    this.samples.push(sample);
    this.total += step;
  }
  /** The whole measurement, or only its last `ms` (the overlay's view). */
  summary(ms = Infinity): PerfSummary {
    let steps = this.steps;
    if (Number.isFinite(ms)) {
      let sum = 0,
        i = steps.length;
      while (i > 0 && sum < ms) sum += steps[--i];
      steps = steps.slice(i);
    }
    const total = steps.reduce((a, b) => a + b, 0);
    if (!steps.length || total <= 0)
      return {
        seconds: 0,
        frames: 0,
        fps: 0,
        frameP95: 0,
        frameP99: 0,
        jank: 0,
        stalls: 0,
      };
    const sorted = steps.slice().sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    const jankTime = steps
      .filter((s) => s > PERF_JANK)
      .reduce((a, b) => a + b, 0);
    const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
    return {
      seconds: round(total / 1000),
      frames: steps.length,
      fps: round(1000 / median),
      frameP95: round(sorted[Math.floor(sorted.length * 0.95)]),
      frameP99: round(sorted[Math.floor(sorted.length * 0.99)]),
      jank: round(jankTime / total, 3),
      stalls: steps.filter((s) => s > PERF_STALL).length,
    };
  }
  /** The whole match's detail, for its report (not the overlay: it sorts). */
  detail(): PerfDetail {
    const steps = this.steps,
      samples = this.samples;
    const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
    const pick = (list: number[], q: number) => {
      if (!list.length) return undefined;
      const sorted = list.slice().sort((a, b) => a - b);
      return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    };
    const jankOf = (from: number, to: number) => {
      let time = 0,
        jank = 0;
      for (let i = from; i < to; i++) {
        time += steps[i];
        if (steps[i] > PERF_JANK) jank += steps[i];
      }
      return { time, jank };
    };
    // The timeline: 15 s slices of live play (a last, partial one counts
    // from 5 s).
    const sliceFps: number[] = [],
      sliceJank: number[] = [];
    let start = 0,
      time = 0;
    const close = (end: number) => {
      const t = jankOf(start, end);
      if (t.time >= 5000 && sliceFps.length < MAX_SLICES) {
        sliceFps.push(round(((end - start) * 1000) / t.time));
        sliceJank.push(round(t.jank / t.time, 3));
      }
      start = end;
      time = 0;
    };
    for (let i = 0; i < steps.length; i++) {
      time += steps[i];
      if (time >= PERF_SLICE_SECONDS * 1000) close(i + 1);
    }
    if (start < steps.length) close(steps.length);
    const out: PerfDetail = { sliceFps, sliceJank };
    // Our own work per frame.
    const work = samples.flatMap((s) =>
      s?.work !== undefined && s.work >= 0 ? [s.work] : [],
    );
    const w50 = pick(work, 0.5),
      w95 = pick(work, 0.95);
    if (w50 !== undefined) out.workP50 = round(w50);
    if (w95 !== undefined) out.workP95 = round(w95);
    // The scene: at the median frame, and over the slowest 5%.
    const order = steps.map((_, i) => i).sort((a, b) => steps[b] - steps[a]);
    const slow = order.slice(0, Math.max(1, Math.ceil(steps.length * 0.05)));
    const scene = (
      key: "glow" | "soft" | "particles" | "objects",
      digits: number,
    ) => {
      const all = samples.flatMap((s) =>
        typeof s?.[key] === "number" ? [s[key] as number] : [],
      );
      const inSlow = slow.flatMap((i) =>
        typeof samples[i]?.[key] === "number"
          ? [samples[i]![key] as number]
          : [],
      );
      const p50 = pick(all, 0.5),
        s50 = pick(inSlow, 0.5);
      return {
        p50: p50 === undefined ? undefined : round(p50, digits),
        slow: s50 === undefined ? undefined : round(s50, digits),
      };
    };
    const glow = scene("glow", 2),
      soft = scene("soft", 2),
      particles = scene("particles", 0),
      objects = scene("objects", 0);
    if (glow.p50 !== undefined) out.glowP50 = glow.p50;
    if (glow.slow !== undefined) out.glowSlow = glow.slow;
    if (soft.p50 !== undefined) out.softP50 = soft.p50;
    if (soft.slow !== undefined) out.softSlow = soft.slow;
    if (particles.p50 !== undefined) out.particlesP50 = particles.p50;
    if (particles.slow !== undefined) out.particlesSlow = particles.slow;
    if (objects.p50 !== undefined) out.objectsP50 = objects.p50;
    if (objects.slow !== undefined) out.objectsSlow = objects.slow;
    // Raid boss phases.
    const byPhase = new Map<number, number[]>();
    samples.forEach((s, i) => {
      if (s?.phase === undefined) return;
      if (!byPhase.has(s.phase)) byPhase.set(s.phase, []);
      byPhase.get(s.phase)!.push(i);
    });
    if (byPhase.size) {
      out.phases = [...byPhase]
        .sort((a, b) => a[0] - b[0])
        .slice(0, 12)
        .flatMap(([phase, idx]) => {
          let t = 0,
            j = 0;
          for (const i of idx) {
            t += steps[i];
            if (steps[i] > PERF_JANK) j += steps[i];
          }
          return t > 0
            ? [
                {
                  phase,
                  seconds: round(t / 1000),
                  fps: round((idx.length * 1000) / t),
                  jank: round(j / t, 3),
                },
              ]
            : [];
        });
    }
    // The boss attacks warned of in the slowest frames.
    const counts = new Map<string, number>();
    for (const i of slow)
      for (const kind of new Set((samples[i]?.attacks ?? "").split(",")))
        if (kind) counts.set(kind, (counts.get(kind) ?? 0) + 1);
    if (counts.size)
      out.attacksSlow = [...counts]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([kind]) => kind);
    return out;
  }
  reset() {
    this.last = undefined;
    this.steps = [];
    this.samples = [];
    this.total = 0;
  }
}

/** Five taps on Settings → Graphics' title (main.ts): saved on this device (the iPhone
 *  app has no address bar for `?perf=1`). */
export function setPerfMode(on: boolean) {
  try {
    if (on) localStorage.setItem("ea-perf", "1");
    else localStorage.removeItem("ea-perf");
  } catch {
    /* Optional preference. */
  }
}
/** `?perf=1` in the address (or `ea-perf` = "1" saved on this device). */
export function perfMode(
  search = typeof location === "undefined" ? "" : location.search,
) {
  if (/[?&]perf=1(?:&|$)/.test(search)) return true;
  try {
    return localStorage.getItem("ea-perf") === "1";
  } catch {
    return false;
  }
}

/**
 * The network side of a match, from the same device: why a battle can feel
 * late or jerky while it draws at full frame rate. Round trips come from the
 * ping badge; snapshot gaps are how irregularly the server's 30 a second
 * arrive; corrections are how far your own fighter jumped when a snapshot
 * disagreed with what was predicted. Confirmation starts at prediction,
 * not the DOM press: pressToSend measures that earlier local wait apart.
 */
export interface SlowInputTrace {
  action: string;
  source: "touch-controls" | "unknown";
  deliveryMs: number;
  deadlineMs: number;
  totalMs: number;
  frameGapMs?: number;
}
export interface HitTrace {
  gap: number;
  eventAgeMs: number;
  leadMs: number;
  timed: boolean;
}

export interface NetSummary {
  /** At most eight worst accepted inputs/hits; durations only, no timestamps or ids. */
  slowInputs?: SlowInputTrace[];
  farHits?: HitTrace[];
  hitTraceVersion: 1;
  rttP50: number;
  rttP95: number;
  /** 95th percentile gap between snapshots (ms; about 33 is on time). */
  snapGapP95: number;
  /** Share of snapshot gaps over 120 ms (a late or bunched snapshot). */
  snapLate: number;
  /** Your fighter's corrections over 4 px, per minute of play. */
  corrections: number;
  /** The largest correction (px). */
  correctionMax: number;
  /** Median wait from predicted cast to server confirmation (ms). */
  confirmP50: number;
  confirmP95?: number;
  confirmP99?: number;
  /** DOM action event to the emit carrying it (ms); excludes RTT/confirm. */
  pressSamples?: number;
  pressToSendP50?: number;
  pressToSendP95?: number;
  pressToSendP99?: number;
  /** Event delivery delay vs the subsequent wait for the input deadline. */
  eventToHandlerP95?: number;
  handlerToSendP95?: number;
  /** Actual gaps between local emits during uninterrupted live play (ms). */
  sendGapP50?: number;
  sendGapP95?: number;
  sendGapP99?: number;
  sendGapMax?: number;
  /**
   * The corrections a minute by cause (networking/correction-cause.ts):
   * hits and statuses are expected; "other" ones mean the prediction is
   * wrong somewhere.
   */
  correctionsHit: number;
  correctionsStatus: number;
  correctionsMove: number;
  correctionsOther: number;
  /**
   * Hits on you that landed while you were drawn more than HIT_GAP_PX from
   * where the server hit you: a hit that looked like a miss on screen.
   */
  hitsFar: number;
  /** The largest such gap (px; 0 when none). */
  hitGapMax: number;
  /** The longest gap between snapshots (ms). */
  snapGapMax: number;
  /** The median correction over 4 px (px; one step is about 9). */
  correctionP50: number;
  /**
   * Holds a minute: times the server reported ticks held for your late
   * inputs (Fighter.held went above 0: input was late), and the
   * most ticks held at once.
   */
  holds: number;
  holdMax: number;
  /**
   * Inputs this device sent a second of live play: its input clock, which
   * must run at the server's 30 (`serverHz` in the same report).
   */
  inputHz: number;
}
/** A hit landing this far from where you were drawn looked like a miss (one fighter radius). */
export const HIT_GAP_PX = 24;
/** Match the event's server moment, rather than the enclosing snapshot's time. */
export function hitDrawTime(
  receivedAt: number,
  leadMs: number,
  snapshotTime: number,
  event: { at?: number; miss?: boolean },
): number | undefined {
  if (event.miss) return;
  if (event.at === undefined) return receivedAt - leadMs;
  if (
    !Number.isFinite(event.at) ||
    event.at < 0 ||
    event.at > snapshotTime + 0.001
  )
    return;
  return receivedAt - leadMs - Math.max(0, snapshotTime - event.at) * 1000;
}

/**
 * How far from (x, y) your fighter was drawn at time `at` (ms): the drawn
 * sample nearest that time, if one is within 100 ms. `at` must be the frame
 * that showed the server's moment of the hit: the snapshot's arrival minus
 * the un-eased lead (LocalTimeline.estimate). The eased lead picked a frame
 * 66-99 ms too early and counted most hits on a moving fighter as far
 * (scripts/perf/correction-sim.ts, 20 Nov 2026).
 */
export function drawnGap(
  drawn: readonly { t: number; x: number; y: number }[],
  at: number,
  x: number,
  y: number,
): number | undefined {
  let best: (typeof drawn)[number] | undefined;
  for (const d of drawn)
    if (!best || Math.abs(d.t - at) < Math.abs(best.t - at)) best = d;
  if (best && Math.abs(best.t - at) < 100)
    return Math.hypot(best.x - x, best.y - y);
}
/**
 * A snapshot gap longer than this is late (the server sends one every
 * 33 ms; 67 ms before 23 Nov 2026, kept at 120 so reports stay comparable).
 */
export const SNAP_LATE = 120;
/** A correction smaller than this is not noticeable. */
export const CORRECTION_PX = 4;
const MAX_SAMPLES = 20_000;

export class NetMeter {
  private frames: number[] = [];
  private slowInputs: SlowInputTrace[] = [];
  private farHits: HitTrace[] = [];
  /** Record only the clock, without a DOM read or an allocation per frame. */
  frame(now: number) {
    this.frames.push(now);
    if (this.frames.length > 240) this.frames.splice(0, 60);
  }
  private frameGap(event: number, handled: number) {
    if (!this.frames.length || this.frames[0] > event) return;
    let worst = 0,
      previous: number | undefined;
    for (const at of this.frames) {
      if (at > handled) break;
      if (previous !== undefined && at >= event)
        worst = Math.max(worst, at - previous);
      previous = at;
    }
    if (previous !== undefined) worst = Math.max(worst, handled - previous);
    return worst <= PERF_PAUSE ? Math.round(worst) : undefined;
  }
  private rtts: number[] = [];
  private gaps: number[] = [];
  private fixes: number[] = [];
  private causes = { hit: 0, status: 0, move: 0, other: 0 };
  private gaps2: number[] = [];
  private waits: number[] = [];
  private lastSnap: number | undefined;
  private liveMs = 0;
  private holdCount = 0;
  private holdMost = 0;
  private wasHeld = false;
  private inputs = 0;
  private sendGaps: number[] = [];
  private presses: number[] = [];
  private handlerDelays: number[] = [];
  private sendDelays: number[] = [];
  private lastSend: number | undefined;
  private actionPresses = new Map<
    string,
    { event: number; handler: number; source: "touch-controls" | "unknown" }
  >();
  private push(list: number[], v: number) {
    if (list.length >= MAX_SAMPLES) list.splice(0, MAX_SAMPLES / 2);
    list.push(v);
  }
  rtt(ms: number) {
    if (Number.isFinite(ms) && ms >= 0) this.push(this.rtts, ms);
  }
  /** A snapshot arrived during live play (`live` false: not counted). */
  snapshot(now: number, live: boolean) {
    const last = this.lastSnap;
    this.lastSnap = live ? now : undefined;
    if (!live || last === undefined) return;
    const gap = now - last;
    // A tab in the background or a reconnect is a pause, not a late snapshot.
    if (gap <= 0 || gap > 2000) return;
    this.push(this.gaps, gap);
    this.liveMs += gap;
  }
  /** A live snapshot said `held` ticks wait for your late inputs. */
  held(ticks: number) {
    const n = Number.isFinite(ticks) && ticks > 0 ? ticks : 0;
    if (n && !this.wasHeld) this.holdCount++;
    this.wasHeld = n > 0;
    this.holdMost = Math.max(this.holdMost, n);
  }
  /**
   * An accepted DOM action edge. Preview skills commit on release. Safari
   * versions with epoch timestamps are converted to performance.now's origin.
   * Gamepads have no DOM timestamp: do not call polling time a physical press.
   */
  press(
    action: string,
    stamp: number | undefined,
    handled = performance.now(),
    origin = performance.timeOrigin,
    source: "touch-controls" | "unknown" = "unknown",
  ) {
    if (stamp === undefined || !Number.isFinite(stamp)) return;
    const event = stamp > 1e12 ? stamp - origin : stamp;
    if (event < 0 || event > handled || handled - event > 60_000) return;
    this.actionPresses.set(action, { event, handler: handled, source });
  }
  clearPresses() {
    this.actionPresses.clear();
  }
  /** Hide, exit, disconnect or a new round: neither a gap nor a stale press. */
  pauseInput() {
    this.frames = [];
    this.lastSend = undefined;
    this.clearPresses();
  }
  /** An input actually emitted during live play, before prediction/rendering. */
  input(
    action?: { basic: boolean; skill: number; dash: boolean; jump: boolean },
    now = performance.now(),
  ) {
    this.inputs++;
    if (
      this.lastSend !== undefined &&
      now >= this.lastSend &&
      now - this.lastSend <= PERF_PAUSE
    )
      this.push(this.sendGaps, now - this.lastSend);
    this.lastSend = now;
    if (action) {
      for (const [key, at] of this.actionPresses) {
        const sent = key.startsWith("skill")
          ? action.skill === Number(key.slice(5))
          : action[key as "basic" | "dash" | "jump"];
        if (sent && now >= at.handler && now - at.event <= 60_000) {
          this.push(this.presses, now - at.event);
          this.push(this.handlerDelays, at.handler - at.event);
          this.push(this.sendDelays, now - at.handler);
          if (
            now - at.event >= 80 &&
            /^(basic|dash|jump|skill[0-3])$/.test(key)
          ) {
            this.slowInputs.push({
              action: key,
              source: at.source,
              deliveryMs: Math.round(at.handler - at.event),
              deadlineMs: Math.round(now - at.handler),
              totalMs: Math.round(now - at.event),
              frameGapMs: this.frameGap(at.event, at.handler),
            });
            this.slowInputs.sort((a, b) => b.totalMs - a.totalMs);
            this.slowInputs.length = Math.min(this.slowInputs.length, 8);
          }
        }
      }
      // The actions latch is consumed by this input, including denied/EX
      // toggles; held Basic repeats never create another physical-press sample.
      this.clearPresses();
    }
  }
  correction(px: number, cause?: "hit" | "status" | "move" | "other") {
    if (px <= CORRECTION_PX) return;
    this.push(this.fixes, px);
    if (cause) this.causes[cause]++;
  }
  /** A hit on you landed `px` from where you were drawn at that moment. */
  hitGap(px: number, timing?: Omit<HitTrace, "gap">) {
    if (!Number.isFinite(px) || px < 0) return;
    this.push(this.gaps2, px);
    if (px > HIT_GAP_PX && timing) {
      this.farHits.push({ gap: Math.round(px), ...timing });
      this.farHits.sort((a, b) => b.gap - a.gap);
      this.farHits.length = Math.min(this.farHits.length, 8);
    }
  }
  confirmed(ms: number) {
    if (Number.isFinite(ms) && ms >= 0) this.push(this.waits, ms);
  }
  summary(): NetSummary {
    const q = (v: number[], f: number) => {
      if (!v.length) return 0;
      const s = v.slice().sort((a, b) => a - b);
      return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * f))]);
    };
    const minutes = this.liveMs / 60_000;
    const perMinute = (n: number) =>
      minutes > 0 ? Math.round((n / minutes) * 10) / 10 : 0;
    return {
      hitTraceVersion: 1,
      ...(this.slowInputs.length
        ? { slowInputs: this.slowInputs.map((x) => ({ ...x })) }
        : {}),
      ...(this.farHits.length
        ? { farHits: this.farHits.map((x) => ({ ...x })) }
        : {}),
      rttP50: q(this.rtts, 0.5),
      rttP95: q(this.rtts, 0.95),
      snapGapP95: q(this.gaps, 0.95),
      snapLate: this.gaps.length
        ? Math.round(
            (this.gaps.filter((g) => g > SNAP_LATE).length / this.gaps.length) *
              1000,
          ) / 1000
        : 0,
      corrections:
        minutes > 0 ? Math.round((this.fixes.length / minutes) * 10) / 10 : 0,
      correctionMax: Math.round(
        this.fixes.length ? Math.max(...this.fixes) : 0,
      ),
      confirmP50: q(this.waits, 0.5),
      ...(this.waits.length
        ? { confirmP95: q(this.waits, 0.95), confirmP99: q(this.waits, 0.99) }
        : {}),
      ...(this.presses.length
        ? {
            pressSamples: this.presses.length,
            pressToSendP50: q(this.presses, 0.5),
            pressToSendP95: q(this.presses, 0.95),
            pressToSendP99: q(this.presses, 0.99),
            eventToHandlerP95: q(this.handlerDelays, 0.95),
            handlerToSendP95: q(this.sendDelays, 0.95),
          }
        : {}),
      ...(this.sendGaps.length
        ? {
            sendGapP50: q(this.sendGaps, 0.5),
            sendGapP95: q(this.sendGaps, 0.95),
            sendGapP99: q(this.sendGaps, 0.99),
            sendGapMax: Math.round(Math.max(...this.sendGaps)),
          }
        : {}),
      correctionsHit: perMinute(this.causes.hit),
      correctionsStatus: perMinute(this.causes.status),
      correctionsMove: perMinute(this.causes.move),
      correctionsOther: perMinute(this.causes.other),
      hitsFar: this.gaps2.filter((g) => g > HIT_GAP_PX).length,
      hitGapMax: Math.round(this.gaps2.length ? Math.max(...this.gaps2) : 0),
      snapGapMax: Math.round(this.gaps.length ? Math.max(...this.gaps) : 0),
      correctionP50: q(this.fixes, 0.5),
      holds: perMinute(this.holdCount),
      holdMax: this.holdMost,
      inputHz:
        this.liveMs > 0
          ? Math.min(
              1000,
              Math.round((this.inputs / this.liveMs) * 100_000) / 100,
            )
          : 0,
    };
  }
  reset() {
    this.pauseInput();
    this.sendGaps = [];
    this.presses = [];
    this.handlerDelays = [];
    this.sendDelays = [];
    this.rtts = [];
    this.gaps = [];
    this.fixes = [];
    this.waits = [];
    this.causes = { hit: 0, status: 0, move: 0, other: 0 };
    this.gaps2 = [];
    this.frames = [];
    this.slowInputs = [];
    this.farHits = [];
    this.lastSnap = undefined;
    this.liveMs = 0;
    this.holdCount = this.holdMost = this.inputs = 0;
    this.wasHeld = false;
  }
}

/**
 * Which build of the game this is: the commit it was built from (build-id.ts),
 * "dev" otherwise. A report from an old build means the phone is still
 * running a cached version.
 */
export const BUILD: string = buildId() ?? "dev";

/**
 * The kind of device, coarsely, for battle-perf: the system family and
 * whether the game runs as the installed app. Nothing finer (no model or
 * browser version), so it identifies no one.
 */
export function deviceKind(
  ua = typeof navigator === "undefined" ? "" : navigator.userAgent,
  touchPoints = typeof navigator === "undefined"
    ? 0
    : (navigator.maxTouchPoints ?? 0),
  standalone = typeof matchMedia === "function" &&
    (matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true),
): {
  os: "ios" | "android" | "mac" | "windows" | "linux" | "other";
  app: boolean;
} {
  const os =
    /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
      ? "ios"
      : /Android/.test(ua)
        ? "android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "mac"
          : /Windows/.test(ua)
            ? "windows"
            : /Linux|CrOS/.test(ua)
              ? "linux"
              : "other";
  return { os, app: !!standalone };
}

/**
 * Where the game runs: a browser tab, the home-screen web app, or the iOS or
 * Android app (Capacitor). `app` (deviceKind) only says "installed to the
 * home screen", so the Xcode-built iPhone app reported false.
 */
export type AppShell = "web" | "pwa" | "ios-app" | "android-app";
export function appShell(
  nativePlatform: string | undefined,
  standalone: boolean,
): AppShell {
  if (nativePlatform === "ios") return "ios-app";
  if (nativePlatform === "android") return "android-app";
  return standalone ? "pwa" : "web";
}

/**
 * Which phone, as far as it can be told without naming anyone: in the app,
 * the model identifier the system gives (an iPhone 11 is "iPhone12,1") and
 * the system version; in a browser, the screen's size in CSS pixels and its
 * pixel ratio, which narrow an iPhone to a family of models.
 */
export function deviceModel(
  info: { model?: string; osVersion?: string } | undefined,
  screen: { width: number; height: number; dpr: number } | undefined,
): { model?: string; osVersion?: string; screen?: string } {
  const out: { model?: string; osVersion?: string; screen?: string } = {};
  const model = info?.model?.trim();
  if (model && /^[\w ,.()+-]{1,40}$/.test(model)) out.model = model;
  const os = info?.osVersion?.trim();
  if (os && /^[\w.]{1,20}$/.test(os)) out.osVersion = os;
  if (screen && screen.width > 0 && screen.height > 0 && screen.dpr > 0) {
    const long = Math.round(Math.max(screen.width, screen.height)),
      short = Math.round(Math.min(screen.width, screen.height));
    out.screen = `${long}x${short}@${Math.round(screen.dpr * 100) / 100}`;
  }
  return out;
}

/**
 * Where a battle's load time went (the "arena-load" report): starting the
 * renderer (until the scene's preload), loading the fighters' art (preload to
 * create) and building the scene (create to the first frame with every
 * fighter ready). A phase whose mark is missing or out of order is left out.
 */
export function loadPhases(
  started: number,
  marks: { preload: number; create: number },
  ready: number,
) {
  const ms = (from: number, to: number) =>
    from > 0 && to >= from
      ? Math.min(600_000, Math.round(to - from))
      : undefined;
  const boot = marks.preload ? ms(started, marks.preload) : undefined;
  const assets = marks.create ? ms(marks.preload, marks.create) : undefined;
  const scene = ms(marks.create, ready);
  return {
    ...(boot !== undefined ? { boot } : {}),
    ...(assets !== undefined ? { assets } : {}),
    ...(scene !== undefined ? { scene } : {}),
  };
}

/**
 * The kind of connection, where the browser says (Android's Chrome; not
 * Safari): Wi-Fi or mobile data, and its rough speed class. Nothing finer.
 */
export function connectionKind(
  c = typeof navigator === "undefined"
    ? undefined
    : (
        navigator as Navigator & {
          connection?: { type?: string; effectiveType?: string };
        }
      ).connection,
): {
  link?: "wifi" | "cellular" | "ethernet" | "other";
  linkSpeed?: "slow-2g" | "2g" | "3g" | "4g";
} {
  if (!c) return {};
  const link =
    c.type === "wifi" || c.type === "cellular" || c.type === "ethernet"
      ? c.type
      : c.type
        ? "other"
        : undefined;
  const speed = c.effectiveType;
  const linkSpeed =
    speed === "slow-2g" || speed === "2g" || speed === "3g" || speed === "4g"
      ? speed
      : undefined;
  return { ...(link ? { link } : {}), ...(linkSpeed ? { linkSpeed } : {}) };
}
