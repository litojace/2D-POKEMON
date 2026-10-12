import { expect, it } from "vitest";
import {
  CHARACTERS,
  FIGHTER_IDS,
  characterSchema,
  normalizeCharacterId,
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
it("has eight original fighters, forty unique abilities and four skills per fighter", () => {
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
  }
  expect(new Set(Object.values(elementShapes)).size).toBe(8);
});
it("preserves the original four health, speed, basic attack, damage and cooldown mappings", () => {
  const baseline: Record<
    string,
    {
      hp: number;
      speed: number;
      basic: number;
      skills: number[];
      cooldowns: number[];
    }
  > = {
    voltkit: {
      hp: 110,
      speed: 270,
      basic: 8,
      skills: [18, 23, 4, 10],
      cooldowns: [4, 7, 10, 30],
    },
    cindrake: {
      hp: 125,
      speed: 240,
      basic: 9,
      skills: [18, 6, 22, 9],
      cooldowns: [5, 8, 10, 30],
    },
    tidefin: {
      hp: 105,
      speed: 285,
      basic: 7,
      skills: [18, 0, 0, 12],
      cooldowns: [4, 8, 12, 30],
    },
    auralynx: {
      hp: 140,
      speed: 235,
      basic: 12,
      skills: [20, 28, 0, 45],
      cooldowns: [5, 7, 12, 30],
    },
  };
  for (const [id, b] of Object.entries(baseline)) {
    const c = CHARACTERS[id as CharacterId];
    expect([c.health, c.speed, c.basic.damage]).toEqual([
      b.hp,
      b.speed,
      b.basic,
    ]);
    expect(c.skills.map((a) => a.damage)).toEqual(b.skills);
    expect(c.skills.map((a) => a.cooldown)).toEqual(b.cooldowns);
  }
});
it("migrates legacy identifiers without accepting arbitrary object properties", () => {
  for (const [old, id] of Object.entries({
    voltling: "voltkit",
    emberwing: "cindrake",
    aquashade: "tidefin",
    auralith: "auralynx",
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
      expect(svg).not.toMatch(/undefined|NaN|scale\(-1/);
      expect(creatureLayers(id, dir).layers.eyes === "").toBe(dir === "up");
    }
    art.add(creatureSvg(id));
  }
  expect(art.size).toBe(8);
  expect(fighterSelection("voltkit").match(/data-character=/g)).toHaveLength(8);
  expect(
    fighterSelection("voltkit", "Ice").match(/data-character=/g),
  ).toHaveLength(1);
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
it("authoritatively reveals shadow concealment on attacking, damage and expiry", () => {
  const a = duel("duskveil"),
    p = a.players[0],
    c = CHARACTERS.duskveil;
  a.cast(p, c.skills[1]);
  expect(p.statuses.some((s) => s.kind === "stealth")).toBe(true);
  a.cast(p, c.basic);
  expect(p.statuses.some((s) => s.kind === "stealth")).toBe(false);
  a.cast(p, c.skills[1]);
  a.damage(p, 7, "two");
  expect(p.statuses.some((s) => s.kind === "stealth")).toBe(false);
  a.cast(p, c.skills[1]);
  for (let i = 0; i < 65; i++) a.tick();
  expect(p.statuses.some((s) => s.kind === "stealth")).toBe(false);
});
it("applies new defensive guard, freeze, rush and grounded area counterplay on the server", () => {
  const guard = duel("thornback"),
    p = guard.players[0];
  guard.cast(p, CHARACTERS.thornback.skills[1]);
  guard.damage(p, 20, "two");
  expect(p.hp).toBe(175);
  expect(guard.players[1].hp).toBe(104);
  const ice = duel("frostfang"),
    q = ice.players[1];
  ice.damage(q, 16, "one", CHARACTERS.frostfang.skills[0]);
  expect(q.statuses.some((s) => s.kind === "freeze")).toBe(true);
  const earth = duel("terradon");
  earth.cast(earth.players[0], CHARACTERS.terradon.skills[2]);
  expect(earth.players[0].rush?.damage).toBe(20);
  q.jumpUntil = ice.time + 1;
  const hp = q.hp;
  ice.damage(q, 10, "one", CHARACTERS.terradon.skills[3]);
  expect(q.hp).toBe(hp);
});
