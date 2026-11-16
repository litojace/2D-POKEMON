import { afterEach, describe, expect, it } from "vitest";
import {
  GUIDE_NEW_LEVEL,
  GUIDE_STEPS,
  guideCard,
  guideMarkup,
  guideView,
  loadGuide,
  saveGuide,
  settleGuide,
  type GuideFacts,
} from "../../apps/client/src/getting-started";

// Getting started: a new player's first five steps on the Lobby.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
afterEach(() => store.clear());

const facts = (extra: Partial<GuideFacts> = {}): GuideFacts => ({
  level: 1,
  cragmuffClears: 0,
  wearing: false,
  ...extra,
});

describe("Getting started", () => {
  it("starts on its own for a new account, at the first step", () => {
    const v = guideView(settleGuide({ done: {} }, facts()));
    expect(v.active).toBe(true);
    expect(v.next).toBe("bot");
    expect(v.count).toBe(0);
    expect(GUIDE_STEPS.map((s) => s.id)).toEqual([
      "bot",
      "raid",
      "wear",
      "farm",
      "bistro",
    ]);
  });
  it("leaves an older account alone, and waits for the account to load", () => {
    expect(
      guideView(
        settleGuide({ done: {} }, facts({ level: GUIDE_NEW_LEVEL + 1 })),
      ).active,
    ).toBe(false);
    expect(
      guideView(settleGuide({ done: {} }, facts({ level: undefined }))).active,
    ).toBe(false);
  });
  it("keeps going once shown, even past the new-player level", () => {
    const shown = settleGuide({ done: {} }, facts());
    const later = settleGuide(shown, facts({ level: 12 }));
    expect(guideView(later).active).toBe(true);
  });
  it("takes a Cragmuff clear and something worn from the account, for good", () => {
    let save = settleGuide(
      { done: { bot: true } },
      facts({ cragmuffClears: 1, wearing: true }),
    );
    expect(guideView(save).next).toBe("farm");
    // Taking the item off later doesn't undo the step.
    save = settleGuide(save, facts({ cragmuffClears: 1, wearing: false }));
    expect(guideView(save).done.wear).toBe(true);
  });
  it("steps can be done in any order; the next is the first not done", () => {
    const v = guideView({ done: { farm: true, bot: true }, started: true });
    expect(v.next).toBe("raid");
    expect(v.count).toBe(2);
  });
  it("hides when asked, and ends when everything is done", () => {
    const hidden = { done: {}, started: true, hidden: true };
    expect(guideView(settleGuide(hidden, facts())).active).toBe(false);
    const all = {
      done: Object.fromEntries(GUIDE_STEPS.map((s) => [s.id, true])),
      started: true,
    };
    const v = guideView(all);
    expect(v.active).toBe(false);
    expect(v.next).toBeNull();
    // A finished account never starts it again on its own.
    expect(settleGuide({ done: all.done }, facts()).started).toBe(false);
  });
  it("is saved per account and survives a broken save", () => {
    saveGuide("a", { done: { bot: true }, started: true });
    expect(loadGuide("a")).toEqual({
      done: { bot: true },
      started: true,
      hidden: false,
    });
    expect(loadGuide("b")).toEqual({ done: {} });
    expect(loadGuide(undefined)).toEqual({ done: {} });
    store.set("arena-guide:c", "{not json");
    expect(loadGuide("c")).toEqual({ done: {} });
    store.set(
      "arena-guide:d",
      JSON.stringify({ done: { bot: true, hack: true, farm: "yes" } }),
    );
    expect(loadGuide("d").done).toEqual({ bot: true });
  });
  it("shows the next step on the card, and every step in the sheet", () => {
    const v = guideView({ done: { bot: true }, started: true });
    const card = guideCard(v);
    expect(card).toContain("Getting started · 1 of 5");
    expect(card).toContain("Defeat Cragmuff");
    const sheet = guideMarkup(v);
    for (const s of GUIDE_STEPS) expect(sheet).toContain(s.title);
    expect(sheet.match(/data-guide-go="/g)).toHaveLength(4);
    expect(sheet).toContain('data-guide-go="raid"');
    expect(sheet).not.toContain('data-guide-go="bot"');
    expect(sheet).toContain("data-guide-hide");
    // Hidden: the sheet offers to put it back.
    const back = guideMarkup(
      guideView({ done: {}, started: true, hidden: true }),
    );
    expect(back).toContain("data-guide-show");
  });
});
