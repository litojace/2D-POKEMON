/**
 * Town graphics quality: Settings → Graphics offers Auto, High and Low.
 *
 * High is the living town (animals, swaying trees, flickering lamps and
 * torches, moving water) at up to 2× resolution. Low is the same town
 * standing still: no hens, ducks, birds, butterflies or clouds; trees,
 * lamps, torches, flags and water hold still and are drawn once; the canvas
 * renders at 1× and the town runs at 30 frames a second. Battles are not
 * affected.
 *
 * Auto starts High and watches the town's real frame rate for a few
 * seconds; a device that cannot hold about 40 frames a second switches to
 * Low and is remembered, so its next visit starts Low straight away (a
 * device reporting 2 GB of memory or less starts Low too). Choosing High or
 * Low by hand overrides Auto.
 */
export type GraphicsSetting = "auto" | "high" | "low";
const SETTING_KEY = "ea-graphics";
const AUTO_KEY = "ea-graphics-auto";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* Optional preference. */
  }
}

export function graphicsSetting(): GraphicsSetting {
  const v = read(SETTING_KEY);
  return v === "high" || v === "low" ? v : "auto";
}
export function setGraphicsSetting(value: GraphicsSetting) {
  write(SETTING_KEY, value === "auto" ? null : value);
  // Picking Auto again measures afresh.
  if (value === "auto") write(AUTO_KEY, null);
}
/** What Auto has settled on for this device (before any measuring). */
export function autoChoosesLow(
  memory = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
) {
  if (read(AUTO_KEY) === "low") return true;
  return typeof memory === "number" && memory > 0 && memory <= 2;
}
export function rememberAutoLow() {
  write(AUTO_KEY, "low");
}
/** The town should be drawn at Low quality right now. */
export function lowGraphics(setting = graphicsSetting()) {
  return setting === "low" || (setting === "auto" && autoChoosesLow());
}

/** The town's frame cap at Low (frames a second). */
export const LOW_FPS = 30;
/** Below this many frames a second, Auto switches to Low. */
export const AUTO_MIN_FPS = 40;

/**
 * Measures the town's frame rate for Auto. Feed it the time of every frame
 * (ms). Loading and the first moments are skipped; gaps over a second (a
 * panel open, the tab in the background) are not counted against the
 * device. After four seconds of counted frames it answers once: "low" or
 * "ok".
 */
export class FrameRateProbe {
  private last: number | undefined;
  private started: number | undefined;
  private counted = 0;
  private frames = 0;
  verdict: "low" | "ok" | undefined;
  constructor(
    private warmup = 2000,
    private window = 4000,
  ) {}
  /** A pause (panel open, town asleep): the next frame starts a new interval. */
  pause() {
    this.last = undefined;
  }
  frame(now: number) {
    if (this.verdict) return this.verdict;
    this.started ??= now;
    const last = this.last;
    this.last = now;
    if (now - this.started < this.warmup || last === undefined) return;
    const step = now - last;
    // Longer than a second is a stall or a pause, not the device's pace
    // (a panel or hidden tab also calls pause()).
    if (step > 1000) return;
    this.counted += step;
    this.frames++;
    if (this.counted < this.window) return;
    const fps = (this.frames * 1000) / this.counted;
    return (this.verdict = fps < AUTO_MIN_FPS ? "low" : "ok");
  }
}
