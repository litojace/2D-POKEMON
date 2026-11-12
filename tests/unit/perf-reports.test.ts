import { describe, expect, it } from "vitest";
import {
  attention,
  newestBuild,
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
    expect(md).toContain("| 2026-11-11 | 2 | 1 |"); // the 200 ms ping needs attention
    expect(md).toContain("1 ping timeout");
    // The same reports give the same file, so a run with nothing new commits nothing.
    expect(renderReadme(rows)).toBe(md);
  });

  it("shows the network numbers each match reports", () => {
    const r = toReport(
      entry(
        'arena-perf {"fps":58.8,"ping":65,"rttP50":67,"rttP95":74,"snapGapP95":76,"snapLate":0.002,"corrections":205.1,"correctionMax":33,"confirmP50":112,"lead":211,"mode":"duel","bots":1,"character":"cindrake"}',
      ),
    );
    expect(r).toMatchObject({
      rttP50: 67,
      corrections: 205.1,
      confirmP50: 112,
    });
    const md = renderReadme([r]);
    expect(md).toContain(
      "| 67 ms 🟢 (74) | 211 ms | 0.2% | 205.1/min (max 33 px) | – | 112 ms |",
    );
    expect(md).toContain(
      "| 2026-11-11 | 1 | 0 | 67 ms | 67 ms | 211 ms | 205.1 | 112 ms |",
    );
    expect(md).toContain("Nothing in the latest 50 matches.");
  });

  it("shows who you fought, the build, the device and the match tag", () => {
    const r = toReport(
      entry(
        'arena-perf {"fps":58.8,"rttP50":67,"rttP95":74,"corrections":40,"correctionMax":60,"correctionsHit":38,"correctionsOther":2,"hitsFar":0,"hitGapMax":12,"errors":0,"build":"2f04ba3","os":"ios","app":true,"cores":4,"mode":"duel","bots":1,"botLevel":"normal","opponents":["tidefin"],"match":"k3x9qa","character":"cindrake"}',
      ),
    );
    const md = renderReadme([r]);
    expect(md).toContain(
      "| `k3x9qa` | duel vs bot | cindrake | tidefin (bot, normal) |",
    );
    expect(md).toContain("40/min (max 60 px), ⚠️ 2 unexplained | 0 |");
    expect(md).toContain("| ios app, 4 cores | 2f04ba3 |");
  });

  it("flags what needs looking into, with where to start", () => {
    const base = {
      id: "x",
      at: "2026-11-11T05:00:00Z",
      kind: "arena-perf",
      character: "cindrake",
      opponents: ["tidefin"],
    };
    expect(attention({ ...base, rttP50: 60, rttP95: 70, fps: 58.8 })).toEqual(
      [],
    );
    const issues = attention({
      ...base,
      rttP50: 120,
      rttP95: 240,
      snapLate: 0.08,
      fps: 38,
      jank: 0.12,
      stalls: 4,
      correctionsOther: 6,
      hitsFar: 3,
      hitGapMax: 70,
      errors: 2,
      confirmP50: 400,
    }).join("\n");
    expect(issues).toContain("slow connection: ping 120 ms, slowest 5% 240 ms");
    expect(issues).toContain("8.0% of the server's updates came late");
    expect(issues).toContain("drawing slow: 38 fps, 12.0% stutter");
    expect(issues).toContain("4 freezes over 250 ms");
    expect(issues).toContain(
      "npx tsx scripts/perf/correction-sim.ts 120 60 cindrake tidefin",
    );
    expect(issues).toContain(
      "3 hit(s) landed while you were drawn over 24 px away (largest 70 px)",
    );
    expect(issues).toContain("2 script error(s)");
    expect(issues).toContain(
      "skills took 400 ms to confirm with a 120 ms ping",
    );
  });

  it("spots a phone still running an old build", () => {
    // b was deployed at 02:00; a phone still on a reports after it.
    const rows = [
      {
        id: "1",
        at: "2026-11-11T01:00:00Z",
        kind: "arena-perf",
        build: "aaaaaaa",
      },
      {
        id: "2",
        at: "2026-11-11T02:00:00Z",
        kind: "arena-perf",
        build: "bbbbbbb",
      },
      {
        id: "3",
        at: "2026-11-11T03:00:00Z",
        kind: "arena-perf",
        build: "aaaaaaa",
      },
    ];
    const newest = newestBuild(rows);
    // Not the build of the newest report (that is the stale phone's).
    expect(newest).toEqual({ build: "bbbbbbb", since: "2026-11-11T02:00:00Z" });
    expect(attention(rows[2], newest).join()).toContain(
      "old build aaaaaaa (the newest is bbbbbbb)",
    );
    // Before the new build existed, the old one was simply current.
    expect(attention(rows[0], newest)).toEqual([]);
    expect(attention(rows[1], newest)).toEqual([]);
    expect(
      newestBuild([{ id: "4", at: "x", kind: "arena-perf", build: "dev" }]),
    ).toBeUndefined();
  });

  it("labels ping as the in-battle badge does", () => {
    expect(pingLabel(79)).toBe("79 ms 🟢");
    expect(pingLabel(80)).toBe("80 ms 🟡");
    expect(pingLabel(150)).toBe("150 ms 🔴");
    expect(pingLabel(undefined)).toBe("–");
  });
});
