import { describe, expect, it } from "vitest";
import {
  pingLabel,
  renderReadme,
  toReport,
} from "../../scripts/perf/export-perf-reports.mjs";

const entry = (
  message: string,
  id = "a1",
  timestamp = "2026-11-11T01:02:03Z",
) => ({
  id,
  timestamp,
  message,
});

describe("match reports exported to GitHub", () => {
  it("keeps a match's technical numbers", () => {
    const r = toReport(
      entry(
        'arena-perf {"seconds":60,"frames":3600,"fps":58.8,"frameP95":17,"jank":0.002,"stalls":0,"quality":"high","setting":"auto","density":1.5,"cores":4,"ping":42,"lead":118,"mode":"duel","players":2,"bots":0,"character":"voltkit"}',
      ),
    );
    expect(r).toMatchObject({
      id: "a1",
      at: "2026-11-11T01:02:03Z",
      kind: "arena-perf",
      ping: 42,
      lead: 118,
      fps: 58.8,
      character: "voltkit",
    });
  });

  it("never copies accounts, rooms or anything it does not know", () => {
    // The repository is public: a disconnect's account and room stay in the log.
    const r = toReport(
      entry(
        'arena-disconnect {"reason":"transport close","transport":"websocket","room":"ABC123","mode":"duel","phase":"playing","account":"user-123","connectedFor":90,"name":"Kai"}',
      ),
    );
    expect(r).toEqual({
      id: "a1",
      at: "2026-11-11T01:02:03Z",
      kind: "arena-disconnect",
      reason: "transport close",
      transport: "websocket",
      mode: "duel",
      phase: "playing",
      connectedFor: 90,
    });
    const perf = toReport(
      entry('arena-perf {"fps":60,"account":"x","email":"y"}'),
    );
    expect(perf).not.toHaveProperty("account");
    expect(perf).not.toHaveProperty("email");
  });

  it("ignores other log lines and broken ones", () => {
    expect(toReport(entry("arena-diagnostics {}"))).toBeNull();
    expect(toReport(entry("arena-perf {not json"))).toBeNull();
    expect(toReport(entry("server started"))).toBeNull();
  });

  it("writes the newest match first and sums up each day", () => {
    const rows = [
      toReport(
        entry(
          'arena-perf {"fps":58,"ping":40,"lead":110,"mode":"duel","character":"voltkit"}',
          "1",
          "2026-11-11T01:00:00Z",
        ),
      ),
      toReport(
        entry(
          'arena-perf {"fps":60,"ping":200,"lead":250,"mode":"ffa","character":"cindrake"}',
          "2",
          "2026-11-11T02:00:00Z",
        ),
      ),
      toReport(
        entry(
          'arena-disconnect {"reason":"ping timeout"}',
          "3",
          "2026-11-11T02:05:00Z",
        ),
      ),
    ];
    const md = renderReadme(rows);
    expect(md).toContain("Newest report: 2026-11-11 02:00 UTC");
    expect(md.indexOf("cindrake")).toBeLessThan(md.indexOf("voltkit"));
    expect(md).toContain("200 ms 🔴");
    expect(md).toContain("| 2026-11-11 | 2 |");
    expect(md).toContain("1 ping timeout");
    // The same reports give the same file, so a run with nothing new commits nothing.
    expect(renderReadme(rows)).toBe(md);
  });

  it("labels ping as the in-battle badge does", () => {
    expect(pingLabel(79)).toBe("79 ms 🟢");
    expect(pingLabel(80)).toBe("80 ms 🟡");
    expect(pingLabel(150)).toBe("150 ms 🔴");
    expect(pingLabel(undefined)).toBe("–");
  });
});
