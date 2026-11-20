import { describe, expect, it } from "vitest";

import {
  RaidCamera,
  raidFrame,
  raidCameraView,
  raidFollowCentre,
  raidWantsCourt,
  RAID_FOLLOW_ZOOM,
} from "../../apps/client/src/raid-camera";
import { edgeSpot } from "../../apps/client/src/ally-bearings";
import type { RaidState } from "../../packages/shared/src/raid";

// A notched phone in landscape (852×393 CSS px) at 2× density, raid HUD 120 px.
const W = 1704,
  H = 786,
  HUD = 120;

function visibleWorld(view: ReturnType<typeof raidCameraView>) {
  return {
    left: view.x - W / view.zoomX / 2,
    right: view.x + W / view.zoomX / 2,
    // Below the HUD only.
    top: view.y + (HUD - H / 2) / view.zoomY,
    bottom: view.y + H / view.zoomY / 2,
  };
}
const WHOLE = { x0: 0, y0: 0, x1: 1600, y1: 900 };
const raid = (extra: Partial<RaidState> = {}) =>
  ({ warnings: [], ...extra }) as unknown as RaidState;
const warning = (kind: string, radius = 80) => ({
  id: 1,
  kind,
  x: 800,
  y: 300,
  tx: 400,
  ty: 400,
  radius,
  at: 10,
});
const follow = (
  cam: RaidCamera,
  focus: { x: number; y: number },
  opts: {
    wide?: boolean;
    follow?: boolean;
    reduced?: boolean;
    frames?: number;
  } = {},
) => {
  let view = raidCameraView(W, H, HUD);
  for (let i = 0; i < (opts.frames ?? 1); i++)
    view = cam.update(
      W,
      H,
      HUD,
      opts.follow ?? true,
      { ...focus, vx: 0, vy: 0 },
      { x: 800, y: 300 },
      opts.wide ? WHOLE : undefined,
      "room:1:me",
      16,
      i * 0.016,
      opts.reduced ?? false,
    );
  return view;
};

describe("raid camera on phones", () => {
  it("is closer than the whole-court overview", () => {
    const overview = raidCameraView(W, H, HUD);
    const view = follow(new RaidCamera(), { x: 300, y: 700 });
    expect(view.zoomX).toBeCloseTo(
      Math.max(W / 1600, (H - HUD) / 900) * RAID_FOLLOW_ZOOM,
    );
    // Fighters drawn at least 1.6× bigger on this phone.
    expect(view.zoomX / overview.zoomX).toBeGreaterThan(1.6);
  });

  it("keeps the raider well inside the view and stays on the court", () => {
    for (const p of [
      { x: 20, y: 20 },
      { x: 1580, y: 880 },
      { x: 800, y: 450 },
      { x: 60, y: 870 },
    ]) {
      const r = visibleWorld(follow(new RaidCamera(), p));
      expect(p.x).toBeGreaterThan(r.left);
      expect(p.x).toBeLessThan(r.right);
      expect(p.y).toBeGreaterThan(r.top);
      expect(p.y).toBeLessThan(r.bottom);
      expect(r.left).toBeGreaterThanOrEqual(-0.01);
      expect(r.right).toBeLessThanOrEqual(1600.01);
      // The court's top edge never goes under the HUD.
      expect(r.top).toBeGreaterThanOrEqual(-0.01);
      expect(r.bottom).toBeLessThanOrEqual(900.01);
    }
  });

  it("leans toward the boss, but not past the raider's margin", () => {
    const zoom = Math.max(W / 1600, (H - HUD) / 900) * RAID_FOLLOW_ZOOM;
    const alone = raidFollowCentre(
      W,
      H,
      HUD,
      zoom,
      { x: 700, y: 600 },
      { x: 0, y: 0 },
    );
    const leaning = raidFollowCentre(
      W,
      H,
      HUD,
      zoom,
      { x: 700, y: 600 },
      { x: 0, y: 0 },
      { x: 1300, y: 600 },
    );
    expect(leaning.x).toBeGreaterThan(alone.x);
    const halfW = W / zoom / 2;
    expect(leaning.x - 700).toBeLessThanOrEqual(halfW * 0.62 + 0.01);
  });

  it("pulls out to the whole court for court-wide warnings, then back in", () => {
    const cam = new RaidCamera();
    const overview = raidCameraView(W, H, HUD);
    follow(cam, { x: 300, y: 700 }, { frames: 5 });
    const out = follow(cam, { x: 300, y: 700 }, { wide: true, frames: 60 });
    // Settled exactly on the overview, not just close to it.
    const settled = follow(
      cam,
      { x: 300, y: 700 },
      { wide: true, frames: 400 },
    );
    expect(settled).toEqual(overview);
    expect(out.zoomX).toBeCloseTo(overview.zoomX, 2);
    expect(out.x).toBeCloseTo(overview.x, 0);
    expect(out.y).toBeCloseTo(overview.y, 0);
    const back = follow(cam, { x: 300, y: 700 }, { frames: 600 });
    expect(back.zoomX).toBeGreaterThan(overview.zoomX * 1.5);
  });

  it("keeps the overview on desktop and with reduced motion", () => {
    const overview = raidCameraView(W, H, HUD);
    expect(
      follow(new RaidCamera(), { x: 300, y: 700 }, { follow: false }),
    ).toEqual(overview);
    expect(
      follow(new RaidCamera(), { x: 300, y: 700 }, { reduced: true }),
    ).toEqual(overview);
  });
});

describe("raidWantsCourt", () => {
  it("is driven by the attack data and warning size", () => {
    expect(raidWantsCourt(raid(), 0)).toBe(false);
    expect(
      raidWantsCourt(raid({ warnings: [warning("slam")] as never }), 0),
    ).toBe(false);
    expect(
      raidWantsCourt(raid({ warnings: [warning("hightide")] as never }), 0),
    ).toBe(true);
    expect(
      raidWantsCourt(
        raid({ warnings: [warning("wing-gust", 470)] as never }),
        0,
      ),
    ).toBe(true);
  });
  it("covers running mechanics whose answer may be anywhere", () => {
    expect(
      raidWantsCourt(
        raid({ quietZone: { x: 0, y: 0, radius: 90, startedAt: 0, until: 5 } }),
        4,
      ),
    ).toBe(true);
    expect(
      raidWantsCourt(
        raid({ quietZone: { x: 0, y: 0, radius: 90, startedAt: 0, until: 5 } }),
        6,
      ),
    ).toBe(false);
    expect(
      raidWantsCourt(
        raid({
          polarities: [{ playerId: "a", sign: 1, until: 5, cancelled: true }],
        }),
        1,
      ),
    ).toBe(false);
    expect(
      raidWantsCourt(
        raid({
          airborne: true,
          braziers: [{ x: 1, y: 1, progress: 0, litUntil: 0 }],
        }),
        1,
      ),
    ).toBe(true);
    expect(
      raidWantsCourt(
        raid({
          airborne: false,
          braziers: [{ x: 1, y: 1, progress: 0, litUntil: 0 }],
        }),
        1,
      ),
    ).toBe(false);
  });
});

describe("edgeSpot", () => {
  const box = { left: 10, top: 60, right: 410, bottom: 260 };
  it("puts an off-screen point's marker on the box edge, toward it", () => {
    const right = edgeSpot(1000, 160, box);
    expect(right.x).toBeCloseTo(410);
    expect(right.y).toBeCloseTo(160);
    expect(right.angle).toBeCloseTo(0);
    const up = edgeSpot(210, -500, box);
    expect(up.y).toBeCloseTo(60);
    expect(up.x).toBeCloseTo(210);
    const corner = edgeSpot(5000, 5000, box);
    expect(corner.x).toBeLessThanOrEqual(410.01);
    expect(corner.y).toBeLessThanOrEqual(260.01);
  });
});

describe("raidFrame: court-wide moments frame what they need", () => {
  const people = [
    { x: 500, y: 450 },
    { x: 1150, y: 450 },
  ];
  it("is undefined when nothing court-wide is going on", () => {
    expect(raidFrame(raid(), 0, people)).toBeUndefined();
  });
  it("frames Prismatail's relay (skylight, mirrors, heart, raiders), not the whole court", () => {
    const f = raidFrame(
      raid({
        mirrors: [
          { x: 600, y: 300, angle: 0 },
          { x: 880, y: 300, angle: 0 },
          { x: 600, y: 600, angle: 0 },
          { x: 880, y: 600, angle: 0 },
        ],
      }),
      0,
      people,
    )!;
    // The skylight (350, 450), the mirrors and the boss at 1150, padded.
    expect(f.x0).toBeLessThanOrEqual(350 - 60);
    expect(f.x1).toBeGreaterThanOrEqual(1150 + 60);
    expect(f.y0).toBeLessThanOrEqual(300 - 60);
    expect(f.y1).toBeGreaterThanOrEqual(600 + 60);
    expect((f.x1 - f.x0) * (f.y1 - f.y0)).toBeLessThan(1600 * 900 * 0.6);
    // On this phone the framed view is closer than the whole court.
    const cam = new RaidCamera();
    const overview = raidCameraView(W, H, HUD);
    let view = overview;
    for (let i = 0; i < 300; i++)
      view = cam.update(
        W,
        H,
        HUD,
        true,
        { x: 500, y: 450, vx: 0, vy: 0 },
        undefined,
        f,
        "k",
        16,
        i * 0.016,
        false,
      );
    expect(view.zoomX / overview.zoomX).toBeGreaterThan(1.2);
    // Everything framed is in view.
    const r = visibleWorld(view);
    expect(r.left).toBeLessThanOrEqual(f.x0 + 0.5);
    expect(r.right).toBeGreaterThanOrEqual(f.x1 - 0.5);
    expect(r.top).toBeLessThanOrEqual(f.y0 + 0.5);
    expect(r.bottom).toBeGreaterThanOrEqual(f.y1 - 0.5);
  });
  it("takes the whole court for sweeps and stays on the court", () => {
    expect(
      raidFrame(raid({ warnings: [warning("breaker")] as never }), 0, people),
    ).toEqual(WHOLE);
    const f = raidFrame(
      raid({ warnings: [warning("fan-display", 650)] as never }),
      0,
      people,
    )!;
    expect(f.x0).toBeGreaterThanOrEqual(0);
    expect(f.y0).toBeGreaterThanOrEqual(0);
    expect(f.x1).toBeLessThanOrEqual(1600);
    expect(f.y1).toBeLessThanOrEqual(900);
  });
  it("includes the pieces the answer lies on: islands for High Tide", () => {
    const f = raidFrame(
      raid({
        warnings: [warning("hightide", 60)] as never,
        islands: [
          { x: 1450, y: 800, radius: 90, cracks: 0, sunk: false },
        ] as never,
      }),
      0,
      people,
    )!;
    expect(f.x1).toBeGreaterThanOrEqual(1540 - 0.5);
    expect(f.y1).toBeGreaterThanOrEqual(890 - 0.5);
  });
});

describe("clear of the touch controls", () => {
  // The joystick reaches 30% in from the left, the skill buttons 30% from the right.
  const SIDES = { left: W * 0.3, right: W * 0.3 };
  const settle = (
    cam: RaidCamera,
    raider: { x: number; y: number },
    boss: { x: number; y: number } | undefined,
    frame?: { x0: number; y0: number; x1: number; y1: number },
  ) => {
    let view = raidCameraView(W, H, HUD);
    for (let i = 0; i < 300; i++)
      view = cam.update(
        W,
        H,
        HUD,
        true,
        { ...raider, vx: 0, vy: 0 },
        boss,
        frame,
        "k",
        16,
        i * 0.016,
        false,
        SIDES,
      );
    return view;
  };
  const screenX = (view: ReturnType<typeof raidCameraView>, x: number) =>
    (x - view.x) * view.zoomX + W / 2;
  it("keeps your raider between the joystick and the buttons, even at a wall", () => {
    for (const x of [20, 300, 800, 1300, 1580]) {
      const view = settle(new RaidCamera(), { x, y: 600 }, undefined);
      const sx = screenX(view, x);
      expect(sx).toBeGreaterThanOrEqual(SIDES.left - 0.5);
      expect(sx).toBeLessThanOrEqual(W - SIDES.right + 0.5);
    }
  });
  it("keeps the boss clear too when both fit", () => {
    const view = settle(
      new RaidCamera(),
      { x: 600, y: 500 },
      { x: 1000, y: 450 },
    );
    const bx = screenX(view, 1000);
    // With a fighter's half-width (55 world px) to spare.
    expect(bx).toBeLessThanOrEqual(W - SIDES.right - 55 * view.zoomX + 0.5);
    expect(screenX(view, 600)).toBeGreaterThanOrEqual(SIDES.left - 0.5);
  });
  it("frames a court-wide moment with your raider clear of the controls", () => {
    const frame = { x0: 280, y0: 230, x1: 1220, y1: 670 };
    const overview = raidCameraView(W, H, HUD);
    const view = settle(new RaidCamera(), { x: 330, y: 600 }, undefined, frame);
    const sx = screenX(view, 330);
    expect(sx).toBeGreaterThanOrEqual(SIDES.left - 0.5);
    // The whole frame still shows, and never further out than the whole court.
    expect(screenX(view, frame.x0)).toBeGreaterThanOrEqual(-0.5);
    expect(screenX(view, frame.x1)).toBeLessThanOrEqual(W + 0.5);
    expect(view.zoomX).toBeGreaterThanOrEqual(overview.zoomX - 1e-9);
  });
});

describe("underControls", () => {
  it("is true in the joystick's and the buttons' columns only", async () => {
    const { underControls } = await import("../../apps/client/src/raid-camera");
    const sides = { left: 300, right: 500 };
    expect(underControls(100, 1700, sides)).toBe(true);
    expect(underControls(800, 1700, sides)).toBe(false);
    expect(underControls(1300, 1700, sides)).toBe(true);
    expect(underControls(100, 1700, { left: 0, right: 0 })).toBe(false);
  });
});

describe("a left mechanic panel", () => {
  it("keeps a court-wide frame to the right of it", () => {
    // Prismatail's relay framed; its buttons stacked on the left to 15% in.
    const frame = { x0: 280, y0: 230, x1: 1220, y1: 670 };
    const sides = { left: W * 0.15, right: W * 0.28, panel: W * 0.15 };
    const cam = new RaidCamera();
    let view = raidCameraView(W, H, HUD);
    for (let i = 0; i < 300; i++)
      view = cam.update(
        W,
        H,
        HUD,
        true,
        { x: 700, y: 500, vx: 0, vy: 0 },
        undefined,
        frame,
        "k",
        16,
        i * 0.016,
        false,
        sides,
      );
    const sx = (x: number) => (x - view.x) * view.zoomX + W / 2;
    expect(sx(frame.x0)).toBeGreaterThanOrEqual(sides.panel - 0.5);
    expect(sx(frame.x1)).toBeLessThanOrEqual(W + 0.5);
  });
});
