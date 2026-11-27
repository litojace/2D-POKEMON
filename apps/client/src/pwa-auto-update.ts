/** How long "Later" keeps the update prompt away. */
export const UPDATE_SNOOZE_MS = 10 * 60 * 1000;
/**
 * A downloaded update asks the player first (docs/mobile-pwa.md): the prompt
 * shows only where updating is safe (the Lobby or the Plaza, no menu open,
 * no match in this or another tab), and nothing activates or reloads until
 * the player taps Update now. The first ask fills the screen (`fullScreen`);
 * after "Later" it asks again after UPDATE_SNOOZE_MS, in the compact banner.
 *
 * Activation and reload are separately guarded: another tab may activate the
 * worker while this tab is in a match. Never reload that match mid-play.
 */
export class PwaAutoUpdate {
  waiting = false;
  reloadReady = false;
  applying = false;
  /** The player tapped Update now. */
  accepted = false;
  private retryAt = 0;
  private snoozedUntil = 0;
  /** The player already answered the full-screen ask with Later. */
  private answered = false;
  constructor(
    private actions: {
      safe: () => boolean;
      activate: () => Promise<void>;
      reload: () => void;
      now: () => number;
    },
  ) {}
  available() {
    this.waiting = true;
  }
  activated() {
    this.reloadReady = true;
    this.waiting = false;
  }
  /** An update is downloaded (or already active in another tab). */
  get pending() {
    return this.waiting || this.reloadReady;
  }
  /** Whether to show the Update now / Later prompt right now. */
  get asking() {
    return (
      this.pending &&
      !this.accepted &&
      this.actions.now() >= this.snoozedUntil &&
      this.actions.safe()
    );
  }
  /** The first ask: the full-screen prompt rather than the banner. */
  get fullScreen() {
    return this.asking && !this.answered;
  }
  /** Update now: applies at once while it is still safe. */
  accept() {
    this.accepted = true;
    return this.sync();
  }
  /** Later: ask again after UPDATE_SNOOZE_MS. */
  later() {
    this.answered = true;
    this.snoozedUntil = this.actions.now() + UPDATE_SNOOZE_MS;
  }
  async sync() {
    if (!this.accepted || !this.actions.safe()) return;
    if (this.reloadReady) {
      this.reloadReady = false;
      this.actions.reload();
      return;
    }
    if (!this.waiting || this.applying || this.actions.now() < this.retryAt)
      return;
    this.applying = true;
    this.retryAt = this.actions.now() + 15000;
    try {
      await this.actions.activate();
    } catch {
      /* A temporary failure retries automatically at the next safe check. */
    } finally {
      this.applying = false;
    }
    if (this.reloadReady) await this.sync();
  }
}
