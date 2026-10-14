import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "@arena/shared";
import {
  fighterArt,
  fighterAvatar,
  scopeIds,
} from "../../apps/client/src/fighter-art";
import { withAura } from "../../apps/client/src/trait-effects";
import { fighterSelection } from "../../apps/client/src/fighter-selection";

const ids = (svg: string) =>
  [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const refs = (svg: string) => [
  ...[...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]),
  ...[...svg.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]),
];

describe("inline art ids", () => {
  it("scopes every id and keeps every reference pointing inside the same svg", () => {
    for (const id of FIGHTER_IDS) {
      const svg = scopeIds(withAura(fighterArt(id), id), "vs0");
      const own = new Set(ids(svg));
      expect(own.size).toBeGreaterThan(0);
      for (const name of own) expect(name.endsWith("-vs0"), name).toBe(true);
      for (const ref of refs(svg))
        expect(own.has(ref), `${id}: ${ref}`).toBe(true);
    }
  });
  it("is stable, so re-rendered markup compares equal", () => {
    expect(scopeIds(fighterArt("cindrake"), "a")).toBe(
      scopeIds(fighterArt("cindrake"), "a"),
    );
  });
  it("never shares an id between two placements of the same fighter", () => {
    // The hidden fighter-select screen and the briefing both show Cindrake.
    const page =
      fighterSelection("cindrake") +
      scopeIds(withAura(fighterArt("cindrake"), "cindrake"), "vs0") +
      scopeIds(withAura(fighterArt("cindrake"), "cindrake"), "vs1") +
      fighterAvatar("cindrake", "lobby0") +
      fighterAvatar("cindrake", "lobby1");
    const all = ids(page);
    expect(new Set(all).size).toBe(all.length);
  });
});
