import type { PerfSummary } from "./battle-perf";
import type { FxFrameStats } from "./fx-engine";

/**
 * `?perf=1`: a small read-out over the battle (on the left edge, halfway
 * down, clear of the score badge, the HUD and the joystick; ignores touches)
 * for a player to screenshot when a battle lags: the last second's frame
 * rate and slowest frames, the graphics level and canvas density, and the
 * effects' work this frame. Updated twice a second, as text only.
 */
export class PerfOverlay {
  private el = document.createElement("div");
  private next = 0;
  constructor(parent: HTMLElement) {
    this.el.className = "perf-overlay";
    this.el.setAttribute("aria-hidden", "true");
    Object.assign(this.el.style, {
      position: "absolute",
      left: "6px",
      top: "42%",
      zIndex: "50",
      pointerEvents: "none",
      padding: "3px 6px",
      borderRadius: "6px",
      background: "rgba(0,0,0,0.6)",
      color: "#e8f0ff",
      font: "10px/1.3 ui-monospace, Menlo, Consolas, monospace",
      whiteSpace: "pre",
    });
    parent.append(this.el);
  }
  update(
    now: number,
    recent: PerfSummary,
    level: string,
    density: number,
    fx: FxFrameStats,
  ) {
    if (now < this.next) return;
    this.next = now + 500;
    // Short labels: fps, slowest frames (p95), stutter share; level and
    // density; glows (screens covered, budget shrink), smoke, particles.
    const text =
      `${Math.round(recent.fps)} fps p95 ${Math.round(recent.frameP95)}ms ` +
      `stut ${Math.round(recent.jank * 100)}%\n` +
      `${level} ${density}× gl ${fx.glows}/${fx.glowCover.toFixed(1)}` +
      `${fx.shrink < 1 ? `×${fx.shrink.toFixed(2)}` : ""} ` +
      `sm ${fx.softs} pt ${fx.particles}`;
    if (this.el.textContent !== text) this.el.textContent = text;
  }
  remove() {
    this.el.remove();
  }
}
