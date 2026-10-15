/** Activation and reload are separately guarded: another tab may activate the
 * worker while this tab is in a match. Never reload that match mid-play. */
export class PwaAutoUpdate {
  waiting = false;
  reloadReady = false;
  applying = false;
  private retryAt = 0;
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
  async sync() {
    if (!this.actions.safe()) return;
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
