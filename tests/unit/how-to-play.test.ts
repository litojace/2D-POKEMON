import { describe, expect, it } from "vitest";
import { CHARACTERS, EX, RULES } from "@arena/shared";
import {
  HELP_TOPICS,
  controlRows,
  helpTopicMarkup,
  howToPlayMarkup,
  type HelpControls,
  type HelpState,
} from "../../apps/client/src/how-to-play";

// How to play (how-to-play.ts): topics of short cards, numbers from the rules.
const controls: HelpControls = {
  device: "keys",
  keys: {
    move: "WASD",
    basic: "LMB",
    skills: "1 2 3 4",
    dash: "SPACE",
    jump: "SHIFT",
  },
  pad: {
    move: "L-STICK",
    basic: "RT",
    skills: "X Y B LB",
    dash: "A",
    jump: "RB",
  },
  preview: false,
};
const state = (o: Partial<HelpState> = {}): HelpState => ({
  topic: "basics",
  device: "keys",
  canTour: true,
  canGo: true,
  ...o,
});

describe("How to play", () => {
  it("has the topics a player needs, each with a few short cards", () => {
    expect(HELP_TOPICS.map((t) => t.id)).toEqual([
      "basics",
      "battle",
      "controls",
      "modes",
      "progress",
      "social",
    ]);
    for (const t of HELP_TOPICS) {
      if (t.id === "controls") continue;
      expect(t.cards.length).toBeGreaterThanOrEqual(2);
      expect(t.cards.length).toBeLessThanOrEqual(8);
      for (const c of t.cards) {
        expect(c.icon || c.art).toBeTruthy();
        // One idea per card: a sentence or three.
        expect(c.text.length).toBeLessThanOrEqual(260);
      }
    }
  });

  it("takes its numbers from the game's rules", () => {
    const text = HELP_TOPICS.flatMap((t) => t.cards.map((c) => c.text)).join(
      " ",
    );
    expect(text).toContain(`first side to win ${RULES.roundsToWin} rounds`);
    expect(text).toContain(`${Object.keys(CHARACTERS).length} fighters`);
    expect(text).toContain(`(${EX.cost}% of the meter)`);
    expect(text).toContain(`heals ${Math.round(RULES.orbHeal * 100)}% health`);
  });

  it("shows the player's own keys, or the touch buttons on a phone", () => {
    const keys = controlRows("keys", controls).map(([k]) => k);
    expect(keys).toContain("WASD");
    expect(keys).toContain("1 2 3 4");
    const pad = controlRows("pad", controls).map(([k]) => k);
    expect(pad).toContain("RT");
    const touch = controlRows("touch", controls)
      .map(([, what]) => what)
      .join(" ");
    expect(touch).not.toContain("WASD");
    expect(touch).toMatch(/left half to move/);
    expect(
      controlRows("keys", { ...controls, preview: true }).some(([, w]) =>
        w.includes("hold to preview"),
      ),
    ).toBe(true);
  });

  it("opens on the chosen topic and device", () => {
    const html = howToPlayMarkup(
      state({ topic: "controls", device: "touch" }),
      controls,
    );
    expect(html).toContain(
      'aria-selected="true" tabindex="0" data-htp-topic="controls"',
    );
    expect(html).toContain('aria-pressed="true" data-htp-device="touch"');
    expect(html).toContain("Drag anywhere on the left half");
  });

  it("offers Go buttons and the tour replay only from the hub", () => {
    const hub = howToPlayMarkup(state({ topic: "modes" }), controls);
    expect(hub).toContain('data-htp-go="raids"');
    expect(hub).toContain("data-htp-tour");
    const room = howToPlayMarkup(
      state({ topic: "modes", canGo: false, canTour: false }),
      controls,
    );
    expect(room).not.toContain("data-htp-go");
    expect(room).not.toContain("data-htp-tour");
    // Changing keys works from a room too.
    expect(
      helpTopicMarkup(state({ topic: "controls", canGo: false }), controls),
    ).toContain('data-htp-go="controls"');
  });
});
