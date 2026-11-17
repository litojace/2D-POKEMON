/**
 * Every wave of a Spire wave floor must be beaten before the floor clears
 * (apps/server/src/spire.ts). The last wave once started inside the tick's
 * Echo count, so the floor read "nothing left" and cleared (the Blessing
 * cards came) while the last wave was still taking shape. The HUD's floor
 * bar (raid-hud.ts) jumped to full at the same moment.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { RULES, type CharacterId, type Snapshot } from "@arena/shared";
import { createSpireArena } from "../../apps/server/src/spire";
import {
  SPIRE_FLOORS,
  SPIRE_PARTY,
  spireWaves,
  spireZoneStart,
} from "../../packages/shared/src/spire";
import { spireFloorProgress } from "../../apps/client/src/spire-battle";
import { spireHudView } from "../../apps/client/src/raid-hud";

const DT = 1 / RULES.tick;
afterEach(() => vi.restoreAllMocks());
const seeded = (seed: number) => {
  let s = seed >>> 0;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((
    buffer: Uint32Array,
  ) => {
    for (let i = 0; i < buffer.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      buffer[i] = s;
    }
    return buffer;
  }) as never);
};

const CHARS: CharacterId[] = ["voltkit", "terradon", "voltkit"];
function climb(zone: number, floor: number, party: number) {
  const a = createSpireArena(`WAVES${zone}${floor}${party}`, zone);
  for (let i = 0; i < party; i++) a.add("p" + i, "P" + i, CHARS[i]);
  a.configureSpire({ startFloor: floor, ceiling: floor });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  for (let i = 0; i < 600 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
  return a;
}
const view = (a: ReturnType<typeof climb>) =>
  ({ ...a.snapshot(), raid: a.raid }) as unknown as Snapshot;

/** The wave floors of zones 1–5. */
const WAVE_FLOORS = Object.keys(SPIRE_FLOORS)
  .map(Number)
  .filter((f) => f <= 49 && SPIRE_FLOORS[f].kind === "wave");

describe("a Spire wave floor", () => {
  it("covers floors 1–9, 11–19, 21–29, 31–39 and 41–49", () => {
    const zones = new Set(WAVE_FLOORS.map((f) => Math.ceil(f / 10)));
    expect([...zones]).toEqual([1, 2, 3, 4, 5]);
    expect(WAVE_FLOORS.length).toBe(40);
  });

  for (const party of [1, SPIRE_PARTY.extraWaveFrom])
    it(`clears only when the last Echo of the last wave falls (party of ${party})`, () => {
      seeded(41 + party);
      for (const floor of WAVE_FLOORS) {
        const zone = Math.ceil(floor / 10);
        expect(spireZoneStart(zone)).toBeLessThanOrEqual(floor);
        const a = climb(zone, floor, party);
        const s = a.raid.spire!;
        const waves = spireWaves(floor, party);
        expect(s.waves, `floor ${floor}`).toBe(waves.length);
        const seen: string[] = [];
        const counted = new Set<string>();
        for (let w = 0; w < waves.length; w++) {
          // Wait for the wave to arrive (the gap after the last one).
          for (let i = 0; i < 400 && s.wave !== w + 1; i++) a.tick(DT);
          expect(s.wave, `floor ${floor} wave ${w + 1}`).toBe(w + 1);
          // Every Echo of the wave must step onto the court and fall.
          for (let i = 0; i < 4000; i++) {
            for (const p of a.heroes()) p.hp = 9999;
            for (const p of a.players)
              if (p.echo && p.hp > 0 && !counted.has(p.id)) {
                counted.add(p.id);
                seen.push(p.character);
              }
            expect(
              s.clearedAt,
              `floor ${floor} cleared during wave ${w + 1}/${waves.length}`,
            ).toBeUndefined();
            const pct = spireFloorProgress(view(a));
            expect(pct, `floor ${floor} bar full early`).toBeLessThan(100);
            if (seen.length === waves.slice(0, w + 1).flat().length) break;
            for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
            a.tick(DT);
          }
          expect(seen.length).toBe(waves.slice(0, w + 1).flat().length);
          // The wave's last Echo falls.
          for (const p of a.players) if (p.echo && p.hp > 0) p.hp = 0;
          a.tick(DT);
          if (w < waves.length - 1) {
            expect(s.clearedAt, `floor ${floor} after wave ${w + 1}`).toBe(
              undefined,
            );
            const pct = spireFloorProgress(view(a));
            expect(pct).toBeCloseTo(((w + 1) / waves.length) * 100, 5);
            // The gap, and the next wave coming, never clear the floor.
            for (let i = 0; i < (SPIRE_PARTY.waveGap + 0.2) / DT; i++) {
              a.tick(DT);
              expect(s.clearedAt, `floor ${floor} in the gap`).toBe(undefined);
            }
          }
        }
        expect(s.clearedAt, `floor ${floor} cleared`).toBeDefined();
        expect(seen).toEqual(waves.flat().map((e) => e.character));
        expect(spireFloorProgress(view(a))).toBe(100);
      }
    }, 120_000);

  it("labels its bar by wave and marks where each wave ends", () => {
    seeded(7);
    const a = climb(1, 3, 1);
    const s = a.raid.spire!;
    a.tick(DT);
    const v = spireHudView(view(a));
    expect(v.spire).toMatchObject({ bar: "floor", wave: 1, waves: s.waves });
    expect(v.spire!.label).toBe(`Wave 1/${s.waves}`);
  });
});
