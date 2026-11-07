import { describe, expect, it } from "vitest";
import { CHARACTERS, type Ability } from "@arena/shared";
import {
  drawChannel,
  drawProjectile,
  drawWindup,
  drawZone,
  effectKit,
  playBeam,
  playCast,
  playHit,
  playImpact,
} from "../../apps/client/src/skill-effects";

/** Anything callable, chainable and readable: a stand-in for Phaser objects. */
function deep(overrides: Record<string | symbol, unknown> = {}): any {
  const fn = function () {};
  return new Proxy(fn, {
    get: (_t, key) => (key in overrides ? overrides[key] : key === "then" ? undefined : deep()),
    apply: () => deep(),
  });
}
/** A fake scene that runs tweens to completion and lets us step frames. */
function fakeScene() {
  const handlers: Record<string, ((t: number, d: number) => void)[]> = {};
  let calls = 0;
  const events = {
    on: (name: string, fn: (t: number, d: number) => void, ctx: unknown) => (handlers[name] ??= []).push(fn.bind(ctx)),
    once: () => undefined,
    off: () => undefined,
  };
  const graphics = () =>
    deep({
      scene,
      lineStyle: (...a: unknown[]) => (calls++, check(a), graphicsProxy),
      fillStyle: (...a: unknown[]) => (calls++, check(a), graphicsProxy),
    });
  const graphicsProxy: any = deep();
  const scene: any = deep({
    events,
    add: deep({ graphics, image: () => deep() }),
    cameras: { main: { width: 1280, height: 720, zoom: 1.2, shake: () => undefined } },
    tweens: {
      addCounter: (cfg: { onUpdate: (t: { getValue(): number }) => void; onComplete: () => void }) => {
        for (const v of [0, 0.25, 0.5, 0.75, 1]) cfg.onUpdate({ getValue: () => v });
        cfg.onComplete();
      },
    },
  });
  const frame = (t: number) => {
    for (const f of handlers.preupdate ?? []) f(t, 16);
    for (const f of handlers.postupdate ?? []) f(t, 16);
  };
  return { scene, graphics, frame, calls: () => calls };
}
/** Every number handed to a draw call must be finite (no NaN sizes or alphas). */
function check(args: unknown[]) {
  for (const a of args) if (typeof a === "number") expect(Number.isFinite(a)).toBe(true);
}

const moves = Object.values(CHARACTERS).flatMap((c) => [c.basic, ...c.skills].map((a) => ({ c, a })));
const SELF = ["buff", "barrier", "rest", "counter", "clone"];

describe("battle effects", () => {
  it("gives every move in the roster a new-style effect", () => {
    const missing: string[] = [];
    for (const { a } of moves) {
      const has =
        ["projectile", "barrage", "charged"].includes(a.kind) ? a.id in effectKit.projectile
        : a.kind === "zone" ? a.id in effectKit.zone
        : a.kind === "cone" ? a.id in effectKit.channel
        : a.kind === "beam" ? a.id in effectKit.beam
        : ["nova", "melee", "veil", ...SELF].includes(a.kind) ? a.id in effectKit.cast
        // A blink or rush plays its cast at takeoff and its impact where it lands.
        : ["blink", "rush"].includes(a.kind) ? a.id in effectKit.cast && a.id in effectKit.impact
        // Nature's own kinds: a tongue (beam), a fan of blades, a ball that
        // rams (roll, pinball), a swap's landing, and the seedling's and
        // Sloth Time's ground.
        : a.kind === "grapple" ? a.id in effectKit.beam && a.id in effectKit.cast
        : a.kind === "shrapnel" ? a.id in effectKit.projectile && a.id in effectKit.impact && a.id in effectKit.cast
        : ["roll", "pinball", "swap"].includes(a.kind) ? a.id in effectKit.cast && a.id in effectKit.impact
        : ["seedling", "timewarp"].includes(a.kind) ? a.id in effectKit.zone
        : false;
      if (!has) missing.push(`${a.id} (${a.kind})`);
      if ((a.cast ?? 0) > 0 && !(a.id in effectKit.windup)) missing.push(`${a.id} wind-up`);
      // The server sends an impact whenever a projectile ends, hit or miss.
      if (["projectile", "barrage", "charged", "shrapnel"].includes(a.kind) && !(a.id in effectKit.impact)) missing.push(`${a.id} impact`);
    }
    for (const c of Object.values(CHARACTERS))
      if (!(c.element.toLowerCase() in effectKit.hit)) missing.push(`${c.element} hit`);
    expect(missing).toEqual([]);
  });

  it("draws every move for many frames without errors or bad numbers", () => {
    const { scene, graphics, frame, calls } = fakeScene();
    const g = graphics();
    let t = 1000;
    for (const { c, a } of moves) {
      const ability = a as Ability;
      for (let i = 0; i < 12; i++, t += 33) {
        frame(t);
        const k = i / 11;
        drawProjectile(g, { id: i, owner: "a", x: 400 + i * 20, y: 300, vx: 600, vy: 40, ability, color: c.color } as never, t, false);
        drawZone(g, { id: 3, owner: "a", x: 500, y: 320, radius: ability.radius || 120, ability: { ...ability, duration: ability.duration || 1 }, color: c.color, until: 0 } as never, k, t, false);
        drawWindup(g, ability, 300, 300, 0.3, 600, 320, c.color, k, t);
        drawChannel(g, ability, 300, 300, 0.3, c.color, t, false);
      }
      playCast(scene, ability, 300, 300, 0.3, c.color, false);
      playImpact(scene, ability, 600, 320, c.color, false);
      playBeam(scene, ability, 300, 300, 700, 300, c.color, false);
      playHit(scene, c.element, 600, 320, c.color, false);
      for (let i = 0; i < 30; i++) frame((t += 33));
    }
    expect(calls()).toBeGreaterThan(1000);
  });

  it("keeps every melee strike on its caster while the caster moves", () => {
    const { scene } = fakeScene();
    // Shatter Palm's cracks and shockwave stay where the palm struck.
    const IMPACT_ONLY = ["shatter-paw"];
    const melee = moves.filter(({ a }) => a.kind === "melee");
    expect(melee.length).toBeGreaterThanOrEqual(14);
    for (const { c, a } of melee) {
      let asked = 0;
      // The caster runs to the right while its strike plays.
      const at = () => ({ x: 300 + 40 * asked++, y: 300 });
      playCast(scene, a as Ability, 300, 300, 0.3, c.color, false, at);
      if (IMPACT_ONLY.includes(a.id)) expect(asked, a.id).toBeGreaterThanOrEqual(1);
      // Asked once to start, then again on every frame of the strike.
      else expect(asked, a.id).toBeGreaterThan(3);
    }
  });
});
