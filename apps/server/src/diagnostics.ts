import { monitorEventLoopDelay, performance } from "node:perf_hooks";

/**
 * Optional, lightweight server measurements: combat tick and broadcast
 * durations, event-loop delay, CPU, memory and outgoing Socket.IO bytes.
 *
 * Off by default. Enable with `ARENA_DIAGNOSTICS=<seconds>` (logs one JSON
 * line per interval, e.g. on Render) or `createArenaServer({ diagnostics })`
 * for the load scripts. When disabled, every method is a cheap no-op.
 */
export class ServerDiagnostics {
  private ticks: number[] = [];
  private broadcasts: number[] = [];
  private snapshotBytes: number[] = [];
  private bytesOut = 0;
  private messagesOut = 0;
  private skipped = 0;
  private since = performance.now();
  private cpu = process.cpuUsage();
  static resolution = 10;
  private loop = monitorEventLoopDelay({
    resolution: ServerDiagnostics.resolution,
  });
  constructor(readonly enabled: boolean) {
    if (enabled) this.loop.enable();
  }
  now() {
    return this.enabled ? performance.now() : 0;
  }
  tick(start: number) {
    if (this.enabled) this.ticks.push(performance.now() - start);
  }
  broadcast(start: number) {
    if (this.enabled) this.broadcasts.push(performance.now() - start);
  }
  /** One room snapshot's shared payload (sampled when enabled). */
  snapshot(bytes: number) {
    if (this.enabled) this.snapshotBytes.push(bytes);
  }
  /** A packet written to one client (Engine.IO packetCreate). */
  packet(bytes: number) {
    if (!this.enabled) return;
    this.bytesOut += bytes;
    this.messagesOut++;
  }
  /** A snapshot held back from a congested socket (its events are kept). */
  skip() {
    if (this.enabled) this.skipped++;
  }
  /** Summarise and reset the window. */
  report(extra: Record<string, number> = {}) {
    const seconds = Math.max(0.001, (performance.now() - this.since) / 1000);
    const cpu = process.cpuUsage(this.cpu);
    const memory = process.memoryUsage();
    const result = {
      seconds: round(seconds),
      ...extra,
      tickMs: summary(this.ticks),
      broadcastMs: summary(this.broadcasts),
      snapshotBytes: summary(this.snapshotBytes),
      // The histogram records whole timer intervals: report the delay beyond them.
      eventLoopDelayMs: {
        p50: delay(this.loop.percentile(50)),
        p99: delay(this.loop.percentile(99)),
        max: delay(this.loop.max),
      },
      /** Percent of one CPU core (Render's 0.5 CPU plan is 50). */
      cpuPercent: round(((cpu.user + cpu.system) / 1e6 / seconds) * 100),
      rssMB: round(memory.rss / 2 ** 20),
      heapUsedMB: round(memory.heapUsed / 2 ** 20),
      bytesOutPerSecond: Math.round(this.bytesOut / seconds),
      messagesOutPerSecond: Math.round(this.messagesOut / seconds),
      congestedSkips: this.skipped,
    };
    this.ticks = [];
    this.broadcasts = [];
    this.snapshotBytes = [];
    this.bytesOut = this.messagesOut = this.skipped = 0;
    this.since = performance.now();
    this.cpu = process.cpuUsage();
    this.loop.reset();
    return result;
  }
  close() {
    this.loop.disable();
  }
}
function delay(nanoseconds: number) {
  return round(Math.max(0, nanoseconds / 1e6 - ServerDiagnostics.resolution));
}
function round(n: number) {
  return Math.round(n * 100) / 100;
}
export function summary(values: number[]) {
  if (!values.length) return { n: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return {
    n: values.length,
    p50: round(at(0.5)),
    p95: round(at(0.95)),
    p99: round(at(0.99)),
    max: round(sorted.at(-1)!),
  };
}
