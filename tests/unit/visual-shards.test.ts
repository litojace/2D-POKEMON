import { describe, expect, it } from "vitest";
import {
  balance,
  durationsFromReport,
  grepFor,
  keyOf,
  testsIn,
} from "../../scripts/visual-shards.mjs";

// CI shards of the visual suite by recorded time (scripts/visual-shards.mjs).
const t = (file: string, title: string, describes: string[] = []) => ({
  file,
  title,
  describes,
});

describe("balancing", () => {
  const tests = [
    t("a.spec.ts", "long"),
    t("a.spec.ts", "mid"),
    t("b.spec.ts", "short one"),
    t("b.spec.ts", "short two"),
    t("c.spec.ts", "new test"),
    t("d.spec.ts", "same", ["desktop"]),
    t("d.spec.ts", "same", ["phone"]),
  ];
  const durations = {
    "a.spec.ts long": 300,
    "a.spec.ts mid": 120,
    "b.spec.ts short one": 30,
    "b.spec.ts short two": 30,
    "d.spec.ts desktop same": 20,
    "d.spec.ts same": 10, // an older key without the describe title
  };

  it("puts every test in exactly one shard", () => {
    for (const count of [1, 2, 3, 7]) {
      const shards = balance(tests, durations, count);
      expect(shards).toHaveLength(count);
      const placed = shards.flatMap((s) => s.tests.map(keyOf)).sort();
      expect(placed).toEqual(tests.map(keyOf).sort());
    }
  });

  it("evens out time: the longest goes alone, the rest fill the others", () => {
    const [a, b] = balance(tests, durations, 2);
    expect(a.tests.map((x) => x.title)).toEqual(["long"]);
    expect(a.seconds).toBe(300);
    // mid 120 + shorts 60 + new (median 30) + describes 20 and 10
    expect(b.seconds).toBe(240);
  });

  it("is the same every time for the same tests and durations", () => {
    const once = balance(tests, durations, 3).map((s) => s.tests.map(keyOf));
    const again = balance([...tests].reverse(), durations, 3).map((s) =>
      s.tests.map(keyOf),
    );
    expect(again).toEqual(once);
  });
});

describe("the --grep pattern", () => {
  it("matches each chosen test exactly, as Playwright tests it", () => {
    const chosen = [
      t("x.spec.ts", "fits at 844x390 (a+b)?"),
      t("d.spec.ts", "same", ["phone"]),
    ];
    const re = new RegExp(grepFor(chosen));
    expect(re.test(" x.spec.ts fits at 844x390 (a+b)?")).toBe(true);
    expect(re.test(" d.spec.ts phone same")).toBe(true);
    // A longer title ending the same way, another describe, another file.
    expect(re.test(" x.spec.ts the HUD fits at 844x390 (a+b)?")).toBe(false);
    expect(re.test(" d.spec.ts desktop same")).toBe(false);
    expect(re.test(" y.spec.ts fits at 844x390 (a+b)?")).toBe(false);
  });
});

describe("reports", () => {
  it("reads each test's passing attempt from a JSON report, describes included", () => {
    const report = {
      suites: [
        {
          title: "d.spec.ts",
          specs: [
            {
              file: "d.spec.ts",
              title: "flaky",
              tests: [
                {
                  results: [
                    { status: "failed", duration: 3700 },
                    { status: "passed", duration: 9240 },
                  ],
                },
              ],
            },
          ],
          suites: [
            {
              title: "phone",
              specs: [
                {
                  file: "d.spec.ts",
                  title: "same",
                  tests: [{ results: [{ status: "passed", duration: 1500 }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(testsIn(report).map(keyOf)).toEqual([
      "d.spec.ts flaky",
      "d.spec.ts phone same",
    ]);
    expect(durationsFromReport(report)).toEqual({
      "d.spec.ts flaky": 9.2,
      "d.spec.ts phone same": 1.5,
    });
  });
});
