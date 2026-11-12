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

/**
 * The network side of a match, from the same device: why a battle can feel
 * late or jerky while it draws at full frame rate. Round trips come from the
 * ping badge; snapshot gaps are how irregularly the server's 15 a second
 * arrive; corrections are how far your own fighter jumped when a snapshot
 * disagreed with what was predicted; a skill's wait is from your press to
 * the server confirming it.
 */
export interface NetSummary {
  rttP50: number;
  rttP95: number;
  /** 95th percentile gap between snapshots (ms; 67 is on time). */
  snapGapP95: number;
  /** Share of snapshot gaps over 120 ms (a late or bunched snapshot). */
  snapLate: number;
  /** Your fighter's corrections over 4 px, per minute of play. */
  corrections: number;
  /** The largest correction (px). */
  correctionMax: number;
  /** Median wait from a skill press to the server's confirmation (ms). */
  confirmP50: number;
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
}
/** A hit landing this far from where you were drawn looked like a miss (one fighter radius). */
export const HIT_GAP_PX = 24;
/** A snapshot gap longer than this is late (the server sends one every 67 ms). */
export const SNAP_LATE = 120;
/** A correction smaller than this is not noticeable. */
export const CORRECTION_PX = 4;
const MAX_SAMPLES = 20_000;

export class NetMeter {
  private rtts: number[] = [];
  private gaps: number[] = [];
  private fixes: number[] = [];
  private causes = { hit: 0, status: 0, move: 0, other: 0 };
  private gaps2: number[] = [];
  private waits: number[] = [];
  private lastSnap: number | undefined;
  private liveMs = 0;
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
  correction(px: number, cause?: "hit" | "status" | "move" | "other") {
    if (px <= CORRECTION_PX) return;
    this.push(this.fixes, px);
    if (cause) this.causes[cause]++;
  }
  /** A hit on you landed `px` from where you were drawn at that moment. */
  hitGap(px: number) {
    if (Number.isFinite(px) && px >= 0) this.push(this.gaps2, px);
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
      correctionsHit: perMinute(this.causes.hit),
      correctionsStatus: perMinute(this.causes.status),
      correctionsMove: perMinute(this.causes.move),
      correctionsOther: perMinute(this.causes.other),
      hitsFar: this.gaps2.filter((g) => g > HIT_GAP_PX).length,
      hitGapMax: Math.round(this.gaps2.length ? Math.max(...this.gaps2) : 0),
    };
  }
  reset() {
    this.rtts = [];
    this.gaps = [];
    this.fixes = [];
    this.waits = [];
    this.causes = { hit: 0, status: 0, move: 0, other: 0 };
    this.gaps2 = [];
    this.lastSnap = undefined;
    this.liveMs = 0;
  }
}

declare const __BUILD__: string | undefined;
/**
 * Which build of the game this is: the commit it was built from (Render sets
 * RENDER_GIT_COMMIT; apps/client/vite.config.ts), "dev" otherwise. A report
 * from an old build means the phone is still running a cached version.
 */
export const BUILD: string =
  typeof __BUILD__ === "string" && /^[a-z0-9-]{1,16}$/.test(__BUILD__)
    ? __BUILD__
    : "dev";

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
