import { expect, it } from "vitest";
import {
  AnimationController,
  facing,
  type AnimationPose,
} from "../../apps/client/src/animation/controller";
import { Arena } from "../../apps/server/src/simulation";
import { CHARACTERS, KEYS, type CharacterId } from "@arena/shared";
const pose: AnimationPose = {
  hp: 100,
  speed: 0,
  angle: 0,
  dash: false,
  jump: false,
};
it("keeps locomotion clocks stable, transitions run/walk/idle and faces all four directions", () => {
  const a = new AnimationController();
  expect(a.update({ ...pose, speed: 200 }, 10, 150)).toBe("run");
  a.update({ ...pose, speed: 200 }, 50, 150);
  expect(a.started).toBe(10);
  expect(a.update({ ...pose, speed: 80 }, 60, 150)).toBe("walk");
  expect(a.update(pose, 70, 150)).toBe("idle");
  expect([0, Math.PI / 2, Math.PI, -Math.PI / 2].map(facing)).toEqual([
    "right",
    "down",
    "left",
    "up",
  ]);
});
it("deduplicates authoritative casts, lets hurt interrupt and defeat override, recovers on respawn", () => {
  const a = new AnimationController();
  expect(a.trigger("skill0", 0, 300, 1)).toBe(true);
  expect(a.trigger("skill0", 40, 300, 1)).toBe(false);
  expect(a.started).toBe(0);
  a.trigger("hurt", 100, 160);
  expect(a.trigger("basic", 110, 300, 2)).toBe(false);
  expect(a.update(pose, 270, 150)).toBe("idle");
  a.trigger("skill3", 300, 650, 3);
  expect(a.update({ ...pose, hp: 0 }, 310, 150)).toBe("defeat");
  expect(a.trigger("wave", 320, 1800)).toBe(false);
  expect(a.update(pose, 400, 150)).toBe("idle");
});
it("interrupts emotes with movement and combat and clears old timers on round reset", () => {
  const a = new AnimationController();
  a.trigger("wave", 10, 1800);
  expect(a.update({ ...pose, speed: 100 }, 20, 150)).toBe("walk");
  a.trigger("victory", 30, 1800);
  expect(a.trigger("basic", 40, 300)).toBe(true);
  a.reset();
  expect(a.update(pose, 50, 150)).toBe("idle");
  expect(a.trigger("skill1", 60, 300, 1)).toBe(true);
});
it("uses dash, jump, landing and charge poses without changing gameplay state", () => {
  const a = new AnimationController();
  expect(a.update({ ...pose, dash: true }, 0, 150)).toBe("dash");
  expect(a.update({ ...pose, jump: true }, 200, 150)).toBe("jump");
  a.trigger("land", 650, 130);
  expect(a.update(pose, 700, 150)).toBe("land");
  expect(a.update({ ...pose, charging: true }, 800, 150)).toBe("skill3");
  expect(a.update(pose, 1500, 150)).toBe("idle");
  expect(pose).toEqual({
    hp: 100,
    speed: 0,
    angle: 0,
    dash: false,
    jump: false,
  });
});
it("identifies basic attacks and all sixteen skills in the existing event stream", () => {
  for (const character of Object.keys(CHARACTERS) as CharacterId[]) {
    const arena = new Arena("TEST");
    const p = arena.add("player", "Player", character);
    for (const ability of [
      CHARACTERS[character].basic,
      ...CHARACTERS[character].skills,
    ]) {
      arena.cast(p, ability);
      const event = arena.events
        .filter((e) => e.kind === "cast" && e.owner === p.id)
        .at(-1)!;
      expect(event.abilityId).toBe(ability.id);
    }
  }
});
it("uses R for the ultimate and right mouse for dash", () => {
  expect(KEYS.skills).toEqual(["1", "2", "3", "R"]);
  expect(KEYS.dash).toBe("RMB");
});
