import type { Account } from "../../packages/shared/src/accounts";
import type { AccountProvider } from "../../apps/server/src/accounts";
import {
  spireRewardsOf,
  type SpireFloorReceipt,
  type SpireMember,
} from "../../packages/shared/src/spire";
export function fakeAccounts() {
  let serial = 0;
  const users = new Map<string, Account>();
  const provider: AccountProvider = {
    async authenticate(token) {
      return users.get(token) ?? null;
    },
    async rpc() {
      throw new Error("No RPC handler installed for this test");
    },
  };
  return {
    provider,
    users,
    add(admin = true) {
      const number = ++serial;
      const token = `test-user-${number}`;
      const account: Account = {
        id: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
        displayName: `Player ${number}`,
        isAdmin: admin,
        suspended: false,
        title: null,
        titleColor: null,
        ownedTitles: [],
      };
      users.set(token, account);
      return { token, account };
    },
  };
}
/**
 * The Spire's storage in memory: each saved floor, first clears paid once
 * per player (as arena_record_spire_floor does), and each climber's
 * checkpoint and raid clears for the start check (a Cragmuff clear unless
 * `members` says otherwise).
 */
export function fakeSpire(
  provider: AccountProvider,
  members: Record<string, SpireMember> = {},
) {
  const floors: SpireFloorReceipt[] = [];
  const claimed = new Set<string>();
  provider.recordSpireFloor = async (receipt) => {
    floors.push(structuredClone(receipt));
    const rewards = spireRewardsOf(receipt.floor, receipt.season);
    const newClaims = receipt.players
      .filter((p) => !claimed.has(`${p.accountId}:${receipt.floor}`))
      .map((p) => {
        claimed.add(`${p.accountId}:${receipt.floor}`);
        return {
          accountId: p.accountId,
          floor: receipt.floor,
          coins: rewards
            .filter((r) => r.kind === "coins")
            .reduce((n, r) => n + r.amount, 0),
          titles: rewards.filter((r) => r.kind === "title").map((r) => r.item),
        };
      });
    return { newClaims };
  };
  provider.spireStart = async (ids) =>
    ids.map(
      (id) => members[id] ?? { checkpoint: 1, clears: { grumblecrag: 1 } },
    );
  return { floors, members };
}
