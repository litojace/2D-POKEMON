import type { Account } from "../../packages/shared/src/accounts";
import type { AccountProvider } from "../../apps/server/src/accounts";
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
