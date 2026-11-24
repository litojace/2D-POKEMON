import { expect, it } from "vitest";
import { drawColorsFx, isColors } from "../../apps/client/src/skins/colors-fx";

const recorder = () => {
  const calls: string[] = [];
  const g = new Proxy(
    {},
    { get: (_t, name) => (..._a: unknown[]) => (calls.push(String(name)), g) },
  ) as never;
  return { g, calls };
};
const run = (id: string) => {
  const front = recorder(),
    under = recorder();
  const emitted: string[] = [];
  const known = drawColorsFx(
    {
      g: front.g,
      under: under.g,
      emit: (p) => emitted.push(p.shape),
      chance: () => true,
      x: 0,
      y: 0,
      sc: 1,
      now: 1234,
      dt: 0.033,
      moving: true,
    },
    id,
  );
  return { known, front: front.calls.length, under: under.calls.length, emitted };
};

it("knows every Colors set and ignores other items", () => {
  for (const id of ["candy-colours", "galaxy-colours", "retro-colours", "static-colors", "aurora-colors"])
    expect(isColors(id)).toBe(true);
  expect(isColors("galaxy-aura")).toBe(false);
  expect(run("galaxy-aura").known).toBe(false);
});

it("gives each set its own motif, and more effects at higher tiers", () => {
  expect(run("winter-colours").emitted).toContain("flake");
  expect(run("garden-colours").emitted).toContain("leaf");
  expect(run("retro-colours").emitted).toContain("pixel");
  // Common draws its motif only; Epic adds glints and a running trail;
  // Legendary adds a glow underfoot.
  const common = run("candy-colours"),
    epic = run("galaxy-colours"),
    legendary = run("thundercell");
  expect(common.front).toBe(0);
  expect(epic.front).toBeGreaterThan(0);
  expect(epic.emitted.length).toBeGreaterThan(common.emitted.length);
  expect(common.under + epic.under).toBe(0);
  expect(legendary.under).toBeGreaterThan(0);
});
