import { describe, expect, it } from "vitest";
import { DUE_HOURS, fullRunDue } from "../../scripts/full-run-due.mjs";

// A push to main starts main's full run when GitHub dropped the scheduled
// ones (CLAUDE.md, "Merging to main").
const now = Date.parse("2026-11-21T13:00:00Z");
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();

describe("fullRunDue", () => {
  it("is due when main never had a full run", () => {
    expect(fullRunDue([], now).due).toBe(true);
  });

  it("is due when the last one started three hours ago or more", () => {
    const r = fullRunDue(
      [
        { status: "completed", created_at: ago(DUE_HOURS) },
        { status: "completed", created_at: ago(9) },
      ],
      now,
    );
    expect(r).toEqual({
      due: true,
      why: "main's last full run started 3.0 h ago",
    });
  });

  it("is not due when one started less than three hours ago", () => {
    // The newest counts, in any order.
    expect(
      fullRunDue(
        [
          { status: "completed", created_at: ago(8) },
          { status: "completed", created_at: ago(2.5) },
        ],
        now,
      ).due,
    ).toBe(false);
  });

  it.each(["queued", "in_progress", "waiting", "requested", "pending"])(
    "is not due while one is %s, however old",
    (status) => {
      const r = fullRunDue(
        [
          { status, created_at: ago(6) },
          { status: "completed", created_at: ago(9) },
        ],
        now,
      );
      expect(r.due).toBe(false);
      expect(r.why).toContain("already waiting or running");
    },
  );
});
