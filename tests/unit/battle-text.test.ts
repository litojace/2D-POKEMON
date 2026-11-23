import { beforeEach, expect, it } from "vitest";
import {
  addBattleText,
  fontKey,
  forgetFontMetrics,
} from "../../apps/client/src/battle-text";

/** A scene whose Text measures its font the way Phaser does, counted. */
function fakeScene() {
  const made: { style: Record<string, unknown>; measured: boolean }[] = [];
  const scene = {
    add: {
      text(_x: number, _y: number, _text: string, style: any) {
        const measured = !style.metrics;
        const metrics = style.metrics ?? {
          ascent: 23,
          descent: 7,
          fontSize: parseInt(style.fontSize, 10) + 4,
        };
        made.push({ style, measured });
        return { getTextMetrics: () => ({ ...metrics }) };
      },
    },
  };
  return { scene: scene as any, made };
}
const STYLE = {
  fontFamily: "DM Sans, sans-serif",
  fontStyle: "bold",
  fontSize: "26px",
  color: "#eef2ff",
  stroke: "#0b1020",
  strokeThickness: 5,
};

beforeEach(forgetFontMetrics);

it("measures each font once and passes the resolution with the style", () => {
  const { scene, made } = fakeScene();
  addBattleText(scene, 0, 0, "−7", STYLE, 1.5);
  addBattleText(scene, 0, 0, "−12", { ...STYLE, color: "#ffd65b" }, 1.5);
  addBattleText(scene, 0, 0, "−38", { ...STYLE, fontSize: "38px" }, 1.5);
  addBattleText(scene, 0, 0, "−40", { ...STYLE, fontSize: "38px" }, 1.5);
  expect(made.map((m) => m.measured)).toEqual([true, false, true, false]);
  // The measure handed on is the one Phaser took for that font.
  expect(made[1].style.metrics).toEqual({
    ascent: 23,
    descent: 7,
    fontSize: 30,
  });
  expect(made[3].style.metrics).toEqual({
    ascent: 23,
    descent: 7,
    fontSize: 42,
  });
  expect(made.every((m) => m.style.resolution === 1.5)).toBe(true);
  // The rest of the style is untouched.
  expect(made[1].style.color).toBe("#ffd65b");
  expect(made[0].style.strokeThickness).toBe(5);
});

it("measures again after a web font has loaded", () => {
  const { scene, made } = fakeScene();
  addBattleText(scene, 0, 0, "−7", STYLE, 2);
  forgetFontMetrics();
  addBattleText(scene, 0, 0, "−7", STYLE, 2);
  expect(made.map((m) => m.measured)).toEqual([true, true]);
});

it("keys a font as Phaser's TextStyle does", () => {
  expect(fontKey(STYLE)).toBe("bold 26px DM Sans, sans-serif");
  expect(fontKey({ fontFamily: "system-ui" })).toBe("system-ui");
});
