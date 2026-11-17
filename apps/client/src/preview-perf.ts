/**
 * Frame measurements of a fighter preview (shop-preview.ts) for the Lobby's
 * frame-rate read-out (lobby-perf.ts; five taps on Settings → Graphics'
 * title). On an iPhone the Lobby's aura turned like a 30 Hz screen and the
 * phone ran hot, while the same preview in the Shop was smooth (owner,
 * iPhone 17 Pro Max, 17 Nov 2026); this tells apart:
 *
 * - the screen's own refresh (the browser's animation frames, `screenHz`),
 * - how many of those the preview drew (`fps`; fewer: frames were skipped
 *   by the cap, or the browser called less often),
 * - how long our own code took per drawn frame (`stepMs`, `stepMaxMs`: the
 *   rig's update and Phaser's canvas drawing, on the main thread),
 * - the share of drawn frames that came late (`late`: more than 1.5 times
 *   the usual gap after the last one: an uneven pace).
 *
 * When `stepMs` is small but `fps` is half `screenHz`, the time goes
 * outside our code: the browser compositing the page, or iOS holding the
 * page to 30 (Low Power Mode, a hot phone).
 */
export interface PreviewPerfStats {
  screenHz: number;
  fps: number;
  stepMs: number;
  stepMaxMs: number;
  late: number;
}

export class PreviewPerf {
  private frames: number[] = [];
  private drawn: { at: number; ms: number }[] = [];
  /** Keep this long of history (ms). */
  constructor(private window = 2000) {}
  /** A browser animation frame at `now` (ms). */
  frame(now: number) {
    this.frames.push(now);
    this.trim(now);
  }
  /** A frame the preview drew at `at`, its own work taking `ms`. */
  draw(at: number, ms: number) {
    this.drawn.push({ at, ms });
    this.trim(at);
  }
  private trim(now: number) {
    const from = now - this.window;
    while (this.frames.length && this.frames[0] < from) this.frames.shift();
    while (this.drawn.length && this.drawn[0].at < from) this.drawn.shift();
  }
  stats(): PreviewPerfStats {
    const median = (values: number[]) => {
      if (!values.length) return 0;
      const sorted = values.slice().sort((a, b) => a - b);
      return sorted[sorted.length >> 1];
    };
    const gaps = (times: number[]) =>
      times.slice(1).map((t, i) => t - times[i]);
    const refresh = median(gaps(this.frames).filter((g) => g > 0 && g < 100));
    const drawnAt = this.drawn.map((d) => d.at);
    const span =
      drawnAt.length > 1 ? drawnAt[drawnAt.length - 1] - drawnAt[0] : 0;
    const steps = this.drawn.map((d) => d.ms);
    const drawnGaps = gaps(drawnAt).filter((g) => g < 250);
    // Late against the usual gap between drawn frames (a capped preview on
    // a 120 Hz screen draws every other refresh, and that is on time).
    const usual = median(drawnGaps);
    return {
      screenHz: refresh ? Math.round(1000 / refresh) : 0,
      fps: span ? Math.round(((drawnAt.length - 1) * 1000) / span) : 0,
      stepMs: +median(steps).toFixed(1),
      stepMaxMs: +(steps.length ? Math.max(...steps) : 0).toFixed(1),
      late: drawnGaps.length
        ? +(
            drawnGaps.filter((g) => g > usual * 1.5).length / drawnGaps.length
          ).toFixed(2)
        : 0,
    };
  }
}
