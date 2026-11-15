import { beforeEach, describe, expect, it } from "vitest";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import {
  paintRaidHud,
  raidHudView,
  resetRaidHud,
} from "../../apps/client/src/raid-hud";
import { resetHealthTrails } from "../../apps/client/src/raid-health-trail";
import type { RaidBossId } from "../../packages/shared/src/raid";

/** A HUD part that counts every write the HUD makes to it. */
class Part {
  writes = 0;
  attrs = new Map<string, string>();
  classes = new Set<string>();
  #text = "";
  #width = "";
  constructor(readonly dataset: Record<string, string>) {}
  get textContent() {
    return this.#text;
  }
  set textContent(v: string) {
    this.#text = v;
    this.writes++;
  }
  style = (() => {
    const part = this;
    return {
      get width() {
        return part.#width;
      },
      set width(v: string) {
        part.#width = v;
        part.writes++;
      },
    };
  })();
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
    this.writes++;
  }
  classList = {
    toggle: (name: string, on: boolean) => {
      if (on) this.classes.add(name);
      else this.classes.delete(name);
      this.writes++;
    },
  };
}
/** The HUD element: building it parses the parts out of the markup. */
function fakeHud() {
  let html = "";
  let parts: Part[] = [];
  const hud = {
    builds: 0,
    firstElementChild: null as object | null,
    get innerHTML() {
      return html;
    },
    set innerHTML(value: string) {
      html = value;
      hud.builds++;
      hud.firstElementChild = {};
      parts = [...value.matchAll(/data-hud="([^"]+)"/g)].map(
        (m) => new Part({ hud: m[1] }),
      );
    },
    querySelectorAll: () => parts,
    part: (name: string) => parts.find((p) => p.dataset.hud === name)!,
    writes: () => parts.reduce((sum, p) => sum + p.writes, 0),
  };
  return hud;
}
const arena = (boss: RaidBossId) => {
  const a = createRaidArena("HUD", boss);
  a.add("p0", "Raider", "cindrake");
  a.start();
  a.phase = "playing";
  a.raid.gilded = false;
  return a;
};
const paint = (hud: ReturnType<typeof fakeHud>, a: ReturnType<typeof arena>) =>
  paintRaidHud(
    hud as unknown as HTMLElement,
    raidHudView(a.snapshot(), a.heroes()[0]),
  );

describe("raid boss HUD", () => {
  beforeEach(() => {
    resetRaidHud();
    resetHealthTrails();
  });

  it("builds once, then writes only what changed between snapshots", () => {
    const hud = fakeHud(),
      a = arena("grumblecrag");
    expect(paint(hud, a)).toBe(true);
    expect(hud.part("title").textContent).toBe("CRAGMUFF");
    expect(hud.part("phase").textContent).toBe("Phase 1/3");
    expect(hud.part("phase").attrs.get("aria-label")).toBe("Phase 1 of 3");
    expect(hud.part("fill").style.width).toBe("100%");
    expect(hud.part("pct").textContent).toBe("100%");
    expect(hud.part("cue").textContent).not.toBe("");
    expect(hud.part("cue").attrs.get("title")).toBe(
      hud.part("cue").textContent,
    );
    expect(hud.innerHTML).toContain('role="status"');
    expect(hud.innerHTML).toContain('role="progressbar"');
    expect(hud.innerHTML).not.toMatch(/class="raid-stagger" hidden/);
    // The same snapshot again: no DOM writes at all.
    const before = hud.writes();
    for (let i = 0; i < 20; i++) expect(paint(hud, a)).toBe(false);
    expect(hud.writes()).toBe(before);
    expect(hud.builds).toBe(1);

    // A hit: the bar, its number and the progressbar value move; the
    // heading, phase and callout element are the same ones as before.
    const cue = hud.part("cue");
    const boss = a.players.find((p) => p.id === a.raid.bossId)!;
    boss.hp = a.raid.maxHp * 0.5;
    const title = hud.part("title").writes;
    paint(hud, a);
    expect(hud.builds).toBe(1);
    expect(hud.part("cue")).toBe(cue);
    expect(hud.part("title").writes).toBe(title);
    expect(hud.part("fill").style.width).toBe("50%");
    expect(hud.part("pct").textContent).toBe("50%");
    expect(hud.part("health").attrs.get("aria-valuenow")).toBe("50");
    expect(hud.part("health").attrs.get("aria-valuetext")).toBe(
      "50% health. Rite choices open at 67% and 33% health.",
    );
    // The damage trail holds above the bar for a moment.
    expect(parseFloat(hud.part("trail").style.width)).toBeGreaterThan(50);
  });

  it("marks passed phase thresholds and shows exposed and gilded states", () => {
    const hud = fakeHud(),
      a = arena("grumblecrag");
    paint(hud, a);
    expect(hud.part("mark0").classes.has("is-passed")).toBe(false);
    a.raid.phase = 3;
    a.raid.staggerUntil = a.time + 5;
    a.raid.gilded = true;
    paint(hud, a);
    expect(hud.builds).toBe(1);
    expect(hud.part("mark0").classes.has("is-passed")).toBe(true);
    expect(hud.part("mark1").classes.has("is-passed")).toBe(true);
    expect(hud.part("title").textContent).toBe(
      "✦ GILDED CRAGMUFF · EXPOSED",
    );
    expect(hud.part("stagger").style.width).toBe("100%");
    expect(hud.part("stagger-label").textContent).toBe(
      "STAGGER · CORE EXPOSED",
    );
  });

  it("rebuilds for a new boss, the Storm Twins' bars, and after other code replaced it", () => {
    const hud = fakeHud();
    paint(hud, arena("grumblecrag"));
    const twins = arena("storm-twins");
    expect(paint(hud, twins)).toBe(true);
    expect(hud.builds).toBe(2);
    expect(hud.innerHTML).toMatch(/class="raid-stagger" hidden/);
    expect(hud.innerHTML).toContain("Fizz health");
    expect(hud.innerHTML).toContain("Crackle health");
    expect(hud.part("t0-fill").style.width).toBe("100%");
    expect(hud.part("t1-track").attrs.get("aria-valuenow")).toBe("100");
    // A twin goes down: its bar shows the revive countdown in place.
    const second = twins.players.find((p) => p.id === twins.raid.twins![1].id)!;
    second.hp = 0;
    expect(paint(hud, twins)).toBe(false);
    expect(hud.part("t1-status").textContent).toMatch(/^REVIVES IN \d+s$/);
    expect(hud.part("t1-fill").style.width).toBe("0%");
    // Retry against the same boss keeps the structure.
    expect(paint(hud, arena("storm-twins"))).toBe(false);
    // Something else replaced the insides: the next snapshot rebuilds.
    hud.firstElementChild = {};
    expect(paint(hud, twins)).toBe(true);
    // A different element (a fresh battle screen) is built from scratch.
    const other = fakeHud();
    expect(paint(other, twins)).toBe(true);
  });

  it("escapes twin names in the markup it builds", () => {
    const hud = fakeHud(),
      a = arena("storm-twins");
    a.raid.twins![0].name = '<img src=x onerror="x">';
    paint(hud, a);
    expect(hud.innerHTML).not.toContain("<img");
    expect(hud.innerHTML).toContain("&lt;img");
  });
});
