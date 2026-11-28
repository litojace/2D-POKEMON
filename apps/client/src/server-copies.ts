/**
 * The server's copies the Lobby's screens are drawn from (accounts.ts
 * fetchCopy), by account and path.
 *
 * - A copy asked for less than `maxAge` ms ago is used again without asking
 *   (the request itself while it is on its way, so two screens asking at
 *   once share it).
 * - An older one is asked for again; a screen opens on what it drew last
 *   and redraws only if the new answer differs (stale-while-refresh, owner
 *   28 Nov: no panel waits, nothing redraws for nothing).
 * - The same answer as the last one, field for field, comes back as the
 *   very same object, so a screen that compares what it drew from
 *   (`profileShown`, `ranksBoardRaw`, `friendsListRaw`) draws nothing
 *   again. That holds after `forget()` too: it only makes the next screen
 *   ask; `forgetAll()` (another player) drops the last answers as well.
 * - A failed answer isn't kept: the next screen asks again.
 */
export class ServerCopies {
  private copies = new Map<string, { at: number; value: Promise<unknown> }>();
  private last = new Map<string, unknown>();
  constructor(
    private ask: (path: string) => Promise<unknown>,
    private now: () => number = () => performance.now(),
  ) {}
  /** GET `path` (kept under `key`), or the copy asked for less than `maxAge` ms ago. */
  get(key: string, path: string, maxAge: number): Promise<unknown> {
    const now = this.now();
    const kept = this.copies.get(key);
    if (kept && now - kept.at < maxAge) return kept.value;
    const value = this.ask(path).then((answer) => {
      const before = this.last.get(key);
      // Compared as it is now, so a copy something changed in place since
      // is never handed back for an answer that matches its old self.
      if (before !== undefined && same(before, answer)) return before;
      this.last.set(key, answer);
      return answer;
    });
    this.copies.set(key, { at: now, value });
    value.catch(() => {
      if (this.copies.get(key)?.value === value) this.copies.delete(key);
    });
    return value;
  }
  /** The next screen asks the server again (its copies may be old). */
  forget() {
    this.copies.clear();
  }
  /** Another player: nothing of the last one is kept. */
  forgetAll() {
    this.copies.clear();
    this.last.clear();
  }
}

function same(a: unknown, b: unknown) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
