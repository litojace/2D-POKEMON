import { describe, expect, it } from "vitest";
import { CHARACTERS, type GameEvent } from "@arena/shared";
import {
  isNoise,
  sfxLength,
  SFX_MAX_GAIN,
  SFX_MAX_LAYERS,
  SFX_MAX_SECONDS,
  type SfxRecipe,
} from "../../apps/client/src/sfx";
import {
  castRecipe,
  castRecipeOf,
  championVoice,
  CUES,
  ELEMENT_PALETTES,
  hitRecipe,
  KIND_GESTURES,
  skillSound,
} from "../../apps/client/src/sfx-recipes";
import { eventSound, OTHERS_VOLUME } from "../../apps/client/src/battle-sounds";

/** A recipe Web Audio can play: short, few layers, audible pitches. */
function playable(recipe: SfxRecipe, name: string) {
  expect(recipe.layers.length, name).toBeGreaterThan(0);
  expect(recipe.layers.length, name).toBeLessThanOrEqual(SFX_MAX_LAYERS);
  expect(sfxLength(recipe), name).toBeLessThanOrEqual(SFX_MAX_SECONDS);
  expect(recipe.gain ?? 1, name).toBeGreaterThan(0);
  expect(recipe.gain ?? 1, name).toBeLessThanOrEqual(SFX_MAX_GAIN);
  for (const layer of recipe.layers) {
    expect(layer.length, name).toBeGreaterThan(0.01);
    expect(layer.level, name).toBeGreaterThan(0);
    expect(layer.level, name).toBeLessThanOrEqual(1);
    expect((layer.attack ?? 0.004) < layer.length, name).toBe(true);
    const hz = isNoise(layer)
      ? [layer.filter.from, layer.filter.to]
      : [layer.from, layer.to, ...(layer.filter ? [layer.filter.from] : [])];
    for (const f of hz) {
      expect(Number.isFinite(f), name).toBe(true);
      expect(f, name).toBeGreaterThanOrEqual(20);
      expect(f, name).toBeLessThan(18000);
    }
  }
}
const kits = Object.values(CHARACTERS);
const event = (e: Partial<GameEvent>): GameEvent => ({
  id: 1,
  kind: "cast",
  x: 800,
  y: 450,
  color: 0,
  ...e,
});

describe("skill sounds come from the shared data", () => {
  it("gives every champion's every skill a playable cast", () => {
    for (const c of kits)
      for (const a of [c.basic, ...c.skills]) {
        const recipe = castRecipeOf(a.id);
        expect(recipe, a.id).toBeDefined();
        playable(recipe!, a.id);
      }
  });
  it("has a palette for every element and a gesture for every kind in play", () => {
    for (const c of kits)
      for (const a of [c.basic, ...c.skills]) {
        expect(ELEMENT_PALETTES[a.element], a.element).toBeDefined();
        expect(KIND_GESTURES[a.kind], a.kind).toBeDefined();
      }
  });
  it("sounds different for each element and each gesture", () => {
    const shots = Object.keys(ELEMENT_PALETTES).map((element) =>
      JSON.stringify(castRecipe({ element, kind: "projectile" }, "skill")),
    );
    expect(new Set(shots).size).toBe(shots.length);
    const gestures = (
      [
        "projectile",
        "barrage",
        "melee",
        "beam",
        "zone",
        "blink",
        "buff",
      ] as const
    ).map((kind) =>
      JSON.stringify(castRecipe({ element: "Fire", kind }, "skill")),
    );
    expect(new Set(gestures).size).toBe(gestures.length);
  });
  it("keeps basics small and makes ultimates the biggest", () => {
    for (const c of kits) {
      const basic = castRecipeOf(c.basic.id)!,
        ult = castRecipeOf(c.skills[3].id)!;
      const peak = (r: SfxRecipe) => Math.max(...r.layers.map((l) => l.level));
      expect(sfxLength(ult), c.id).toBeGreaterThan(sfxLength(basic));
      expect(peak(basic), c.id).toBeLessThan(peak(ult));
      expect(skillSound(c.skills[3].id)?.slot).toBe("ultimate");
      expect(skillSound(c.basic.id)?.slot).toBe("basic");
    }
  });
  it("gives sturdier champions a lower voice", () => {
    expect(championVoice(CHARACTERS.terradon)).toBeLessThan(1);
    expect(championVoice(CHARACTERS.voltkit)).toBeGreaterThan(1);
    expect(championVoice(CHARACTERS.terradon)).toBeLessThan(
      championVoice(CHARACTERS.voltkit),
    );
  });
  it("sounds a new element like Aura rather than not at all", () => {
    playable(
      castRecipe({ element: "Cosmic", kind: "projectile" }, "skill"),
      "new",
    );
  });
});

describe("hits", () => {
  const thump = (r: SfxRecipe) =>
    r.layers.find((l) => !isNoise(l) && l.tone === "sine")!;
  it("are playable for every outcome", () => {
    for (const role of ["dealt", "taken", "other"] as const)
      for (const damage of [0, 3, 8, 20, 60])
        for (const extra of [
          {},
          { ko: true },
          { combo: true },
          { ambush: true },
        ])
          playable(
            hitRecipe({ role, damage, element: "Water", ...extra }),
            `${role} ${damage} ${JSON.stringify(extra)}`,
          );
    playable(hitRecipe({ role: "dealt", damage: 0, miss: true }), "miss");
  });
  it("tell yours from the ones you take, and grow with the damage", () => {
    const dealt = hitRecipe({ role: "dealt", damage: 12 }),
      taken = hitRecipe({ role: "taken", damage: 12 });
    expect(dealt.layers.length).toBeGreaterThan(taken.layers.length);
    expect(thump(taken).from).toBeLessThan(thump(dealt).from);
    const small = hitRecipe({ role: "other", damage: 6 }),
      big = hitRecipe({ role: "other", damage: 30 });
    expect(thump(big).level).toBeGreaterThan(thump(small).level);
    expect(sfxLength(big)).toBeGreaterThan(sfxLength(small));
  });
  it("make a knockout land and keep burn ticks tiny", () => {
    const ko = hitRecipe({ role: "dealt", damage: 12, ko: true });
    expect(sfxLength(ko)).toBeGreaterThan(0.5);
    const tick = hitRecipe({ role: "taken", damage: 2 });
    expect(sfxLength(tick)).toBeLessThan(0.06);
    const miss = hitRecipe({ role: "dealt", damage: 0, miss: true });
    expect(miss.layers.every(isNoise)).toBe(true);
  });
});

it("gives every cue a playable sound", () => {
  for (const [id, recipe] of Object.entries(CUES)) playable(recipe, id);
  // Buttons click on every tap: theirs is the shortest sound of all.
  expect(sfxLength(CUES.ui)).toBeLessThan(0.05);
});

describe("which battle events sound, for whom", () => {
  const ability = CHARACTERS.voltkit.skills[0].id;
  it("plays your cast once: on the press, not again on the server's echo", () => {
    const cast = event({ kind: "cast", owner: "me", abilityId: ability });
    expect(eventSound(cast, { me: "me", echo: true })).toBeNull();
    const call = eventSound(cast, { me: "me", echo: false })!;
    expect(call.priority).toBe(2);
    expect(call.volume).toBe(1);
  });
  it("plays others' casts quieter, from their side, and drops them first", () => {
    const right = eventSound(
      event({ kind: "cast", owner: "rival", abilityId: ability, x: 1200 }),
      { me: "me", x: 600, y: 450 },
    )!;
    const left = eventSound(
      event({ kind: "cast", owner: "rival", abilityId: ability, x: 200 }),
      { me: "me", x: 600, y: 450 },
    )!;
    expect(right.priority).toBe(1);
    expect(right.volume).toBeLessThanOrEqual(OTHERS_VOLUME);
    expect(right.pan).toBeGreaterThan(0);
    expect(left.pan).toBeLessThan(0);
    // A cast and the beam it fires share a key, so the beam doesn't double it.
    const beam = eventSound(
      event({ kind: "beam", owner: "rival", abilityId: ability }),
      { me: "me" },
    )!;
    expect(beam.key).toBe(right.key);
    expect(beam.gap).toBeGreaterThan(right.gap);
  });
  it("always plays hits you take or deal, and knockouts", () => {
    const hit = (target: string, source: string, ko = false) =>
      eventSound(
        event({
          kind: "hit",
          target,
          source,
          value: 10,
          ko,
          abilityId: ability,
        }),
        { me: "me" },
      )!;
    expect(hit("me", "rival").priority).toBe(2);
    expect(hit("rival", "me").priority).toBe(2);
    expect(hit("a", "b").priority).toBe(1);
    expect(hit("a", "b", true).priority).toBe(2);
    expect(hit("a", "b").volume).toBeLessThan(1);
  });
  it("rate-limits burn ticks per target", () => {
    const tick = eventSound(
      event({ kind: "hit", target: "me", source: "rival", value: 2 }),
      { me: "me" },
    )!;
    expect(tick.key).toBe("hit:me:chip");
    expect(tick.gap).toBeGreaterThanOrEqual(0.1);
  });
  it("names each hazard's own sound and stays quiet for impacts", () => {
    for (const id of ["hazard-vent", "hazard-pool", "hazard-wall"] as const)
      expect(
        eventSound(event({ kind: "hazard", abilityId: id }), { me: "me" })!
          .recipe,
      ).toBe(CUES[id]);
    expect(
      eventSound(event({ kind: "impact", owner: "me" }), { me: "me" }),
    ).toBeNull();
    expect(
      eventSound(event({ kind: "raid-impact", owner: "me" }), { me: "me" }),
    ).toBeNull();
  });
  it("plays your own moves and pickups, not everyone's", () => {
    for (const kind of ["dash", "jump", "land", "heal", "burst"] as const) {
      expect(
        eventSound(event({ kind, owner: "me", abilityId: ability }), {
          me: "me",
        }),
        kind,
      ).not.toBeNull();
      expect(
        eventSound(event({ kind, owner: "rival", abilityId: ability }), {
          me: "me",
        }),
        kind,
      ).toBeNull();
    }
    expect(eventSound(event({ kind: "round" }), { me: "me" })?.recipe).toBe(
      CUES.round,
    );
  });
});
