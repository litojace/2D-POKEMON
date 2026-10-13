import { describe, expect, it } from "vitest";
import {
  describeActivity,
  onlineFor,
  renderOnline,
} from "../../apps/client/src/admin-online";
import type { OnlinePlayer } from "../../packages/shared/src/accounts";
const now = Date.parse("2026-10-13T12:00:00Z");
const player = (over: Partial<OnlinePlayer>): OnlinePlayer => ({
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Ava",
  title: null,
  titleColor: null,
  isAdmin: false,
  connections: 1,
  since: "2026-10-13T11:55:00Z",
  activity: "menu",
  room: null,
  phase: null,
  fighter: null,
  opponent: null,
  ...over,
});
const names = (id: string) =>
  ({ voltkit: "Voltkit", tidefin: "Tidefin" })[id] ?? id;
describe("admin online list", () => {
  it("formats connection time", () => {
    expect(onlineFor("2026-10-13T11:59:40Z", now)).toBe("just now");
    expect(onlineFor("2026-10-13T11:55:00Z", now)).toBe("5m");
    expect(onlineFor("2026-10-13T09:50:00Z", now)).toBe("2h 10m");
  });
  it("describes what each player is doing", () => {
    expect(describeActivity(player({}), names)).toBe("Browsing menus");
    expect(
      describeActivity(
        player({ activity: "practice", fighter: "tidefin" }),
        names,
      ),
    ).toBe("Solo practice as Tidefin");
    expect(
      describeActivity(player({ activity: "lobby", room: "ABC234" }), names),
    ).toContain("waiting for a rival");
    const match = describeActivity(
      player({
        activity: "match",
        room: "ABC234",
        phase: "playing",
        fighter: "voltkit",
        opponent: "Bo",
      }),
      names,
    );
    expect(match).toContain("Battling Bo as Voltkit");
    expect(match).toContain("fighting");
    expect(match).toContain("ABC234");
  });
  it("renders counts, escapes names and hides Manage for admins", () => {
    const html = renderOnline(
      {
        players: [
          player({
            displayName: "<b>x</b>",
            activity: "match",
            opponent: "Bo",
            room: "ABC234",
            phase: "playing",
          }),
          player({
            id: "a2",
            displayName: "Boss",
            isAdmin: true,
            connections: 2,
          }),
        ],
        guests: 3,
        at: "2026-10-13T12:00:00Z",
      },
      names,
      now,
    );
    expect(html).toContain("<b>2</b> signed in");
    expect(html).toContain("1 in match");
    expect(html).toContain("3 not signed in");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("2 tabs");
    expect(html.match(/data-manage/g)).toHaveLength(1);
  });
  it("shows an empty state", () => {
    expect(
      renderOnline(
        { players: [], guests: 0, at: new Date(now).toISOString() },
        names,
        now,
      ),
    ).toContain("No signed-in players");
  });
});
