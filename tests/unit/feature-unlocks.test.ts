import { afterEach, describe, expect, it } from "vitest";
import {
  FEATURE_UNLOCKS,
  featureLocked,
  loadSeenLevel,
  lockBadge,
  lockedFeatures,
  lockedLabel,
  lockedMessage,
  saveSeenLevel,
  unlockDialog,
  unlocksBetween,
  unlocksDue,
} from "../../apps/client/src/feature-unlocks";
import { confirmModal } from "../../apps/client/src/ui/components";
import { guideMarkup, guideView } from "../../apps/client/src/getting-started";
import { sceneSwitchMarkup } from "../../apps/client/src/hub-scene";
import {
  ACTION_FEATURE,
  LOBBY_MODES,
  missionsCard,
  modeHint,
} from "../../apps/client/src/lobby-screen";
import { levelThreshold } from "../../packages/shared/src/journey";

// Features that open by level (feature-unlocks.ts): the rules, the padlock
// and the "Unlocked" dialog. The Lobby with them: tests/visual/feature-unlocks.spec.ts.
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
afterEach(() => store.clear());

describe("what opens when", () => {
  it("opens one feature a level, from level 2, in order", () => {
    expect(FEATURE_UNLOCKS.map((u) => u.level)).toEqual([2, 3, 4, 5, 6]);
    expect(FEATURE_UNLOCKS.map((u) => u.id)).toEqual([
      "raids",
      "missions",
      "plaza",
      "shop",
      "ranks",
    ]);
    // The first boss opens with the first win's level: it is Getting
    // started's next step.
    expect(FEATURE_UNLOCKS[0]).toMatchObject({ id: "raids", level: 2 });
  });
  it("keeps the last unlock within a first week of play", () => {
    // Level 6 is 750 XP: a few raids and a dozen matches.
    expect(
      levelThreshold(Math.max(...FEATURE_UNLOCKS.map((u) => u.level))),
    ).toBeLessThanOrEqual(1000);
  });
  it("locks by level, and nothing while the account loads", () => {
    expect(featureLocked("raids", 1)).toBe(true);
    expect(featureLocked("raids", 2)).toBe(false);
    expect(featureLocked("ranks", 5)).toBe(true);
    expect(featureLocked("ranks", 6)).toBe(false);
    for (const u of FEATURE_UNLOCKS)
      expect(featureLocked(u.id, undefined)).toBe(false);
    expect(lockedFeatures(1)).toHaveLength(FEATURE_UNLOCKS.length);
    expect(lockedFeatures(3)).toEqual(["plaza", "shop", "ranks"]);
    expect(lockedFeatures(40)).toEqual([]);
    expect(lockedFeatures(undefined)).toEqual([]);
  });
  it("never locks playing, fighters, friends or the party", () => {
    expect(Object.keys(ACTION_FEATURE).sort()).toEqual([
      "missions",
      "raids",
      "ranks",
      "shop",
    ]);
  });
  it("says when a locked feature opens, in one short line", () => {
    expect(lockedMessage("raids")).toBe("Boss Raids open at Lv 2");
    expect(lockedMessage("plaza")).toBe("The Plaza opens at Lv 4");
    expect(lockedMessage("shop")).toBe("The Shop opens at Lv 5");
    for (const u of FEATURE_UNLOCKS)
      expect(lockedMessage(u.id).length).toBeLessThanOrEqual(30);
  });
});

describe("the padlock", () => {
  it("shows the level, and names it for a screen reader", () => {
    expect(lockBadge("missions")).toContain("<b>Lv 3</b>");
    expect(lockBadge("missions")).toContain('aria-hidden="true"');
    expect(lockedLabel("Missions", "missions")).toBe(
      "Missions: opens at level 3",
    );
  });
  it("marks the Plaza's tab until level 4", () => {
    const locked = sceneSwitchMarkup("lobby", 3);
    expect(locked).toContain('class="is-locked"');
    expect(locked).toContain("Plaza: opens at level 4");
    expect(locked).toContain("Lv 4");
    for (const level of [4, 20, undefined]) {
      expect(sceneSwitchMarkup("lobby", level)).not.toContain("is-locked");
      expect(sceneSwitchMarkup("lobby", level)).not.toContain("feature-lock");
    }
  });
  it("the Missions card says when it opens, then shows the missions", () => {
    expect(missionsCard(undefined, 1)).toContain("Opens at Lv 3");
    expect(missionsCard(undefined, 3)).toContain("Six a day");
    expect(missionsCard(undefined, undefined)).toContain("Six a day");
  });
  it("Getting started's boss step shows it in Go's place", () => {
    const v = guideView({ done: {}, started: true });
    const locked = guideMarkup(v, { raid: "raids" });
    expect(locked).not.toContain('data-guide-go="raid"');
    expect(locked).toContain("Opens at level 2");
    expect(locked).toContain('data-guide-go="bot"');
    expect(locked).toContain('data-guide-go="wear"');
    expect(guideMarkup(v)).toContain('data-guide-go="raid"');
  });
});

describe("the Unlocked dialog", () => {
  it("is due only for levels gained since this browser last looked", () => {
    // Never seen: remember the level, show nothing (an older account, or a
    // new device).
    expect(unlocksDue(null, 1)).toEqual({ show: [], seen: 1 });
    expect(unlocksDue(null, 30)).toEqual({ show: [], seen: 30 });
    // The first win.
    const first = unlocksDue(1, 2);
    expect(first.seen).toBe(2);
    expect(first.show.map((u) => u.id)).toEqual(["raids"]);
    // Several levels at once: all of them, in order.
    expect(unlocksDue(1, 4).show.map((u) => u.id)).toEqual([
      "raids",
      "missions",
      "plaza",
    ]);
    // Nothing new: the same level, a level that opens nothing, or a lower
    // one (never goes back).
    expect(unlocksDue(2, 2).show).toEqual([]);
    expect(unlocksDue(6, 9)).toEqual({ show: [], seen: 9 });
    expect(unlocksDue(5, 3)).toEqual({ show: [], seen: 5 });
    expect(unlocksBetween(0, 100)).toHaveLength(FEATURE_UNLOCKS.length);
  });
  it("remembers the level per account", () => {
    expect(loadSeenLevel("a")).toBeNull();
    saveSeenLevel("a", 3);
    expect(loadSeenLevel("a")).toBe(3);
    expect(loadSeenLevel("b")).toBeNull();
    store.set("arena-unlocks:c", "junk");
    expect(loadSeenLevel("c")).toBeNull();
  });
  it("names the level, the feature and what comes next", () => {
    const one = unlockDialog(2, unlocksBetween(1, 2));
    expect(one).toMatchObject({
      kicker: "Level 2",
      title: "Unlocked: Boss Raids",
      cancel: "Later",
      confirm: "Open",
    });
    const html = confirmModal(one);
    expect(html).toContain("Fight a boss");
    expect(html).toContain("Daily Missions · Lv 3");
    const three = unlockDialog(4, unlocksBetween(1, 4));
    expect(three.title).toBe("Unlocked");
    expect(three.confirm).toBe("Open Boss Raids");
    expect(three.lines.map(([name]) => name)).toEqual([
      "Boss Raids",
      "Daily Missions",
      "The Plaza",
    ]);
    expect(confirmModal(three)).toContain("The Shop · Lv 5");
    // The last one: nothing left to open.
    expect(confirmModal(unlockDialog(6, unlocksBetween(5, 6)))).toContain(
      "Everything is open",
    );
  });
});

describe("a new player's short first matches on the Lobby", () => {
  const bot = LOBBY_MODES.find((m) => m.id === "bot-easy")!,
    duel = LOBBY_MODES.find((m) => m.id === "duel")!;
  it("a bot mode's hint says one round, then best of 3, then the usual", () => {
    expect(modeHint(bot, 1)).toBe("Learning · one round");
    expect(modeHint(bot, 2)).toBe("Learning · best of 3");
    expect(modeHint(bot)).toBe("Learning · best of five");
  });
  it("a room between players keeps its hint", () => {
    expect(modeHint(duel, 1)).toBe(duel.hint);
  });
});
