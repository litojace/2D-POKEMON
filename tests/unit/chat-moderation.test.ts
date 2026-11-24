import { describe, expect, it } from "vitest";
import {
  CHAT_REPORT,
  ChatReports,
  reportContext,
} from "../../apps/server/src/chat-moderation";
import type { ChatLine } from "../../packages/shared/src/chat";

// Chat reports and the automatic pause (apps/server/src/chat-moderation.ts).
function clock() {
  let now = 1_000_000;
  return { now: () => now, tick: (ms: number) => (now += ms) };
}

describe("the automatic pause", () => {
  it("comes with three different reporters within an hour, for an hour", () => {
    const c = clock();
    const r = new ChatReports(c.now);
    expect(r.record("a", "rude").pausedNow).toBe(false);
    expect(r.record("b", "rude").pausedNow).toBe(false);
    expect(r.isPaused("rude")).toBe(false);
    expect(r.record("c", "rude")).toEqual({ counts: true, pausedNow: true });
    expect(r.isPaused("rude")).toBe(true);
    c.tick(CHAT_REPORT.pauseMs);
    expect(r.isPaused("rude")).toBe(false);
  });
  it("doesn't count one player reporting again and again", () => {
    const r = new ChatReports(clock().now);
    r.record("a", "x");
    expect(r.record("a", "x").counts).toBe(false);
    r.record("a", "x");
    expect(r.isPaused("x")).toBe(false);
  });
  it("forgets reports older than an hour", () => {
    const c = clock();
    const r = new ChatReports(c.now);
    r.record("a", "x");
    r.record("b", "x");
    c.tick(CHAT_REPORT.windowMs);
    r.record("c", "x");
    expect(r.isPaused("x")).toBe(false);
  });
  it("lifts when an admin looked", () => {
    const r = new ChatReports(clock().now);
    for (const who of ["a", "b", "c"]) r.record(who, "x");
    r.lift("x");
    expect(r.isPaused("x")).toBe(false);
  });
});

describe("the report's lines", () => {
  const line = (id: number, text: string): ChatLine => ({
    id,
    channel: "party",
    from: { id: "00000000-0000-4000-8000-00000000000" + (id % 10), name: `P${id}` },
    at: Date.UTC(2026, 10, 15, 18, 0, id),
    text,
  });
  it("keeps the newest lines that fit the database's limits, oldest first", () => {
    const lines = Array.from({ length: 30 }, (_, i) =>
      line(i + 1, "x".repeat(120)),
    );
    const c = reportContext(
      "party:ABC",
      { id: "id-1", name: "Rude" },
      lines,
    );
    expect(Object.keys(c).length).toBeLessThanOrEqual(12);
    expect(JSON.stringify(c).length).toBeLessThanOrEqual(2000);
    for (const v of Object.values(c)) expect(v.length).toBeLessThanOrEqual(300);
    const kept = Object.keys(c).filter((k) => k.startsWith("line"));
    expect(c[kept.at(-1)!]).toContain("P30");
    expect(c.source).toBe("chat");
    expect(c.reported).toBe("Rude (id-1)");
  });
  it("writes quick lines and times plainly", () => {
    const c = reportContext("room:X", { id: "i", name: "N" }, [
      { ...line(1, ""), text: undefined, quick: "gg" },
    ]);
    expect(c.line1).toBe("18:00:01 P1 (00000000): [quick] GG");
  });
});
