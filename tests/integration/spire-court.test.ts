/**
 * A live Spire climb on its own court (apps/server/src/spire.ts with
 * packages/shared/src/spire-court.ts): on a wave floor the layout's blocks
 * stop raiders walking into them and stop their shots, the old Coliseum
 * blocks are gone, and an Echo's bot walks round the cover to reach a raider.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OBSTACLES,
  RULES,
  blankInput,
  useObstacles,
  type Fighter,
} from "@arena/shared";
import { SpireArena } from "../../apps/server/src/spire";
import { SPIRE_COURT_LAYOUTS } from "../../packages/shared/src/spire-court";

const DT = 1 / RULES.tick;
afterEach(() => {
  vi.restoreAllMocks();
  useObstacles(OBSTACLES);
});

function climb(floor: number) {
  let s = 91;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((
    buffer: Uint32Array,
  ) => {
    for (let i = 0; i < buffer.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      buffer[i] = s;
    }
    return buffer;
  }) as never);
  const a = new SpireArena("COURT");
  a.add("me", "tester", "voltkit");
  a.configureSpire({ startFloor: floor, ceiling: 9 });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  const me = a.heroes()[0];
  return { a, me };
}
/** Hold an input for `seconds` (a fresh sequence number every tick). */
function hold(
  a: SpireArena,
  me: Fighter,
  seconds: number,
  input: Partial<ReturnType<typeof blankInput>>,
  each?: () => void,
) {
  for (let i = 0; i < Math.round(seconds * RULES.tick); i++) {
    a.submit(me, { ...blankInput(), ...input, seq: me.ack + 1 });
    a.tick(DT);
    // Keep the raider standing (the Echoes are fighting too).
    me.hp = Math.max(me.hp, 80);
    each?.();
  }
}

describe("the Spire court in a live climb", () => {
  it("a wave floor's block stops a raider walking into it", () => {
    const { a, me } = climb(1);
    expect(a.phase).toBe("playing");
    const block = SPIRE_COURT_LAYOUTS.gates.blocks[0]; // 520,392 90x116
    Object.assign(me, { x: block.x - 120, y: block.y + block.h / 2 });
    hold(a, me, 1.2, { dx: 1, dy: 0 });
    // Pressed against its west face, never inside it.
    expect(me.x).toBeLessThanOrEqual(block.x - RULES.radius + 0.5);
    expect(me.x).toBeGreaterThan(block.x - RULES.radius - 14);
  });

  it("a wave floor's block stops a raider's shots", () => {
    const { a, me } = climb(1);
    const block = SPIRE_COURT_LAYOUTS.gates.blocks[0];
    Object.assign(me, { x: block.x - 140, y: block.y + block.h / 2 });
    let furthest = 0,
      fired = 0;
    const seen = new Set<number>();
    hold(
      a,
      me,
      1.5,
      { basic: true, aimX: 1500, aimY: block.y + block.h / 2 },
      () => {
        for (const p of a.projectiles)
          if (p.owner === me.id) {
            if (!seen.has(p.id)) fired++;
            seen.add(p.id);
            furthest = Math.max(furthest, p.x);
          }
        Object.assign(me, { x: block.x - 140, y: block.y + block.h / 2 });
      },
    );
    expect(fired).toBeGreaterThan(0);
    // No shot ever passed into the block.
    expect(furthest).toBeLessThan(block.x + 10);
  });

  it("the Coliseum's centre block is not on the Spire court", () => {
    const { a, me } = climb(1);
    // Where Cragmuff's court has its centre block (750,390 100x120).
    Object.assign(me, { x: 700, y: 450 });
    hold(a, me, 0.6, { dx: 1, dy: 0 });
    expect(me.x).toBeGreaterThan(OBSTACLES[4].x + 40);
  });

  it("an Echo walks round the cover to reach a raider", () => {
    const { a, me } = climb(2); // Twin Walls
    const wall = SPIRE_COURT_LAYOUTS.walls.blocks[1]; // 1040,320 72x260
    // Wait for the first Echo, then put it behind the wall from the raider.
    for (let i = 0; i < 200 && !a.players.some((p) => p.echo && p.hp > 0); i++)
      hold(a, me, DT, {});
    const echo = a.players.find((p) => p.echo && p.hp > 0)!;
    expect(echo).toBeDefined();
    Object.assign(echo, { x: wall.x + wall.w + 60, y: wall.y + wall.h / 2 });
    Object.assign(me, { x: wall.x - 160, y: wall.y + wall.h / 2 });
    let closest = Infinity;
    hold(a, me, 6, {}, () => {
      Object.assign(me, { x: wall.x - 160, y: wall.y + wall.h / 2 });
      closest = Math.min(closest, Math.abs(echo.x - me.x));
      // Never inside the wall.
      const inside =
        echo.x > wall.x &&
        echo.x < wall.x + wall.w &&
        echo.y > wall.y &&
        echo.y < wall.y + wall.h;
      expect(inside).toBe(false);
    });
    // It got round to the raider's side.
    expect(closest).toBeLessThan(150);
  });
});
