import { describe, expect, it } from "vitest";
import type { Rating } from "../../packages/shared/src/accounts";
import {
  rankChip,
  rankChipKey,
  rankChipMarkup,
  rankNews,
} from "../../apps/client/src/rank-chip";
import {
  RANKS,
  RANK_TIERS,
  rankColor,
} from "../../packages/shared/src/accounts";

// The Lobby's rank chip and what a match's rating change says (rank road).
const ranked: Rating = {
  rating: 1218,
  matches: 62,
  rank: "Tempest III",
  placementLeft: 0,
  next: { name: "Tempest II", at: 1250 },
  shield: false,
};

describe("the Lobby's rank chip", () => {
  it("shows your rank in its tier's colour, and your shield", () => {
    expect(rankChip(ranked, false)).toEqual({
      text: "Tempest III",
      color: RANK_TIERS[3].color,
      shield: false,
      label: "Your rank: Tempest III",
    });
    const held = rankChip({ ...ranked, shield: true }, false)!;
    expect(held.shield).toBe(true);
    expect(held.label).toBe("Your rank: Tempest III. Shield ready");
    expect(rankChipMarkup(held)).toContain("rank-chip-shield");
    expect(rankChipMarkup(held)).not.toContain("rank-chip-gem");
    expect(rankChipMarkup(rankChip(ranked, false)!)).toContain(
      '<i class="rank-chip-gem" aria-hidden="true"></i><span>Tempest III</span>',
    );
    // A ranked player sees it even while Ranks is locked at their level.
    expect(rankChip(ranked, true)?.text).toBe("Tempest III");
  });
  it("counts placement matches, and says Unranked before the first", () => {
    const placing = {
      ...ranked,
      rank: "Unranked",
      matches: 2,
      placementLeft: 3,
    };
    expect(rankChip(placing, false)).toMatchObject({
      text: "Placing 2/5",
      shield: false,
    });
    expect(rankChip(placing, false)!.color).toBeUndefined();
    // Placing shows while Ranks is locked too: they have met a player.
    expect(rankChip(placing, true)?.text).toBe("Placing 2/5");
    const fresh = { ...ranked, rank: "Unranked", matches: 0, placementLeft: 5 };
    expect(rankChip(fresh, false)?.text).toBe("Unranked");
    // A new player, Ranks still locked: nothing about ranks yet.
    expect(rankChip(fresh, true)).toBeNull();
    // No rating loaded.
    expect(rankChip(undefined, false)).toBeNull();
  });
  it("fits a phone's nameplate: no rank name longer than Tempest III", () => {
    for (const r of RANKS)
      expect(r.name.length).toBeLessThanOrEqual("Tempest III".length);
  });
  it("is drawn again only when it changes", () => {
    const a = rankChipKey(rankChip(ranked, false));
    expect(rankChipKey(rankChip({ ...ranked, rating: 1230 }, false))).toBe(a);
    expect(rankChipKey(rankChip({ ...ranked, shield: true }, false))).not.toBe(
      a,
    );
    expect(rankChipKey(null)).toBe("");
  });
  it("escapes what the server names", () => {
    expect(
      rankChipMarkup({ text: "<b>x</b>", shield: false, label: "" }),
    ).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(rankColor("<b>x</b>")).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("what a rated match says about your rank", () => {
  const after = (r: Partial<Rating>): Rating => ({
    ...ranked,
    before: 1200,
    ...r,
  });
  it("a new tier: its title, its coins and a shield", () => {
    expect(
      rankNews(
        after({ rating: 1215, rank: "Tempest III", previousRank: "Flare I" }),
      ),
    ).toBe("New tier: Tempest! Its title, 250 coins and a shield are yours.");
  });
  it("a step up inside the tier", () => {
    expect(
      rankNews(
        after({
          rating: 1255,
          rank: "Tempest II",
          previousRank: "Tempest III",
        }),
      ),
    ).toBe("Rank up! You're now Tempest II.");
  });
  it("the shield that held a loss", () => {
    expect(
      rankNews(
        after({
          before: 1214,
          rating: 1210,
          rank: "Tempest III",
          previousRank: "Tempest III",
          shielded: true,
        }),
      ),
    ).toBe("Your shield held: you stay in Tempest.");
  });
  it("the first rank, when placement ends", () => {
    expect(
      rankNews(
        after({ rating: 1112, rank: "Flare III", previousRank: "Unranked" }),
      ),
    ).toBe("You're ranked: Flare III. The Flare title is yours to keep.");
  });
  it("nothing for an ordinary win or loss, a lost rank or placement", () => {
    for (const r of [
      after({ rating: 1228, previousRank: "Tempest III" }),
      after({ rating: 1190, rank: "Flare I", previousRank: "Tempest III" }),
      after({
        rating: 1020,
        rank: "Unranked",
        previousRank: "Unranked",
        placementLeft: 2,
      }),
      after({ rating: 1228, previousRank: undefined }),
    ])
      expect(rankNews(r)).toBe("");
  });
});
