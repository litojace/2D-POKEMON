import { describe, expect, it } from "vitest";
import { CHARACTERS, FIGHTER_IDS, RULES } from "@arena/shared";
import {
  ACTIONS,
  DEFAULT_BINDINGS,
  SkillCaster,
  actionFor,
  assistAim,
  bind,
  bindable,
  codeLabel,
  movementLabel,
  parsePrefs,
  skillLabels,
} from "../../apps/client/src/controls";
import { readPad, stick, type PadLike } from "../../apps/client/src/gamepad";
import {
  drawPreview,
  previewShape,
  type PreviewPainter,
} from "../../apps/client/src/skill-preview";

describe("key bindings", () => {
  it("defaults to W A S D, Q E R F (with 1–4 as backups), mouse attack and dash", () => {
    expect(movementLabel(DEFAULT_BINDINGS)).toBe("W A S D");
    expect(skillLabels(DEFAULT_BINDINGS)).toEqual(["Q", "E", "R", "F"]);
    expect(DEFAULT_BINDINGS.skill1[1]).toBe("Digit1");
    expect(DEFAULT_BINDINGS.skill4[1]).toBe("Digit4");
    expect(actionFor(DEFAULT_BINDINGS, "Mouse0")).toBe("basic");
    expect(actionFor(DEFAULT_BINDINGS, "Mouse2")).toBe("dash");
    expect(actionFor(DEFAULT_BINDINGS, "Space")).toBe("jump");
    expect(actionFor(DEFAULT_BINDINGS, "KeyZ")).toBeUndefined();
  });
  it("never binds one key to two actions", () => {
    const all = ACTIONS.flatMap(({ id }) => DEFAULT_BINDINGS[id]).filter(
      Boolean,
    );
    expect(new Set(all).size).toBe(all.length);
    const { bindings, displaced } = bind(DEFAULT_BINDINGS, "dash", 0, "KeyQ");
    expect(displaced).toBe("skill1");
    expect(bindings.dash[0]).toBe("KeyQ");
    expect(bindings.skill1).toEqual([null, "Digit1"]);
    // The original is untouched.
    expect(DEFAULT_BINDINGS.skill1[0]).toBe("KeyQ");
    // Moving a key between an action's own slots is not a "displacement".
    const own = bind(DEFAULT_BINDINGS, "skill1", 1, "KeyQ");
    expect(own.displaced).toBeUndefined();
    expect(own.bindings.skill1).toEqual([null, "KeyQ"]);
  });
  it("can clear a slot and refuses keys the browser needs", () => {
    expect(bind(DEFAULT_BINDINGS, "jump", 0, null).bindings.jump).toEqual([
      null,
      null,
    ]);
    for (const code of ["Escape", "Tab", "F5", "F11", "F12", "MetaLeft", ""])
      expect(bindable(code), code).toBe(false);
    for (const code of ["KeyQ", "Digit4", "Mouse1", "ShiftLeft", "Numpad0"])
      expect(bindable(code), code).toBe(true);
    expect(bind(DEFAULT_BINDINGS, "jump", 0, "F5").bindings.jump[0]).toBe(
      "Space",
    );
  });
  it("labels keys the way players read them", () => {
    expect(
      [
        "KeyQ",
        "Digit1",
        "Mouse0",
        "Mouse2",
        "Space",
        "ShiftLeft",
        "ArrowUp",
        "Numpad3",
        null,
      ].map(codeLabel),
    ).toEqual(["Q", "1", "LMB", "RMB", "SPACE", "SHIFT", "↑", "NUM 3", "—"]);
  });
  it("loads saved prefs safely", () => {
    expect(parsePrefs(null).bindings).toEqual(DEFAULT_BINDINGS);
    expect(parsePrefs("junk").cast).toBe("preview");
    const saved = parsePrefs({
      bindings: { ...DEFAULT_BINDINGS, skill1: ["KeyZ", "Escape"] },
      cast: "instant",
      aimAssist: true,
    });
    expect(saved.bindings.skill1).toEqual(["KeyZ", null]);
    expect(saved.cast).toBe("instant");
    expect(saved.aimAssist).toBe(true);
    // A tampered save with a duplicate keeps the key on only one action.
    const dup = parsePrefs({
      bindings: { ...DEFAULT_BINDINGS, dash: ["KeyW", null] },
    });
    const owners = ACTIONS.filter(({ id }) =>
      dup.bindings[id].includes("KeyW"),
    );
    expect(owners).toHaveLength(1);
  });
});

describe("skill casting", () => {
  it("instant mode casts on press", () => {
    const c = new SkillCaster();
    expect(c.press(2, "instant")).toBe(2);
    expect(c.release(2, "instant")).toBe(-1);
    expect(c.aiming).toBe(-1);
  });
  it("preview mode shows while held and casts on release", () => {
    const c = new SkillCaster();
    expect(c.press(1, "preview")).toBe(-1);
    expect(c.aiming).toBe(1);
    expect(c.release(1, "preview")).toBe(1);
    expect(c.aiming).toBe(-1);
  });
  it("switching skills mid-aim casts only the one you let go of last", () => {
    const c = new SkillCaster();
    c.press(0, "preview");
    c.press(3, "preview");
    expect(c.release(0, "preview")).toBe(-1);
    expect(c.release(3, "preview")).toBe(3);
  });
  it("a cancelled preview casts nothing", () => {
    const c = new SkillCaster();
    c.press(0, "preview");
    c.cancel();
    expect(c.release(0, "preview")).toBe(-1);
  });
});

describe("aim assist", () => {
  const foes = [
    { x: 500, y: 300 },
    { x: 900, y: 300 },
  ];
  it("snaps to the opponent nearest the cursor when one is close", () => {
    expect(assistAim({ x: 860, y: 340 }, foes)).toEqual({ x: 900, y: 300 });
  });
  it("leaves the cursor alone when nobody is near it", () => {
    expect(assistAim({ x: 700, y: 700 }, foes)).toEqual({ x: 700, y: 700 });
    expect(assistAim({ x: 700, y: 700 }, [])).toEqual({ x: 700, y: 700 });
  });
});

describe("controller", () => {
  const pad = (
    axes: number[],
    pressed: number[] = [],
    value: Record<number, number> = {},
  ): PadLike => ({
    connected: true,
    mapping: "standard",
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: pressed.includes(i),
      value: value[i] ?? (pressed.includes(i) ? 1 : 0),
    })),
  });
  it("ignores stick drift and reaches full speed at the edge", () => {
    expect(stick(0.1, -0.12).m).toBe(0);
    expect(stick(1, 0).x).toBeCloseTo(1);
    const f = readPad(pad([0.15, 0.1, 0, 0]), new Set());
    expect([f.dx, f.dy, f.active]).toEqual([0, 0, false]);
  });
  it("moves with the left stick or D-pad and aims with the right stick", () => {
    const f = readPad(pad([1, 0, 0, -1]), new Set());
    expect(f.dx).toBeCloseTo(1);
    expect(f.aim!.y).toBeCloseTo(-1);
    // A light tilt aims short (zones land closer), a full tilt aims far.
    const light = readPad(pad([0, 0, 0.5, 0]), new Set());
    expect(Math.hypot(light.aim!.x, light.aim!.y)).toBeLessThan(0.5);
    expect(light.aim!.x).toBeGreaterThan(0);
    const d = readPad(pad([0, 0, 0, 0], [12, 15]), new Set());
    expect([d.dx, d.dy]).toEqual([1, -1]);
    expect(d.aim).toBeNull();
  });
  it("reports presses and releases once, with triggers counted past halfway", () => {
    const first = readPad(pad([0, 0, 0, 0], [2], { 7: 0.8 }), new Set());
    expect([...first.pressed].sort()).toEqual(["basic", "skill1"]);
    const held = readPad(pad([0, 0, 0, 0], [2], { 7: 0.8 }), first.held);
    expect(held.pressed.size).toBe(0);
    const up = readPad(pad([0, 0, 0, 0], [], { 7: 0.3 }), held.held);
    expect([...up.released].sort()).toEqual(["basic", "skill1"]);
  });
  it("maps every skill, dash, jump and the menu", () => {
    const all = readPad(
      pad([0, 0, 0, 0], [0, 1, 2, 3, 4, 5, 6, 7, 9]),
      new Set(),
    );
    expect([...all.held].sort()).toEqual(
      [
        "basic",
        "dash",
        "jump",
        "menu",
        "skill1",
        "skill2",
        "skill3",
        "skill4",
      ].sort(),
    );
  });
});

describe("aim preview", () => {
  const from = { x: 400, y: 450 };
  it("draws a shape for every skill of every fighter, inside sane bounds", () => {
    for (const id of FIGHTER_IDS)
      for (const ability of CHARACTERS[id].skills) {
        const shape = previewShape(ability, from, { x: 900, y: 450 });
        const n =
          shape.polygons.length + shape.discs.length + shape.rings.length;
        expect(n, ability.name).toBeGreaterThan(0);
        for (const p of shape.polygons.flat())
          expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
  });
  it("matches the server's reach: projectiles fly `range`, zones land at the aim (capped)", () => {
    const projectile = Object.values(CHARACTERS)
      .flatMap((c) => c.skills)
      .find((a) => a.kind === "projectile")!;
    const lane = previewShape(projectile, from, { x: 2000, y: 450 })
      .polygons[0];
    const tip = Math.max(...lane.map((p) => p.x));
    expect(tip).toBeCloseTo(from.x + 30 + projectile.range, 0);
    const zone = Object.values(CHARACTERS)
      .flatMap((c) => c.skills)
      .find((a) => a.kind === "zone" && !a.follow)!;
    const near = previewShape(zone, from, { x: from.x + 50, y: from.y });
    expect(near.discs[0].x).toBeCloseTo(from.x + 50);
    const far = previewShape(zone, from, { x: from.x + 5000, y: from.y });
    expect(far.discs[0].x).toBeCloseTo(from.x + zone.range);
    expect(far.rings[0].r).toBe(zone.range);
  });
  it("draws novas around the caster at hit reach", () => {
    const nova = Object.values(CHARACTERS)
      .flatMap((c) => c.skills)
      .find((a) => a.kind === "nova")!;
    const disc = previewShape(nova, from, { x: 0, y: 0 }).discs[0];
    expect(disc).toEqual({
      x: from.x,
      y: from.y,
      r: nova.radius + RULES.radius,
    });
  });
  it("is fainter while the skill is still recharging", () => {
    const alphas: number[] = [];
    const g: PreviewPainter = {
      fillStyle: (_c, a = 1) => alphas.push(a),
      lineStyle: () => 0,
      fillPoints: () => 0,
      strokePoints: () => 0,
      fillCircle: () => 0,
      strokeCircle: () => 0,
    };
    const shape = previewShape(CHARACTERS.voltkit.skills[0], from, {
      x: 900,
      y: 450,
    });
    drawPreview(g, shape, 0xffffff, true);
    const ready = alphas.splice(0);
    drawPreview(g, shape, 0xffffff, false);
    expect(Math.max(...alphas)).toBeLessThan(Math.max(...ready));
  });
});
