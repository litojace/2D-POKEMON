import { expect, it } from "vitest";
import { RaidArena } from "../../apps/server/src/raid";
import { RaidBossMotion } from "../../apps/client/src/raid-boss-motion";

function setup() {
  const arena = new RaidArena("ART");
  arena.add("hero", "Hero");
  arena.start();
  arena.phase = "playing";
  const motion = new RaidBossMotion();
  const sample = (clock: number, reduced = false) =>
    motion.sample(arena.snapshot(), clock, reduced)!;
  sample(0);
  return { arena, motion, sample };
}
it("finishes the defeat collapse when the server clock stops, without repeating its sound", () => {
  const { arena, sample } = setup();
  arena.raid.result = "victory";
  arena.phase = "finished";
  expect(sample(0.05).cues).toContain("fall");
  const frozen = arena.time;
  for (let i = 2; i < 70; i++) sample(i * 0.05);
  const end = sample(3.5);
  expect(arena.time).toBe(frozen);
  expect(end.collapse).toBe(1);
  expect(end.cues).not.toContain("fall");
});
it("does not play an impact for an attack cancelled by a stagger", () => {
  const { arena, sample } = setup();
  arena.raid.warnings = [
    {
      id: 1,
      kind: "slam",
      x: 800,
      y: 450,
      tx: 800,
      ty: 450,
      radius: 240,
      startedAt: 0,
      at: 1.25,
    },
  ];
  expect(sample(0.05).cues).toContain("roar");
  arena.time = 0.6;
  arena.raid.staggerUntil = 6;
  arena.raid.warnings = [];
  expect(sample(0.1).cues).not.toContain("slam");
  arena.time = 1.3;
  expect(sample(0.15).cues).not.toContain("slam");
});
it("plays one impact when an observed windup resolves", () => {
  const { arena, sample } = setup();
  arena.raid.warnings = [
    {
      id: 2,
      kind: "slam",
      x: 800,
      y: 450,
      tx: 800,
      ty: 450,
      radius: 240,
      startedAt: 0,
      at: 1.25,
    },
  ];
  sample(0.05);
  arena.time = 1.25;
  arena.raid.warnings = [];
  expect(sample(0.1).cues).toContain("slam");
  expect(sample(0.15).cues).not.toContain("slam");
});
it("shows the final phase transformation once and pauses its presentation clock", () => {
  const { arena, sample } = setup();
  arena.raid.phase = 3;
  const first = sample(0.05);
  expect(first.cues).toContain("awaken");
  expect(first.transform).toBe(1);
  arena.phase = "paused";
  expect(sample(20).time).toBe(first.time);
  arena.phase = "playing";
  expect(sample(20.05).cues).not.toContain("awaken");
});
it("bounds fragments under sustained damage and clears old effects on a new run", () => {
  const { arena, motion, sample } = setup();
  for (let i = 1; i < 40; i++) {
    arena.boss()!.hp -= 1;
    sample(i * 0.12);
  }
  expect(motion.fragments.length).toBeGreaterThan(0);
  expect(motion.fragments.length).toBeLessThanOrEqual(64);
  arena.raid.seed++;
  expect(sample(5).hurt).toBe(0);
  expect(motion.fragments).toHaveLength(0);
});
it("keeps reduced motion free of fragments and presents a finished rubble pose immediately", () => {
  const { arena, sample } = setup();
  arena.boss()!.hp -= 10;
  expect(sample(0.1, true).fragments).toHaveLength(0);
  arena.raid.result = "victory";
  arena.phase = "finished";
  expect(sample(0.2, true).collapse).toBe(1);
});
it("distinguishes charge and debris skill cues without repeating them each snapshot", () => {
  const { arena, sample } = setup();
  arena.raid.warnings = [
    {
      id: 10,
      kind: "charge",
      x: 800,
      y: 450,
      tx: 1200,
      ty: 450,
      radius: 80,
      startedAt: 0,
      at: 1.7,
    },
  ];
  expect(sample(0.05).cues).toContain("charge");
  expect(sample(0.1).cues).not.toContain("charge");
  arena.raid.warnings = [
    {
      id: 11,
      kind: "debris",
      x: 600,
      y: 450,
      tx: 600,
      ty: 450,
      radius: 95,
      startedAt: 0,
      at: 1.65,
    },
  ];
  expect(sample(0.15).cues).toContain("debris");
  arena.time = 1.65;
  arena.raid.warnings = [];
  expect(sample(0.2).cues).toContain("debris-hit");
  expect(sample(0.25).cues).not.toContain("debris-hit");
});
