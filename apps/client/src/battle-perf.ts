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
  /** Share of the time spent in frames that missed 30 fps (0–1). */
  jank: number;
  /** Frames slower than 250 ms. */
  stalls: number;
}

export class BattlePerfMeter {
  private last: number | undefined;
  private steps: number[] = [];
  private total = 0;
  /** Feed every rendered frame; `live` is false outside live play. */
  frame(now: number, live: boolean) {
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
      this.total -= dropped.reduce((a, b) => a + b, 0);
    }
    this.steps.push(step);
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
      return { seconds: 0, frames: 0, fps: 0, frameP95: 0, jank: 0, stalls: 0 };
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
      jank: round(jankTime / total, 3),
      stalls: steps.filter((s) => s > PERF_STALL).length,
    };
  }
  reset() {
    this.last = undefined;
    this.steps = [];
    this.total = 0;
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
