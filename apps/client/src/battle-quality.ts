/**
 * Battle graphics quality: Auto adapts PvP and raid battles to the device.
 *
 * Only optional decoration is ever reduced: extra particles and trail
 * sparks, Mythical skins' ambient motes, the stands' cheering crowd and
 * other background flourishes. Fighters, portraits, text, HUD, attack
 * telegraphs, danger zones, projectiles, status markers and every skill's
 * shapes and colours are drawn the same at every level, at full resolution.
 *
 * The governor watches sustained frame times during live play only. It
 * ignores a warm-up after the battle (re)starts, any frame gap over 250 ms
 * (loading, a stall, a background tab) and every frame while a menu or
 * dialog is open or the round is not being played. It steps down one level
 * after two consecutive slow 4-second windows and steps back up only after
 * five comfortable ones; a level it had to leave twice is not retried this
 * session. The settled level is remembered on this device.
 *
 * Settings → Graphics: High always draws everything; Low always draws the
 * lightest level; Auto (default) adapts. Reduced motion keeps its own,
 * stricter effect limits at every level.
 */
import { graphicsSetting, type GraphicsSetting } from "./graphics-quality";

export type BattleQuality = "high" | "medium" | "low";
export const BATTLE_LEVELS: BattleQuality[] = ["high", "medium", "low"];

export interface BattleQualityKnobs {
  /** Share of decorative burst particles emitted. */
  particles: number;
  /** Trail emitters run this much less often. */
  trails: number;
  /** Mythical skins whose extra ambient motes are drawn (you first). */
  mythicAmbient: number;
  /** Stop purely decorative background animation (the stands' crowd). */
  stillBackground: boolean;
}
export const BATTLE_QUALITY: Record<BattleQuality, BattleQualityKnobs> = {
  high: { particles: 1, trails: 1, mythicAmbient: 2, stillBackground: false },
  medium: {
    particles: 0.6,
    trails: 1.6,
    mythicAmbient: 1,
    stillBackground: false,
  },
  low: {
    particles: 0.35,
    trails: 2.5,
    mythicAmbient: 0,
    stillBackground: true,
  },
};

export const BATTLE_PROBE = {
  warmup: 3000,
  window: 4000,
  /** Frame gaps longer than this are pauses, not the device's pace. */
  gap: 250,
  /** A window is slow when its median frame is longer than this (≈45 fps)… */
  slowMedian: 1000 / 45,
  /** …or this share of frames take longer than `jank` ms (missed 30 fps). */
  jankShare: 0.2,
  jank: 34,
  /** Comfortable: 90% of frames within this (≈58 fps). */
  fastP90: 1000 / 58,
  slowWindows: 2,
  fastWindows: 5,
};

const KEY = "ea-battle-quality";
function read() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "medium" || v === "low" ? v : null;
  } catch {
    return null;
  }
}
function write(level: BattleQuality) {
  try {
    if (level === "high") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, level);
  } catch {
    /* Optional. */
  }
}
/** Forget what Auto learned (picking Auto again in Settings). */
export function resetBattleQuality() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* Optional. */
  }
}

export class BattleQualityGovernor {
  level: BattleQuality;
  private last: number | undefined;
  private warm = 0;
  private intervals: number[] = [];
  private counted = 0;
  private slow = 0;
  private fast = 0;
  /** Levels this session had to leave, and how often. */
  private left = new Map<BattleQuality, number>();
  constructor(
    private setting: () => GraphicsSetting = graphicsSetting,
    remembered: BattleQuality | null = read(),
    private remember: (level: BattleQuality) => void = write,
  ) {
    this.level = remembered ?? "high";
  }
  /** The level to draw at now (manual settings win over Auto). */
  current(): BattleQuality {
    const setting = this.setting();
    if (setting === "high") return "high";
    if (setting === "low") return "low";
    return this.level;
  }
  knobs() {
    return BATTLE_QUALITY[this.current()];
  }
  /** Forget the learned level (Settings → Auto picked again). */
  reset(forget: () => void) {
    forget();
    this.level = "high";
    this.left.clear();
    this.slow = this.fast = 0;
    this.restart();
  }
  /** Not measuring (menu, hidden tab, between rounds): restart the chain. */
  pause() {
    this.last = undefined;
  }
  /** Start over after a scene (re)start: warm up again before judging. */
  restart() {
    this.last = undefined;
    this.warm = 0;
    this.intervals = [];
    this.counted = 0;
  }
  /** Feed every rendered frame's time (ms). Returns a new level on a change. */
  frame(now: number): BattleQuality | undefined {
    if (this.setting() !== "auto") return;
    const last = this.last;
    this.last = now;
    if (last === undefined) return;
    const step = now - last;
    if (step <= 0) return;
    if (step > BATTLE_PROBE.gap) {
      // A stall or a pause: do not hold it against the device.
      this.warm = Math.min(this.warm, BATTLE_PROBE.warmup / 2);
      return;
    }
    if (this.warm < BATTLE_PROBE.warmup) {
      this.warm += step;
      return;
    }
    this.intervals.push(step);
    this.counted += step;
    if (this.counted < BATTLE_PROBE.window) return;
    const sorted = this.intervals.sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const jank =
      sorted.filter((s) => s > BATTLE_PROBE.jank).length / sorted.length;
    this.intervals = [];
    this.counted = 0;
    const isSlow =
      median > BATTLE_PROBE.slowMedian || jank >= BATTLE_PROBE.jankShare;
    const isFast = !isSlow && p90 <= BATTLE_PROBE.fastP90;
    this.slow = isSlow ? this.slow + 1 : 0;
    this.fast = isFast ? this.fast + 1 : 0;
    const index = BATTLE_LEVELS.indexOf(this.level);
    if (this.slow >= BATTLE_PROBE.slowWindows && index < 2) {
      this.left.set(this.level, (this.left.get(this.level) ?? 0) + 1);
      return this.change(BATTLE_LEVELS[index + 1]);
    }
    if (this.fast >= BATTLE_PROBE.fastWindows && index > 0) {
      const up = BATTLE_LEVELS[index - 1];
      // Do not keep bouncing between two levels.
      if ((this.left.get(up) ?? 0) >= 2) return;
      return this.change(up);
    }
  }
  private change(level: BattleQuality) {
    this.level = level;
    this.slow = this.fast = 0;
    // Judge the new level from a clean start.
    this.warm = BATTLE_PROBE.warmup / 2;
    this.remember(level);
    return level;
  }
}
