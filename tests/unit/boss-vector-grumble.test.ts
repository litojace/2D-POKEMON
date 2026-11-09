import { describe, expect, it } from "vitest";
import {
  grumbleGuideImage,
  grumbleIdle,
  grumbleParts,
  grumblePose,
  lookFrom,
  nextFacing,
  partDepth,
  project,
  turnToward,
  viewYaw,
  yawFor,
  type GrumbleCue,
} from "../../apps/client/src/boss-vector-grumble";

const cue = (o: Partial<GrumbleCue> = {}): GrumbleCue => ({
  time: 1,
  breath: 0,
  phase: 1,
  reduced: false,
  charge: 0,
  charging: false,
  slam: 0,
  impact: 0,
  debris: 0,
  transform: 0,
  windup: 0,
  castAge: 99,
  stagger: false,
  exposed: false,
  hurt: 0,
  dead: false,
  stride: 0,
  speed: 0,
  look: 0,
  ...o,
});
const part = (pose: ReturnType<typeof grumblePose>, id: string, yaw = 0) => {
  const p = grumbleParts(pose, yaw).parts.find((x) => x.id === id)!;
  return p.kind === "crystal" ? p.tip : p.w;
};

describe("vector Grumblecrag rig", () => {
  it("raises both fists for a Ground Slam and drives them down on impact", () => {
    const idle = grumblePose(cue());
    const lift = grumblePose(cue({ slam: 1 }));
    const hit = grumblePose(cue({ impact: 1 }));
    for (const id of ["fistL", "fistR"]) {
      expect(part(lift, id).y).toBeGreaterThan(part(idle, id).y + 80);
      expect(part(hit, id).y).toBeLessThan(part(lift, id).y - 80);
    }
    expect(lift.fistGlow).toBeGreaterThan(0.9);
    expect(lift.glow).toBeGreaterThan(idle.glow);
  });

  it("winds up each attack its own way", () => {
    const volley = grumblePose(cue({ windKind: "volley", windup: 1 }));
    expect(volley.hold).toBe(1); // a rock in the right fist
    expect(volley.twist).toBeLessThan(-0.4);
    const thrown = grumblePose(cue({ castKind: "volley", castAge: 0.05 }));
    expect(thrown.hold).toBe(0);
    expect(thrown.armR.swing).toBeGreaterThan(1.3);
    const meteor = grumblePose(cue({ windKind: "share", windup: 1 }));
    expect(meteor.armL.swing).toBeGreaterThan(2.8); // both arms to the sky
    const erupt = grumblePose(cue({ castKind: "eruption", castAge: 0 }));
    expect(erupt.crouch).toBeGreaterThan(25);
    // A cast long past leaves the idle pose.
    expect(grumblePose(cue({ castKind: "volley", castAge: 3 })).armR).toEqual(
      grumblePose(cue()).armR,
    );
  });

  it("kneels with the core open when staggered, roars into a new phase, and goes slack when dead", () => {
    const s = grumblePose(cue({ stagger: true }));
    expect(s.crouch).toBeGreaterThan(30);
    expect(s.expose).toBe(1);
    const roar = grumblePose(cue({ transform: 1 }));
    expect(roar.jaw).toBe(1);
    expect(roar.mouthGlow).toBe(1);
    const dead = grumblePose(cue({ dead: true, slam: 1, transform: 1 }));
    expect([dead.glow, dead.expose, dead.jaw, dead.fistGlow]).toEqual([
      0, 0, 0, 0,
    ]);
    // Phase 3 is always exposed (the server's rule), and burns hotter.
    const hot = grumblePose(cue({ phase: 3, exposed: true }));
    expect(hot.expose).toBe(1);
    expect(hot.glow).toBeGreaterThan(grumblePose(cue()).glow);
  });

  it("walks when it moves, runs when charging, and holds still with reduced motion", () => {
    const walk = grumblePose(cue({ speed: 60, stride: 1 }));
    expect(Math.abs(walk.legL)).toBeGreaterThan(0.2);
    const run = grumblePose(cue({ charging: true, stride: 1 }));
    expect(run.lean).toBeGreaterThan(0.4);
    const still = grumblePose(
      cue({ speed: 60, stride: 1, reduced: true, time: 5, breath: 1 }),
    );
    expect(still.legL).toBe(0);
    expect(still).toEqual(
      grumblePose(
        cue({ speed: 60, stride: 1, reduced: true, time: 9, breath: -1 }),
      ),
    );
  });

  it("plays no roar, flinch or follow-through with reduced motion, but keeps windups", () => {
    const calm = grumblePose(cue({ reduced: true }));
    expect(
      grumblePose(
        cue({ reduced: true, transform: 0.8, hurt: 0.9, impact: 0.7 }),
      ),
    ).toEqual(calm);
    expect(
      grumblePose(cue({ reduced: true, slam: 1 })).armL.swing,
    ).toBeGreaterThan(2.5);
  });

  it("shows eight facings and does not flicker between two", () => {
    const facingFor = (deg: number) => Math.PI / 2 - (deg * Math.PI) / 180;
    expect(
      [0, 45, 90, 135, 180, 225, 270, 315].map((d) => nextFacing(facingFor(d))),
    ).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // Past halfway (22.5°) but not far: the shown facing holds.
    expect(nextFacing(facingFor(90 - 25), 2)).toBe(2);
    expect(nextFacing(facingFor(90 - 32), 2)).toBe(1);
    expect(nextFacing(facingFor(-1), 0)).toBe(0);
    expect(nextFacing(facingFor(-40), 0)).toBe(7);
    // Turning takes the short way round.
    expect(turnToward(0.1, -0.1, 1)).toBeCloseTo(-0.1);
    expect(turnToward(3.1, -3.1, 0.01, 16)).toBeGreaterThan(3.1);
    expect(yawFor(Math.PI / 2)).toBe(0);
    expect(lookFrom(0, 1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it("turns profiles toward the camera but keeps front and back", () => {
    expect(viewYaw(0)).toBe(0);
    expect(viewYaw(Math.PI)).toBeCloseTo(Math.PI);
    expect(viewYaw(Math.PI / 2)).toBeCloseTo(Math.PI / 2 - 0.5);
    expect(viewYaw(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2 + 0.5);
  });

  it("sorts parts front to back: the face in front facing the camera, behind facing away", () => {
    const idle = grumbleIdle();
    const order = (yaw: number) =>
      grumbleParts(idle, yaw)
        .parts.slice()
        .sort((a, b) => partDepth(a) - partDepth(b))
        .map((p) => p.id);
    const front = order(0),
      back = order(Math.PI);
    expect(front.indexOf("core")).toBeGreaterThan(front.indexOf("torso"));
    expect(front.indexOf("eyeL")).toBeGreaterThan(front.indexOf("head"));
    expect(back.indexOf("spine1")).toBeGreaterThan(back.indexOf("torso"));
    // The feet stand on the ground and the horns reach highest.
    const parts = grumbleParts(idle, 0).parts;
    const foot = parts.find((p) => p.id === "footL")!;
    expect(foot.kind === "rock" && project(foot.w).y).toBeLessThan(0);
    const horn = parts.find((p) => p.id === "hornL")!;
    expect(horn.kind === "crystal" && project(horn.tip).y).toBeLessThan(-240);
  });

  it("gives the briefing diagram a crop around the boss (no picture outside a browser)", () => {
    const art = grumbleGuideImage(false);
    expect(art.url).toBe("");
    const [x, y, w, h] = art.crop;
    expect(w).toBeGreaterThan(150);
    expect(h).toBeGreaterThan(200);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(x + w).toBeLessThanOrEqual(art.width);
    expect(y + h).toBeLessThanOrEqual(art.height + 1);
    expect(art.core[0]).toBeGreaterThan(x);
    expect(art.core[1]).toBeGreaterThan(y);
    expect(art.core[1]).toBeLessThan(y + h);
  });
});
