/**
 * When a touch really happened, as far as the page can tell (battle-perf.ts
 * `press`, "eventToHandler").
 *
 * WebKit on iOS stamps every touch and pointer event of a gesture with
 * `touches.anyObject.timestamp` (WKTouchEventsGestureRecognizer,
 * `_recordTouches`): the time of the last change of ANY finger down, not of
 * the one that changed. With a thumb resting still on the joystick, a
 * skill tapped by the other hand can carry the time the thumb last moved,
 * seconds ago. Production read that as 0.7–0.8 s from touch to handler at
 * p95 (1.35 s at worst) on a phone drawing a steady 59 fps (28 Nov 2026).
 *
 * Events reach the page in the order they happened, so a new event can't
 * be older than one already delivered. An event stamped no later than the
 * newest stamp seen, from an event delivered a while before it (not one of
 * the same dispatch: touchstart and pointerdown of one touch share a stamp),
 * is carrying another finger's old time: its stamp is not used.
 */
export const SAME_DISPATCH_MS = 16;

export class TouchClock {
  private newest = -Infinity;
  private newestAt = -Infinity;
  private stale = new WeakSet<Event>();
  /** Every touch and pointer event, before any handler (window, capture). */
  see(event: Event, now = performance.now()) {
    const stamp = event.timeStamp;
    if (!Number.isFinite(stamp)) return;
    if (stamp <= this.newest && now - this.newestAt > SAME_DISPATCH_MS)
      this.stale.add(event);
    if (stamp > this.newest) {
      this.newest = stamp;
      this.newestAt = now;
    }
  }
  /** The event's own time, or undefined when it carries another finger's. */
  stampOf(event: Event) {
    return this.stale.has(event) ? undefined : event.timeStamp;
  }
  /** Whether the event's stamp was another finger's old time. */
  isStale(event: Event) {
    return this.stale.has(event);
  }
  /** Watch the window's touches and pointers (before the game's handlers). */
  listen(target: Window = window) {
    for (const type of [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointercancel",
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
    ])
      target.addEventListener(type, (e) => this.see(e), {
        capture: true,
        passive: true,
      });
    return this;
  }
}
