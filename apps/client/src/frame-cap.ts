/**
 * At most about 60 frames a second, on any screen.
 *
 * Many Android phones (and iPhones with ProMotion, where the browser allows
 * it) refresh at 90 to 144 Hz, and the browser then calls every animation
 * loop that often. The game looks no smoother past 60 (the server moves
 * everything 30 times a second), but a 120 Hz phone draws twice the pixels
 * a second: its graphics chip heats up and slows down, and the battle
 * stutters. The match reports' one Android phone ran at 61-107 fps with up
 * to 18% of the time stuttering, even at Low (13 Nov 2026).
 *
 * `FrameCap.draw(now)` is called on every animation frame and says whether
 * to draw this one. It learns the screen's refresh from the frames
 * themselves (no browser reports it). On a screen of 100 Hz or more it
 * draws a frame once about 1/60 s has passed since the last one drawn: every
 * other refresh at 120 Hz, never skipping two in a row, and a late frame
 * (a refresh missed) is drawn at once. Below 100 Hz it draws every frame:
 * a 90 Hz screen would otherwise go to 45 fps or an uneven 60. Skipped
 * frames cost nothing; the caller adds their time to the next frame drawn.
 */
export const FRAME_CAP = {
  /** Frames a second to hold a fast screen to. */
  fps: 60,
  /** Screens refreshing faster than this are held to `fps`. */
  fastScreen: 100,
  /** Refresh intervals kept to judge the screen by (about a quarter second). */
  samples: 32,
  /** Intervals longer than this are a pause or a hitch, not the screen. */
  gap: 100,
};

export class FrameCap {
  private last: number | undefined;
  private drawnAt = -Infinity;
  private intervals: number[] = [];
  private next = 0;
  /** The screen's refresh interval (ms) as measured, 0 until known. */
  refresh = 0;
  private since = 0;
  constructor(private enabled: () => boolean = () => true) {}
  /** Should this animation frame (at `now`, ms) be drawn? */
  draw(now: number): boolean {
    const last = this.last;
    this.last = now;
    if (last !== undefined) {
      const step = now - last;
      if (step > 0 && step < FRAME_CAP.gap) {
        if (this.intervals.length < FRAME_CAP.samples)
          this.intervals.push(step);
        else this.intervals[this.next] = step;
        this.next = (this.next + 1) % FRAME_CAP.samples;
        // Judge the screen again every few frames (the median of a quarter
        // second: a slow drawn frame or two does not change it).
        if (++this.since >= 8 || !this.refresh) {
          this.since = 0;
          const sorted = this.intervals.slice().sort((a, b) => a - b);
          this.refresh = sorted[sorted.length >> 1];
        }
      }
    }
    const fast =
      this.refresh > 0 &&
      this.refresh < 1000 / FRAME_CAP.fastScreen &&
      this.enabled();
    // Half a refresh of slack: rAF times wobble around the refresh.
    if (fast && now - this.drawnAt < 1000 / FRAME_CAP.fps - this.refresh / 2)
      return false;
    this.drawnAt = now;
    return true;
  }
  /** After a pause (hidden tab, a menu over the scene): learn afresh. */
  reset() {
    this.last = undefined;
    this.drawnAt = -Infinity;
  }
}

/**
 * Hold a Phaser game to `FrameCap` by wrapping its step (call from the game
 * config's `postBoot`, before Phaser starts its loop with `game.step`).
 * Skipped frames' time goes to the next frame drawn, so every clock that
 * runs on Phaser's delta keeps real time.
 */
export function capGameFrames(
  game: {
    step: (time: number, delta: number) => void;
    pendingDestroy?: boolean;
  },
  cap = new FrameCap(),
) {
  const step = game.step.bind(game);
  let owed = 0;
  game.step = (time: number, delta: number) => {
    // Destroying must always run (Phaser does it inside step).
    if (!game.pendingDestroy && !cap.draw(time)) {
      owed += delta;
      return;
    }
    const total = delta + owed;
    owed = 0;
    step(time, total);
  };
  return cap;
}
