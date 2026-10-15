import { afterEach, expect, it, vi } from "vitest";
import { RaidArena } from "../../apps/server/src/raid";
import { renderRaidUI } from "../../apps/client/src/raid-ui";
afterEach(() => vi.unstubAllGlobals());
it("updates countdown text without replacing raid choices, but redraws changed offers", () => {
  let writes = 0,
    html = "";
  const timer = { textContent: "" };
  const overlay = {
    style: {},
    dataset: {},
    classList: { remove: () => {} },
    get innerHTML() {
      return html;
    },
    set innerHTML(value: string) {
      html = value;
      writes++;
    },
    querySelector: () => null,
    querySelectorAll: (selector: string) =>
      selector === ".live-seconds" ? [timer] : [],
  };
  const hud = { innerHTML: "" };
  vi.stubGlobal("document", {
    getElementById: (id: string) =>
      id === "raid-hud" ? hud : id === "arena-overlay" ? overlay : null,
  });
  const a = new RaidArena("TEST");
  a.add("hero", "Hero");
  a.start();
  a.acknowledgeInstructions("hero");
  const render = (remaining: number) =>
    renderRaidUI({ ...a.snapshot(), remaining }, a.heroes()[0], async () => {});
  render(15);
  const initial = html;
  for (let seconds = 14; seconds >= 1; seconds--) render(seconds);
  expect(timer.textContent).toBe("1 second");
  expect(html).toBe(initial);
  expect(writes).toBe(1);
  expect(html).toContain("data-raid-rite");
  a.raid.offers.hero = [];
  render(1);
  expect(writes).toBe(2);
  expect(html).toContain("Rite locked in");
});
