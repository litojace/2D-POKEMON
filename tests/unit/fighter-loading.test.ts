import { describe, expect, it } from "vitest";
import {
  FighterLoading,
  neededFighters,
  neededLooks,
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

it("never claims art it doesn't have: a fighter that gave up is drawn as a stand-in", () => {
  const { loading } = setup();
  for (let attempt = 1; attempt <= 3; attempt++) {
    loading.toRequest(["voltkit"]);
    expect(loading.gaveUp("voltkit")).toBe(false);
    loading.settled();
  }
  // The battle may go on (briefing, first frame), but no rig is built.
  expect(loading.isReady("voltkit")).toBe(true);
  expect(loading.gaveUp("voltkit")).toBe(true);
  expect(loading.hasArt("voltkit")).toBe(false);
});

it("keeps a request open until some load settles, whoever started that load", () => {
  const { loading, textures } = setup();
  expect(loading.toRequest(["voltkit"])).toEqual(["voltkit"]);
  // The files joined a load another feature started (a skin, boss art) and
  // one of them failed: until that load's COMPLETE settles, nothing is
  // queued twice, and the fighter is not ready.
  textures.add("voltkit-0");
  expect(loading.toRequest(["voltkit"])).toEqual([]);
  expect(loading.isReady("voltkit")).toBe(false);
  expect(loading.hasArt("voltkit")).toBe(false);
  // Any COMPLETE settles it (the scene listens to every one): it is retried.
  loading.settled();
  expect(loading.toRequest(["voltkit"])).toEqual(["voltkit"]);
  textures.add("voltkit-1");
  loading.settled();
  expect(loading.hasArt("voltkit")).toBe(true);
  expect(loading.isReady("voltkit")).toBe(true);
  expect(loading.gaveUp("voltkit")).toBe(false);
});

it("a fighter added while another loads is requested on its own and settles with that load", () => {
  const { loading, load } = setup();
  expect(loading.toRequest(["voltkit"])).toEqual(["voltkit"]);
  // Fighter roulette mid-load: the new fighter joins the running load.
  expect(loading.toRequest(["voltkit", "tidefin"])).toEqual(["tidefin"]);
  load("voltkit", "tidefin");
  expect(loading.allReady(["voltkit", "tidefin"])).toBe(true);
  expect(loading.hasArt("tidefin")).toBe(true);
});

it("art that arrives after giving up is used", () => {
  const { loading, textures } = setup();
  for (let attempt = 1; attempt <= 3; attempt++) {
    loading.toRequest(["voltkit"]);
    loading.settled();
  }
  expect(loading.gaveUp("voltkit")).toBe(true);
  // Loaded meanwhile by something else (the textures are shared).
  textures.add("voltkit-0");
  textures.add("voltkit-1");
  expect(loading.hasArt("voltkit")).toBe(true);
  expect(loading.gaveUp("voltkit")).toBe(false);
});

describe("the looks a battle loads", () => {
  // Like assets.ts skinSuffix: "" for the champion's own look.
  const suffix = (_c: CharacterId, look: { skin: string } | null) =>
    look?.skin.startsWith("no-art") ? "" : look ? `~${look.skin}` : "";
  const names = (
    fighters: { character: CharacterId; look: { skin: string } | null }[],
  ) => [...neededLooks(fighters, suffix).keys()];

  it("loads a fighter in a skin in that skin only, not its champion's own look as well", () => {
    expect(
      names([
        { character: "voltkit", look: { skin: "voltkit-wayfarer" } },
        { character: "tidefin", look: null },
      ]),
    ).toEqual(["voltkit~voltkit-wayfarer", "tidefin"]);
  });

  it("loads the champion's own look for whoever shows it (a mirror match, a Spire Echo)", () => {
    expect(
      names([
        { character: "voltkit", look: { skin: "voltkit-wayfarer" } },
        { character: "voltkit", look: null },
        { character: "voltkit", look: { skin: "voltkit-moonlit-tea" } },
        { character: "voltkit", look: { skin: "voltkit-wayfarer" } },
      ]),
    ).toEqual([
      "voltkit~voltkit-wayfarer",
      "voltkit",
      "voltkit~voltkit-moonlit-tea",
    ]);
  });

  it("treats a skin that draws nothing of its own as the champion's look", () => {
    const looks = neededLooks(
      [{ character: "voltkit", look: { skin: "no-art" } }],
      suffix,
    );
    expect([...looks]).toEqual([
      ["voltkit", { character: "voltkit", look: null }],
    ]);
  });

  it("keys the loader by look", () => {
    const textures = new Set<string>();
    const loading = new FighterLoading<string>({
      build: (name) => [{ key: `rig-${name}` } as RigAsset],
      keys: (_name, layers) => layers.map((a) => a.key),
      exists: (key) => textures.has(key),
    });
    expect(loading.toRequest(["voltkit~voltkit-wayfarer", "tidefin"])).toEqual([
      "voltkit~voltkit-wayfarer",
      "tidefin",
    ]);
    textures.add("rig-voltkit~voltkit-wayfarer");
    loading.settled();
    expect(loading.isReady("voltkit~voltkit-wayfarer")).toBe(true);
    expect(loading.isReady("voltkit")).toBe(false);
  });
});
