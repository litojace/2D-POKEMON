import { svgMarkup } from "../../apps/client/tests/svg-markup";
import { expect, it } from "vitest";
import {
  CHARACTERS,
  FIGHTER_IDS,
  characterSchema,
  normalizeCharacterId,
  COMBOS,
  ULT_SLOT,
  type CharacterId,
} from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import {
  creatureLayers,
  creatureSvg,
} from "../../apps/client/src/creature-design";
import { fighterPackSchema } from "../../apps/client/src/animation/asset-schema";
import { fighterSelection } from "../../apps/client/src/fighter-selection";
import { elementShapes } from "../../apps/client/src/element-effects";
import { readFileSync, existsSync } from "node:fs";
it("has eight fighters, forty unique moves and four special skills per fighter", () => {
  expect(Object.keys(CHARACTERS)).toEqual([...FIGHTER_IDS]);
  const abilities = Object.values(CHARACTERS).flatMap((c) => [
    c.basic,
    ...c.skills,
  ]);
  expect(new Set(abilities.map((a) => a.id)).size).toBe(40);
  for (const c of Object.values(CHARACTERS)) {
    expect(c.skills).toHaveLength(4);
    expect(c.health).toBeGreaterThan(0);
    expect(c.speed).toBeGreaterThan(0);
    expect(c.skills.some((a) => a.kind !== "projectile")).toBe(true);
    expect(characterSchema.parse(c.id)).toBe(c.id);
    expect(elementShapes).toHaveProperty(c.element.toLowerCase());
  }
  expect(new Set(Object.values(elementShapes)).size).toBe(
    Object.keys(elementShapes).length,
  );
});
it("increases roster health by 25% while preserving movement speeds", () => {
  const baseline: Record<string, [number, number]> = {
    voltkit: [138, 270],
    cindrake: [156, 240],
    tidefin: [131, 285],
    auralynx: [175, 235],
    lumoth: [144, 265],
    mystowl: [130, 255],
    terradon: [219, 222],
    duskveil: [150, 260],
  };
  for (const [id, stats] of Object.entries(baseline)) {
    const c = CHARACTERS[id as CharacterId];
    expect([c.health, c.speed]).toEqual(stats);
  }
});
it("migrates legacy identifiers without accepting arbitrary object properties", () => {
  for (const [old, id] of Object.entries({
    voltling: "voltkit",
    emberwing: "cindrake",
    aquashade: "tidefin",
    auralith: "auralynx",
    pikachu: "voltkit",
    charizard: "cindrake",
    greninja: "tidefin",
    lucario: "auralynx",
    eevee: "lumoth",
    mewtwo: "mystowl",
    snorlax: "terradon",
    gengar: "duskveil",
    thornback: "mystowl",
    frostfang: "terradon",
    duskveil: "duskveil",
  }))
    expect(characterSchema.parse(old)).toBe(id);
  for (const invalid of ["__proto__", "constructor", null, {}, "unknown"]) {
    expect(normalizeCharacterId(invalid)).toBeUndefined();
    expect(characterSchema.safeParse(invalid).success).toBe(false);
  }
});
it("loads original art and valid public metadata for every fighter and direction", () => {
  const art = new Set<string>();
  for (const id of FIGHTER_IDS) {
    const folder = `apps/client/public/assets/fighters/${id}/`;
    const metadata = fighterPackSchema.parse(
      JSON.parse(readFileSync(folder + "animations.json", "utf8")),
    );
    expect(existsSync(folder + metadata.portrait)).toBe(true);
    expect(existsSync(folder + metadata.selection)).toBe(true);
    for (const dir of ["up", "down", "left", "right"] as const) {
      const svg = creatureSvg(id, dir);
      expect(svg).toContain("radialGradient");
      expect(svgMarkup(svg)).not.toMatch(/undefined|NaN|scale\(-1/);
      expect(creatureLayers(id, dir).layers.eyes === "").toBe(dir === "up");
    }
    art.add(creatureSvg(id));
  }
  expect(art.size).toBe(8);
  expect(fighterSelection("voltkit").match(/data-character=/g)).toHaveLength(8);
  expect(
    fighterSelection("voltkit", "Earth").match(/data-character=/g),
  ).toHaveLength(1);
  const detail = fighterSelection("terradon");
  CHARACTERS.terradon.skills.forEach((a, i) => {
    expect(detail).toContain(a.name);
    // The ultimate charges from a meter instead of a cooldown.
    expect(detail).toContain(i === ULT_SLOT ? "ULT" : `${a.cooldown}s`);
  });
  expect(detail).toContain(COMBOS.terradon.text);
  expect(detail).toContain("600 ms between attacks");
  expect(detail).not.toContain("PLACEHOLDER");
  expect(fighterSelection("voltkit")).toContain("Overcharge");
});
it("validates frame, sheet and atlas imports, frame keys, rates and local paths", () => {
  const animations = Object.fromEntries(
    ["up", "down", "left", "right"].map((dir) => [
      `idle-${dir}`,
      { frames: ["idle"], fps: 12, loop: true },
    ]),
  );
  const common = {
    schemaVersion: 1,
    portrait: "portrait.png",
    selection: "selection.png",
    artStatus: "artist supplied",
    animations,
  };
  expect(
    fighterPackSchema.safeParse({
      ...common,
      kind: "frames",
      files: { idle: "idle.png" },
    }).success,
  ).toBe(true);
  expect(
    fighterPackSchema.safeParse({
      ...common,
      kind: "atlas",
      image: "sprites.png",
      data: "sprites.json",
    }).success,
  ).toBe(true);
  const sheetAnimations = Object.fromEntries(
    Object.entries(animations).map(([key, a]) => [
      key,
      { ...a, frames: [0, 1] },
    ]),
  );
  expect(
    fighterPackSchema.safeParse({
      ...common,
      kind: "sheet",
      image: "sheet.png",
      frameWidth: 128,
      frameHeight: 128,
      animations: sheetAnimations,
    }).success,
  ).toBe(true);
  expect(
    fighterPackSchema.safeParse({
      ...common,
      kind: "frames",
      files: { wrong: "idle.png" },
    }).success,
  ).toBe(false);
  expect(
    fighterPackSchema.safeParse({
      ...common,
      kind: "atlas",
      image: "../bad.png",
      data: "sprites.json",
    }).success,
  ).toBe(false);
  expect(
    fighterPackSchema.safeParse({
      ...common,
      kind: "atlas",
      image: "sprites.png",
      data: "sprites.json",
      animations: { "idle-down": { frames: ["idle"], fps: 0 } },
    }).success,
  ).toBe(false);
});
const duel = (character: CharacterId) => {
  const a = new Arena("TEST");
  a.add("one", "One", character);
  a.add("two", "Two");
  a.start();
  a.phase = "playing";
  a.deadline = 180;
  a.players[0].x = 400;
  a.players[0].y = 200;
  a.players[1].x = 480;
  a.players[1].y = 200;
  a.players[0].angle = 0;
  return a;
};
it("applies counter, barrier and grounded area counterplay on the server", () => {
  const guard = duel("auralynx"),
    p = guard.players[0];
  guard.cast(p, CHARACTERS.auralynx.skills[2]);
  guard.damage(p, 20, "two");
  expect(p.hp).toBe(CHARACTERS.auralynx.health - 10);
  expect(guard.players[1].hp).toBe(CHARACTERS.voltkit.health - 6);
  const shield = duel("mystowl"),
    m = shield.players[0];
  shield.cast(m, CHARACTERS.mystowl.skills[2]);
  shield.damage(m, 20, "two");
  // Ward lets 40% of the hit through.
  expect(m.hp).toBe(CHARACTERS.mystowl.health - 20 * 0.4);
  expect(shield.players[1].hp).toBe(CHARACTERS.voltkit.health);
  const field = duel("voltkit"),
    q = field.players[1];
  q.jumpUntil = field.time + 1;
  const hp = q.hp;
  field.damage(q, 10, "one", CHARACTERS.voltkit.skills[2]);
  expect(q.hp).toBe(hp);
});
