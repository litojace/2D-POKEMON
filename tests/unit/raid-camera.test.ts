import { describe, expect, it } from "vitest";

import {
  RaidCamera,
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
      opts.wide ?? false,
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
    expect(out.zoomX).toBeCloseTo(overview.zoomX, 2);
    expect(out.x).toBeCloseTo(overview.x, 0);
    expect(out.y).toBeCloseTo(overview.y, 0);
    const back = follow(cam, { x: 300, y: 700 }, { frames: 200 });
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
