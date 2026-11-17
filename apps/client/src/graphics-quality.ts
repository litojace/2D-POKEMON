/**
 * Plaza and Farm graphics quality: Settings → Graphics offers Auto, High and
 * Low.
 *
 * High is the living Plaza and Farm (animals, night glow, full weather) at
 * up to 2× resolution. Low is lighter for older phones: no ambient animals,
 * butterflies or night glow, lighter rain, a 1× canvas and 30 frames a
 * second. Battles keep every attack and only trim decorative sparks
 * (battle-quality.ts).
 *
 * Auto starts High and watches the Plaza's or the Farm's real frame rate
 * while you play, four seconds at a time; a device that stays under about 50
 * frames a second for three of those in a row switches to Low and is
 * remembered, with where and how slow (autoLowWhy, shown in Settings and the
 * frame-rate read-out), so its next visit starts Low straight away (a device
 * reporting 2 GB of memory or less starts Low too, and so does a browser
 * drawing without its graphics card, gpu-check.ts). Choosing High or Low by
 * hand overrides Auto. A slow battle only trims its own decorations
 * (battle-quality.ts).
 *
 * One slow window used to be enough, and a slow battle switched the Lobby,
 * Plaza and Farm too, so an iPad Pro 13" M4 kept landing on Low (owner,
 * 17 Nov 2026) with nothing saying why.
 */
import { softwareRendering } from "./gpu-check";

export type GraphicsSetting = "auto" | "high" | "low";
const SETTING_KEY = "ea-graphics";
const AUTO_KEY = "ea-graphics-auto";
/** Where Auto found the device slow, and how slow ("Plaza ran at 41 fps"). */
const AUTO_WHY_KEY = "ea-graphics-auto-why";

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
  if (value === "auto") {
    write(AUTO_KEY, null);
    write(AUTO_WHY_KEY, null);
  }
}
/** What Auto has settled on for this device (before any measuring). */
export function autoChoosesLow(
  memory = typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  software: () => boolean = softwareRendering,
) {
  if (read(AUTO_KEY) === "low") return true;
  if (typeof memory === "number" && memory > 0 && memory <= 2) return true;
  // Drawing on the processor: start Low rather than lag while Auto measures.
  return software();
}
/** Auto found this device slow: Low from now on. `why`: where and how slow
 *  ("Plaza ran at 41 fps"), for Settings and the frame-rate read-out. */
export function rememberAutoLow(why = "") {
  write(AUTO_KEY, "low");
  write(AUTO_WHY_KEY, why || null);
}
/** Why Auto chose Low on this device, if it measured it (else ""). */
export function autoLowWhy() {
  return read(AUTO_KEY) === "low" ? (read(AUTO_WHY_KEY) ?? "") : "";
}
/** The Plaza and the Farm should be drawn at Low quality right now. */
export function lowGraphics(setting = graphicsSetting()) {
  return setting === "low" || (setting === "auto" && autoChoosesLow());
}

/** Below this many frames a second, Auto switches to Low. */
export const AUTO_MIN_FPS = 50;

/** Slow windows in a row before Auto switches to Low (FrameRateProbe). */
export const AUTO_SLOW_WINDOWS = 3;

/**
 * Measures the Plaza's or the Farm's frame rate for Auto. Feed it the time
 * of every frame (ms). Loading and the first moments are skipped; gaps over
 * a second (a panel open, the tab in the background) are not counted against
 * the device. It measures four seconds of counted frames at a time
 * (`lastFps`): a window at 50 frames a second or more answers "ok"; it
 * answers "low" only after AUTO_SLOW_WINDOWS slow windows in a row (about 12
 * seconds of slow play), so a moment of heavy loading, a hot spell or a busy
 * Orb Shower does not decide for good. It answers once.
 */
export class FrameRateProbe {
  private last: number | undefined;
  private started: number | undefined;
  private counted = 0;
  private frames = 0;
  /** Slow windows in a row so far. */
  slow = 0;
  /** The frame rate of the last window measured (0 before the first). */
  lastFps = 0;
  verdict: "low" | "ok" | undefined;
  constructor(
    private warmup = 2000,
    private window = 4000,
    private strikes = AUTO_SLOW_WINDOWS,
  ) {}
  /** A pause (panel open, scene asleep): the next frame starts a new interval. */
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
    this.lastFps = (this.frames * 1000) / this.counted;
    this.counted = this.frames = 0;
    if (this.lastFps >= AUTO_MIN_FPS) return (this.verdict = "ok");
    if (++this.slow < this.strikes) return;
    return (this.verdict = "low");
  }
}
