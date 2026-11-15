/**
 * Battle graphics quality: Auto adapts PvP and raid battles to the device.
 *
 * Optional decoration is reduced: extra particles and trail sparks,
 * Mythical skins' ambient motes, the stands' cheering crowd and other
 * background flourishes. Fighters, portraits, text, HUD, attack telegraphs,
 * danger zones, projectiles, status markers and every skill's shapes and
 * colours are drawn the same at every level. Low also draws the battle at
 * 1.5 canvas pixels per CSS pixel at most (instead of 2), as iPhones always
 * do: an older phone's GPU pays for every pixel drawn, and skill effects add
 * to it, so fewer pixels is what stops lag when skills go off (owner, 10 Nov
 * 2026). Low also limits decorative glow light (glowBudget).
 *
 * The governor watches frame times during live play only. It ignores a
 * warm-up after the battle (re)starts, any frame gap over 250 ms (loading,
 * a stall, a background tab) and every frame while a menu or dialog is open
 * or the round is not being played. A 4-second window is slow when its
 * median frame is slow, or when a tenth of its time went to frames that
 * missed 30 fps: the stutter each skill causes on an older phone. (Counting
 * frames instead missed it: slow frames are long, so few.) A window is
 * comfortable only when it keeps pace and hardly stutters at all. It steps
 * down one level after two consecutive slow windows and steps back up only
 * after five comfortable ones. A level it had to leave is not tried again
 * on this device for a week (`BATTLE_PROBE.ceilingDays`), so a phone does
 * not lag once a session finding out again. The settled level is
 * remembered on this device.
 *
 * Settings → Graphics: High always draws everything; Low always draws the
 * lightest level; Auto (default) adapts. Before it has learned a device it
 * starts at Low on one with 2 GB of memory or less (or one Auto found slow
 * in the Plaza), at Medium on an Android phone or tablet (their graphics
 * chips vary the most: the match reports' one Android phone stuttered even
 * at Low), and at High otherwise. Picking Auto again forgets what it
 * learned. Reduced motion keeps its own, stricter effect limits at every
 * level.
 */
import {
  autoChoosesLow,
  graphicsSetting,
  type GraphicsSetting,
} from "./graphics-quality";

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
  /** Most canvas pixels per CSS pixel (the screen's own density is lower on
   * some devices, and iPhones are capped at 1.5 at every level). */
  density: number;
  /** Most screens' worth of decorative glow light a frame (fx-engine.ts);
   * warnings (wind-ups, a boss gathering power) are never shrunk. */
  glowBudget: number;
}
export const BATTLE_QUALITY: Record<BattleQuality, BattleQualityKnobs> = {
  high: {
    particles: 1,
    trails: 1,
    mythicAmbient: 2,
    stillBackground: false,
    density: 2,
    glowBudget: Infinity,
  },
  medium: {
    particles: 0.6,
    trails: 1.6,
    mythicAmbient: 1,
    stillBackground: false,
    density: 2,
    glowBudget: Infinity,
  },
  low: {
    particles: 0.35,
    trails: 2.5,
    mythicAmbient: 0,
    stillBackground: true,
    density: 1.5,
    // Measured 10 Nov 2026: one champion's heaviest cast covers at most
    // 0.30 screens; four fighters casting at once 0.66 typically and 1.38 at
    // peak (tests/visual/match-flow-budget.spec.ts). So a duel never shrinks
    // and crowded peaks lose about half their glow fill.
    glowBudget: 0.75,
  },
};

export const BATTLE_PROBE = {
  warmup: 3000,
  window: 4000,
  /** Frame gaps longer than this are pauses, not the device's pace. */
  gap: 250,
  /** A window is slow when its median frame is longer than this (≈45 fps)… */
  slowMedian: 1000 / 45,
  /** …or this share of its time went to frames longer than `jank` ms
   * (missed 30 fps): the stutter after each skill on an older phone. (A
   * fifth until 13 Nov 2026: the reports' Android phone stuttered up to
   * 18% of the time, at Low, and Auto would never have left High.) */
  jankShare: 0.1,
  jank: 34,
  /** Comfortable: 90% of frames within this (≈58 fps)… */
  fastP90: 1000 / 58,
  /** …and at most this share of the time stuttering. (Pace alone let a
   * 120 Hz phone count as comfortable while it stuttered.) */
  fastJank: 0.02,
  slowWindows: 2,
  fastWindows: 5,
  /** A level Auto had to leave is not tried again for this long. */
  ceilingDays: 7,
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
const CEILING_KEY = "ea-battle-ceiling";
/** The highest level Auto may use on this device, if it had to leave one. */
export interface BattleCeiling {
  level: BattleQuality;
  /** When it was set (ms since 1970). */
  at: number;
}
function readCeiling(): BattleCeiling | null {
  try {
    const v = JSON.parse(localStorage.getItem(CEILING_KEY) ?? "null") as {
      level?: unknown;
      at?: unknown;
    } | null;
    if (
      v &&
      (v.level === "medium" || v.level === "low") &&
      typeof v.at === "number"
    )
      return { level: v.level, at: v.at };
  } catch {
    /* Optional. */
  }
  return null;
}
function writeCeiling(ceiling: BattleCeiling | null) {
  try {
    if (ceiling) localStorage.setItem(CEILING_KEY, JSON.stringify(ceiling));
    else localStorage.removeItem(CEILING_KEY);
  } catch {
    /* Optional. */
  }
}
/** Forget what Auto learned (picking Auto again in Settings). */
export function resetBattleQuality() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(CEILING_KEY);
  } catch {
    /* Optional. */
  }
}

/** An Android phone or tablet (Chrome, Samsung Internet, the installed app). */
export function isAndroid(
  nav: { userAgent?: string } | undefined = typeof navigator === "undefined"
    ? undefined
    : navigator,
) {
  return /\bAndroid\b/i.test(nav?.userAgent ?? "");
}
/** Where Auto starts on a device it has not learned yet (see the top). */
export function autoStartLevel(
  startsLow: () => boolean = autoChoosesLow,
  android: () => boolean = isAndroid,
): BattleQuality {
  if (startsLow()) return "low";
  return android() ? "medium" : "high";
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
    /**
     * Where Auto starts before it has learned this device (autoStartLevel):
     * Low when the device reports 2 GB of memory or less, or Auto already
     * found it slow in the Plaza (graphics-quality.ts), so an older phone's
     * first battle does not lag while Auto measures; Medium on Android. It
     * steps up after a comfortable stretch if the device copes.
     */
    private startAt: () => BattleQuality = autoStartLevel,
    /** The level Auto had to leave lately, and storing a new one. */
    private ceilingStore: {
      read: () => BattleCeiling | null;
      write: (c: BattleCeiling | null) => void;
    } = { read: readCeiling, write: writeCeiling },
    private clock: () => number = Date.now,
  ) {
    this.level = this.capped(remembered ?? this.firstLevel());
  }
  private firstLevel(): BattleQuality {
    return this.startAt();
  }
  /** The highest level allowed now (a level left within the week is not). */
  private ceiling(): BattleQuality {
    const c = this.ceilingStore.read();
    if (!c) return "high";
    if (this.clock() - c.at > BATTLE_PROBE.ceilingDays * 86_400_000) {
      this.ceilingStore.write(null);
      return "high";
    }
    return c.level;
  }
  private capped(level: BattleQuality): BattleQuality {
    const max = BATTLE_LEVELS.indexOf(this.ceiling());
    return BATTLE_LEVELS[Math.max(max, BATTLE_LEVELS.indexOf(level))];
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
    this.level = this.capped(this.firstLevel());
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
    // Share of the window's time, not of its frames: half a second of
    // 25 fps after a skill is a quarter of a 2-second gap between skills,
    // though only an eighth of the frames.
    const jank =
      sorted
        .filter((s) => s > BATTLE_PROBE.jank)
        .reduce((sum, s) => sum + s, 0) / this.counted;
    this.intervals = [];
    this.counted = 0;
    const isSlow =
      median > BATTLE_PROBE.slowMedian || jank >= BATTLE_PROBE.jankShare;
    const isFast =
      !isSlow && p90 <= BATTLE_PROBE.fastP90 && jank <= BATTLE_PROBE.fastJank;
    this.slow = isSlow ? this.slow + 1 : 0;
    this.fast = isFast ? this.fast + 1 : 0;
    const index = BATTLE_LEVELS.indexOf(this.level);
    if (this.slow >= BATTLE_PROBE.slowWindows && index < 2) {
      this.left.set(this.level, (this.left.get(this.level) ?? 0) + 1);
      const down = BATTLE_LEVELS[index + 1];
      // Do not try the level it left again for a while (not even next
      // session): finding out again is a lagging battle.
      this.ceilingStore.write({ level: down, at: this.clock() });
      return this.change(down);
    }
    if (this.fast >= BATTLE_PROBE.fastWindows && index > 0) {
      const up = BATTLE_LEVELS[index - 1];
      // Do not keep bouncing between two levels.
      if ((this.left.get(up) ?? 0) >= 1 || this.capped(up) !== up) return;
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
