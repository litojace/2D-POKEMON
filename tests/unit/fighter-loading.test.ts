import { expect, it } from "vitest";
import {
  FighterLoading,
  neededFighters,
} from "../../apps/client/src/animation/fighter-loading";
import type { RigAsset } from "../../apps/client/src/animation/assets";
import type { CharacterId } from "../../packages/shared/src/index";

function setup() {
  const textures = new Set<string>();
  const built: CharacterId[] = [];
  const loading = new FighterLoading({
    build: (id) => {
      built.push(id);
      return [0, 1].map((n) => ({ key: `${id}-${n}` }) as RigAsset);
    },
    keys: (_id, layers) => layers.map((a) => a.key),
    exists: (key) => textures.has(key),
  });
  /** Pretend the loader finished these fighters. */
  const load = (...ids: CharacterId[]) => {
    for (const id of ids) for (const n of [0, 1]) textures.add(`${id}-${n}`);
    loading.settled();
  };
  return { loading, built, load, textures };
}

it("needs each fighter in the room once", () => {
  expect(
    neededFighters([
      { character: "voltkit" },
      { character: "tidefin" },
      { character: "voltkit" },
    ]),
  ).toEqual(["voltkit", "tidefin"]);
});

it("builds and requests only the fighters asked for, once each", () => {
  const { loading, built, load } = setup();
  expect(loading.toRequest(["voltkit", "tidefin"])).toEqual([
    "voltkit",
    "tidefin",
  ]);
  // Already on the way: not queued twice.
  expect(loading.toRequest(["voltkit", "tidefin"])).toEqual([]);
  expect(loading.allReady(["voltkit", "tidefin"])).toBe(false);
  load("voltkit", "tidefin");
  expect(loading.allReady(["voltkit", "tidefin"])).toBe(true);
  expect(loading.toRequest(["voltkit", "tidefin"])).toEqual([]);
  // Nobody else's art was built.
  expect(built.sort()).toEqual(["tidefin", "voltkit"]);
});

it("loads a fighter that turns up later (Fighter roulette)", () => {
  const { loading, load } = setup();
  loading.toRequest(["voltkit", "tidefin"]);
  load("voltkit", "tidefin");
  expect(loading.allReady(["cindrake", "tidefin"])).toBe(false);
  expect(loading.toRequest(["cindrake", "tidefin"])).toEqual(["cindrake"]);
  load("cindrake");
  expect(loading.allReady(["cindrake", "tidefin"])).toBe(true);
});

it("retries art that failed to load, then stops holding the battle", () => {
  const { loading } = setup();
  for (let attempt = 1; attempt <= 3; attempt++) {
    expect(loading.toRequest(["voltkit"])).toEqual(["voltkit"]);
    // The load finished without the texture (a failed file).
    expect(loading.isReady("voltkit")).toBe(false);
    loading.settled();
  }
  // Three failed loads: draw without it rather than freeze the battle.
  expect(loading.isReady("voltkit")).toBe(true);
  expect(loading.toRequest(["voltkit"])).toEqual([]);
});
