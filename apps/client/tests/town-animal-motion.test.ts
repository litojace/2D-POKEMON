import { expect, it } from "vitest";
import {
  animalMotionCell,
  createDogMotion,
  createHenMotion,
  gullMotion,
  MOTION_ATLAS,
  stepDog,
  stepHen,
} from "../src/town-animal-motion";

it("keeps side-view birds upright in both directions, including turns", () => {
  const frames = new Set<number>();
  for (const vx of [-100, 100])
    for (const vy of [-30, 0, 30])
      for (let t = 0; t < 12; t += 0.05) {
        const p = gullMotion(t, 0.37, vx, vy);
        frames.add(p.frame);
        expect(Math.abs(p.rotation)).toBeLessThanOrEqual(0.14);
        expect(p.flipX).toBe(vx < 0);
        expect(p.frame).toBeGreaterThanOrEqual(0);
        expect(p.frame).toBeLessThan(8);
      }
  expect(frames.size).toBe(8);
  expect(gullMotion(3, 0, 100, 0)).toMatchObject({
    frame: 2,
    flapping: false,
    rotation: 0,
  });
});

it("lets walking distance drive the dog's feet and eases into real resting poses", () => {
  const d = createDogMotion(),
    poses = new Set<string>();
  let previousSpeed = 0;
  for (let t = 0; t < 25; t += 1 / 60) {
    const before = d.gait,
      p = stepDog(d, t, 1 / 60);
    poses.add(p.pose);
    expect((d.gait - before) * 28).toBeCloseTo(d.speed / 60, 8);
    expect(Math.abs(d.speed - previousSpeed)).toBeLessThan(5);
    expect(p.frame).toBeLessThan(
      p.pose === "walk" ? 8 : p.pose === "sniff" ? 4 : 1,
    );
    previousSpeed = d.speed;
  }
  expect(poses.has("walk")).toBe(true);
  expect(poses.has("sniff") || poses.has("sit")).toBe(true);
});

it("gives hens independent stops and pecks without snapping velocity or leaving home", () => {
  const hens = [
    createHenMotion({ x: 0, y: 0 }, 0.3),
    createHenMotion({ x: 0, y: 0 }, 2.4),
  ];
  const poses = new Set<string>();
  let independent = false;
  for (let t = 0; t < 90; t += 1 / 60) {
    const current = hens.map((h) => {
      const old = h.vx,
        p = stepHen(h, 1 / 60);
      poses.add(p.pose);
      expect(Math.abs(h.vx - old)).toBeLessThan(5);
      expect(Math.hypot(h.x, h.y)).toBeLessThan(70);
      return p.pose;
    });
    independent ||= current[0] !== current[1];
  }
  expect([...poses].sort()).toEqual(["idle", "peck", "walk"]);
  expect(independent).toBe(true);
});

it("selects separate whole poses within the compact atlas", () => {
  const selected = new Set<number>();
  for (const kind of ["dog", "hen", "gull"] as const)
    for (const brown of [false, true])
      for (const pose of ["walk", "idle", "sit", "sniff", "peck", "fly"])
        for (let f = 0; f < 8; f++) {
          const cell = animalMotionCell(kind, pose, f, brown);
          selected.add(cell);
          expect(cell).toBeGreaterThanOrEqual(0);
          expect((Math.floor(cell / 8) + 1) * 160).toBeLessThanOrEqual(
            MOTION_ATLAS.height,
          );
        }
  expect(selected.size).toBe(36);
});
