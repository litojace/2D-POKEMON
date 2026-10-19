import { afterEach, expect, it, vi } from "vitest";
import { RaidArena } from "../../apps/server/src/raid";
import { renderRaidUI } from "../../apps/client/src/raid-ui";
afterEach(() => vi.unstubAllGlobals());
it("preserves raid choices during countdown and teammate picks, but redraws changed offers", () => {
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
  a.add("friend", "Friend");
  a.start();
  a.acknowledgeInstructions("hero");
  a.acknowledgeInstructions("friend");
  const render = (remaining: number) =>
    renderRaidUI({ ...a.snapshot(), remaining }, a.heroes()[0], async () => {});
  render(15);
  const initial = html;
  for (let seconds = 14; seconds >= 1; seconds--) render(seconds);
  expect(timer.textContent).toBe("1 second");
  expect(html).toBe(initial);
  expect(writes).toBe(1);
  expect(html).toContain("data-raid-rite");
  a.pickRite("friend", a.raid.offers.friend[0]);
  render(1);
  expect(writes).toBe(1);
  a.raid.offers.hero = [];
  render(1);
  expect(writes).toBe(2);
  expect(html).toContain("Rite locked in");
});

it.each(["finished", "briefing", "intermission"])(
  "leaves native scrolling untouched on repeated %s snapshots and restores it only after a redraw",
  (phase) => {
    let html = "",
      position = 0,
      scrollWrites = 0;
    const scroller = {
      get scrollTop() {
        return position;
      },
      set scrollTop(value: number) {
        position = value;
        scrollWrites++;
      },
      contains: () => false,
    };
    const card = { scrollTop: 0, contains: () => false };
    const overlay = {
      style: {},
      dataset: {},
      classList: { remove: () => {} },
      get innerHTML() {
        return html;
      },
      set innerHTML(value: string) {
        html = value;
        position = 0;
      },
      querySelector: (selector: string) =>
        !html
          ? null
          : selector === ".raid-overlay"
            ? card
            : selector === ".raid-briefing-body" && phase === "briefing"
              ? scroller
              : selector === ".panel-scroll" && phase !== "briefing"
                ? scroller
                : null,
      querySelectorAll: () => [],
    };
    const hud = { innerHTML: "" };
    vi.stubGlobal("document", {
      getElementById: (id: string) =>
        id === "raid-hud" ? hud : id === "arena-overlay" ? overlay : null,
    });
    const a = new RaidArena("SCROLL");
    a.add("hero", "Hero");
    a.start();
    if (phase === "finished") a.endRound(1);
    if (phase === "intermission") a.acknowledgeInstructions("hero");
    const render = () =>
      renderRaidUI(a.snapshot(), a.heroes()[0], async () => {});
    render();
    scrollWrites = 0;
    // Simulate the browser moving the native scroller during a touch gesture.
    for (let i = 1; i <= 10; i++) {
      position = i * 12;
      render();
    }
    expect(position).toBe(120);
    expect(scrollWrites).toBe(0);
    if (phase === "briefing") a.instructionsReady.push("hero");
    else if (phase === "intermission") a.raid.offers.hero = [];
    else a.heroes()[0].ready = !a.heroes()[0].ready;
    render();
    expect(position).toBe(120);
    expect(scrollWrites).toBe(1);
  },
);
