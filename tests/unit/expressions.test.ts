import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "@arena/shared";
import {
  MOODS,
  creatureLayers,
  creatureSvg,
} from "../../apps/client/src/creature-design";
import { moodKey, rigAssets } from "../../apps/client/src/animation/assets";
import { moodFor, squashFor } from "../../apps/client/src/animation/expression";
import { AnimationController } from "../../apps/client/src/animation/controller";

const pose = { hp: 100, speed: 0, angle: 0, dash: false, jump: false };

describe("expressions", () => {
  it("draws a distinct face for every mood, facing and fighter", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of ["down", "left", "right"] as const) {
        const normal = creatureLayers(id, dir).layers.eyes;
        const seen = new Set([normal]);
        for (const mood of MOODS) {
          const eyes = creatureLayers(id, dir, mood).layers.eyes;
          expect(eyes, `${id} ${dir} ${mood}`).not.toBe("");
          expect(eyes).not.toMatch(/NaN|undefined/);
          seen.add(eyes);
          // Only the eyes change with the mood.
          expect(creatureLayers(id, dir, mood).layers.head).toBe(
            creatureLayers(id, dir).layers.head,
          );
        }
        expect(seen.size, `${id} ${dir}`).toBe(MOODS.length + 1);
      }
    // The back of the head has no face to change.
    expect(creatureLayers("voltkit", "up", "happy").layers.eyes).toBe("");
  });
  it("ships a texture for every expression the rig can ask for", () => {
    for (const id of FIGHTER_IDS) {
      const keys = new Set(rigAssets(id).map((a) => a.key));
      for (const dir of ["down", "left", "right"] as const)
        for (const mood of ["normal", ...MOODS] as const)
          expect(keys.has(moodKey(id, dir, mood)), `${id} ${dir} ${mood}`).toBe(
            true,
          );
    }
  });
  it("picks the face for the moment", () => {
    expect(moodFor("defeat", {})).toBe("dizzy");
    expect(moodFor("hurt", { ultReady: true })).toBe("hurt");
    expect(moodFor("victory", {})).toBe("happy");
    expect(moodFor("wave", {})).toBe("happy");
    expect(moodFor("idle", { ultReady: true })).toBe("focus");
    expect(moodFor("run", { charging: true })).toBe("focus");
    expect(moodFor("idle", {})).toBe("normal");
  });
  it("squashes on landing, stretches on take-off and settles back", () => {
    const [lx, ly] = squashFor("land", 0, 0, 0);
    expect(lx).toBeGreaterThan(1);
    expect(ly).toBeLessThan(1);
    expect(squashFor("land", 1, 0.2, 0)).toEqual([1, 1]);
    const [jx, jy] = squashFor("jump", 0, 0, 0);
    expect(jy).toBeGreaterThan(1);
    expect(jx).toBeLessThan(1);
    expect(squashFor("jump", 0.5, 1, 0)).toEqual([1, 1]);
    // Dashes stretch along the motion.
    expect(squashFor("dash", 0, 0, 0)[0]).toBeGreaterThan(1);
    expect(squashFor("dash", 0, 0, Math.PI / 2)[1]).toBeGreaterThan(1);
    expect(squashFor("idle", 0.5, 1, 0)).toEqual([1, 1]);
  });
  it("greets at the start of a round and stops greeting once play begins", () => {
    const a = new AnimationController();
    expect(a.update({ ...pose, greet: true }, 0, 150)).toBe("wave");
    expect(a.update({ ...pose, greet: true, speed: 200 }, 20, 150)).toBe("run");
    expect(a.update(pose, 40, 150)).toBe("idle");
    // Winning outranks the greeting.
    expect(a.update({ ...pose, greet: true, victory: true }, 60, 150)).toBe(
      "victory",
    );
  });
  it("keeps every redesigned card free of broken markup", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of ["up", "down", "left", "right"] as const)
        for (const mood of ["normal", ...MOODS] as const) {
          const svg = creatureSvg(id, dir, undefined, undefined, mood);
          expect(svg).not.toMatch(/NaN|undefined|Infinity/);
          expect(svg.match(/<svg /g)).toHaveLength(1);
        }
  });
});
