import { expect, it } from "vitest";
import {
  roomSeatsMarkup,
  type RoomData,
} from "../../apps/client/src/screens/room-view";

// The raid room's seats (UI remodel step 5: the old raid lobby's panel is
// the room's seats column now). main.ts seats you with the fighter you
// picked before the server confirms it; your teammates keep theirs.
const room = (extra: Partial<RoomData> = {}): RoomData => ({
  mode: "raid",
  watch: false,
  code: "TEST01",
  boss: "grumblecrag",
  rounds: 3,
  host: true,
  rules: [],
  teamUp: "",
  watchers: [],
  seats: [
    {
      id: "me",
      name: "Player",
      character: "tidefin",
      avatar: '<svg aria-label="Tidefin"></svg>',
      ready: false,
      connected: true,
      host: true,
      me: true,
    },
    {
      id: "peer",
      name: "Teammate",
      character: "cindrake",
      avatar: '<svg aria-label="Cindrake"></svg>',
      ready: true,
      connected: true,
      host: false,
      me: false,
    },
  ],
  ...extra,
});

it("shows your pending fighter on your seat and your teammates' own", () => {
  const html = roomSeatsMarkup(room());
  const mine = html.split('data-room-seat="me"')[1].split("data-room-seat=")[0];
  expect(mine).toContain('aria-label="Tidefin"');
  expect(mine).toContain("Tidefin · Host");
  expect(mine).toContain("(you)");
  const peer = html.split('data-room-seat="peer"')[1];
  expect(peer).toContain('aria-label="Cindrake"');
  expect(peer).toContain("Ready");
  // Four seats in a raid: two open ones invite friends.
  expect(html.match(/data-room-invite/g)).toHaveLength(2);
  expect(html).toContain("1/2 ready · room TEST01");
});
it("seats a 2v2 room by team, with a way to join the other side", () => {
  const html = roomSeatsMarkup(
    room({
      mode: "teams",
      boss: undefined,
      seats: room().seats.map((s, i) => ({ ...s, team: i === 0 ? 0 : 1 })),
    }),
  );
  expect(html).toContain("Blue team");
  expect(html).toContain("Red team");
  expect(html).toContain('data-team="1"');
  expect(html).toContain('id="shuffle"');
});
