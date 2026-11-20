import { describe, expect, it } from "vitest";
import {
  TOUR_NEW_LEVEL,
  TOUR_STEPS,
  loadTour,
  placeBubble,
  saveTour,
  tourDue,
  tourMarkup,
} from "../../apps/client/src/hub-tour";

// The Lobby tour: a short, skippable first look at the hub (hub-tour.ts).
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const view = { w: 844, h: 390 };
const none = { top: 0, right: 0, bottom: 0, left: 0 };
const bubble = { w: 270, h: 160 };

describe("Lobby tour", () => {
  it("stays short: a few marks, each with a target and short text", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(6);
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    for (const s of TOUR_STEPS) {
      expect(s.targets.length).toBeGreaterThan(0);
      expect(s.title.length).toBeLessThanOrEqual(32);
      // About two lines in the bubble on a phone.
      expect(s.text.length).toBeLessThanOrEqual(120);
    }
  });

  it("starts on its own only for a new account that hasn't seen it", () => {
    expect(tourDue(undefined, 1)).toBe(true);
    expect(tourDue(undefined, TOUR_NEW_LEVEL)).toBe(true);
    expect(tourDue(undefined, TOUR_NEW_LEVEL + 1)).toBe(false);
    // The account is still loading.
    expect(tourDue(undefined, undefined)).toBe(false);
    expect(tourDue("done", 1)).toBe(false);
    expect(tourDue("skipped", 1)).toBe(false);
  });

  it("remembers per account that it was done or skipped", () => {
    expect(loadTour("a")).toBeUndefined();
    saveTour("a", "skipped");
    expect(loadTour("a")).toBe("skipped");
    expect(loadTour("b")).toBeUndefined();
    store.set("arena-tour:c", "nonsense");
    expect(loadTour("c")).toBeUndefined();
    expect(loadTour(undefined)).toBeUndefined();
  });

  it("every step offers Skip; the last says Got it, the first has no Back", () => {
    const first = tourMarkup(TOUR_STEPS[0], 0, 6);
    expect(first).toContain('data-tour="skip"');
    expect(first).not.toContain('data-tour="back"');
    expect(first).toContain(">Next<");
    const last = tourMarkup(TOUR_STEPS[5], 5, 6);
    expect(last).toContain('data-tour="skip"');
    expect(last).toContain('data-tour="back"');
    expect(last).toContain(">Got it<");
    expect(last).toContain("6 / 6");
  });

  it("puts the bubble beside a target, inside the safe area", () => {
    // PLAY, bottom right on a landscape phone: to its left.
    const play = placeBubble(
      { x: 630, y: 270, w: 200, h: 110 },
      bubble,
      view,
      none,
    );
    expect(play.side).toBe("left");
    expect(play.x + bubble.w).toBeLessThanOrEqual(630);
    expect(play.y + bubble.h).toBeLessThanOrEqual(view.h - 8);
    // The rail on the left: to its right.
    const rail = placeBubble(
      { x: 14, y: 64, w: 56, h: 280 },
      bubble,
      view,
      none,
    );
    expect(rail.side).toBe("right");
    // A header button up top: below it, clear of the right inset.
    const safe = { top: 0, right: 44, bottom: 21, left: 44 };
    const gear = placeBubble(
      { x: 750, y: 8, w: 44, h: 44 },
      bubble,
      view,
      safe,
    );
    expect(gear.side).toBe("below");
    expect(gear.x + bubble.w).toBeLessThanOrEqual(view.w - safe.right - 8);
    expect(gear.y).toBeGreaterThanOrEqual(52);
  });

  it("with no side that fits, takes the roomiest side, inside the screen", () => {
    // A target too wide for a side and too tall for above or below.
    const wide = placeBubble(
      { x: 150, y: 60, w: 560, h: 260 },
      bubble,
      view,
      none,
    );
    expect(["left", "right", "above", "below"]).toContain(wide.side);
    expect(wide.x).toBeGreaterThanOrEqual(8);
    expect(wide.y).toBeGreaterThanOrEqual(8);
    expect(wide.x + bubble.w).toBeLessThanOrEqual(view.w - 8);
    expect(wide.y + bubble.h).toBeLessThanOrEqual(view.h - 8);
  });

  it("sits in the middle when there is no target", () => {
    const centered = placeBubble(null, bubble, view, none);
    expect(centered).toEqual({
      side: "center",
      x: (view.w - bubble.w) / 2,
      y: (view.h - bubble.h) / 2,
    });
  });
});
