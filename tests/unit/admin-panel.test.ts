import { describe, expect, it } from "vitest";
import {
  ago,
  chatTarget,
  MUTE_CHOICES,
  photoTarget,
  reportedPlayer,
} from "../../apps/client/src/admin-panel";

const ID = "22222222-2222-4222-8222-222222222222";
describe("admin panel helpers", () => {
  it("says how long ago a report came in", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    expect(ago("2026-11-22T11:59:40Z", now)).toBe("now");
    expect(ago("2026-11-22T11:48:00Z", now)).toBe("12m ago");
    expect(ago("2026-11-22T09:00:00Z", now)).toBe("3h ago");
    expect(ago("2026-11-19T12:00:00Z", now)).toBe("3d ago");
  });
  it("finds who a report is about", () => {
    expect(reportedPlayer({ player: ID })).toBe(ID);
    // A picture report names its owner as playerId (migration 20261119110000).
    expect(reportedPlayer({ avatarPhoto: ID, playerId: ID })).toBe(ID);
    expect(reportedPlayer({ source: "chat", reported: `Nova (${ID})` })).toBe(
      ID,
    );
    expect(reportedPlayer({ player: "not-an-id" })).toBeNull();
    expect(reportedPlayer({})).toBeNull();
  });
  it("only stops chat from a chat report", () => {
    expect(chatTarget({ source: "chat", reported: `Nova (${ID})` })).toBe(ID);
    expect(chatTarget({ reported: `Nova (${ID})` })).toBeNull();
  });
  it("only loads a picture with a valid id", () => {
    expect(photoTarget({ avatarPhoto: ID })).toBe(ID);
    expect(photoTarget({ avatarPhoto: "../etc" })).toBe("");
  });
  it("offers mutes the server accepts (0 to 8760 hours, 0 lifts)", () => {
    for (const c of MUTE_CHOICES) {
      expect(Number.isInteger(c.hours)).toBe(true);
      expect(c.hours).toBeGreaterThanOrEqual(0);
      expect(c.hours).toBeLessThanOrEqual(8760);
    }
    expect(MUTE_CHOICES.some((c) => c.hours === 0)).toBe(true);
  });
});
