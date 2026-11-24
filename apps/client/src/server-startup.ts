export type StartupStatus =
  "connecting" | "waiting" | "offline" | "failed" | "ready";

/** One startup probe shared by authentication and the game socket. Never retries mutations. */
export class ServerStartup {
  private readyAt = -Infinity;
  private pending?: Promise<void>;

  constructor(
    private probe: (signal: AbortSignal) => Promise<boolean>,
    private status: (value: StartupStatus) => void,
    private online = () => true,
    private options = {
      deadlineMs: 120_000,
      requestMs: 8_000,
      retryMs: 2_000,
      freshMs: 60_000,
    },
  ) {}

  wait(): Promise<void> {
    if (this.pending) return this.pending;
    if (Date.now() - this.readyAt < this.options.freshMs)
      return Promise.resolve();
    const task = this.run();
    this.pending = task;
    const clear = () => {
      if (this.pending === task) this.pending = undefined;
    };
    void task.then(clear, clear);
    return task;
  }

  private async run() {
    const end = Date.now() + this.options.deadlineMs;
    let attempt = 0;
    while (Date.now() < end) {
      this.status(
        !this.online() ? "offline" : attempt ? "waiting" : "connecting",
      );
      if (this.online()) {
        const abort = new AbortController();
        let timer: ReturnType<typeof setTimeout> | undefined;
        // Race as well as abort: a platform fetch that ignores cancellation
        // must not prevent the player reaching a retry button.
        const timeout = new Promise<boolean>((resolve) => {
          timer = setTimeout(
            () => {
              abort.abort();
              resolve(false);
            },
            Math.min(this.options.requestMs, end - Date.now()),
          );
        });
        try {
          if (await Promise.race([this.probe(abort.signal), timeout])) {
            this.readyAt = Date.now();
            this.status("ready");
            return;
          }
        } catch {
          // Render can return HTML/502s while waking. These are not auth errors.
        } finally {
          clearTimeout(timer);
        }
      }
      attempt++;
      const delay = Math.min(this.options.retryMs, end - Date.now());
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
    this.status("failed");
    throw new Error(
      "The game server is taking longer to connect. Please try again.",
    );
  }
}
