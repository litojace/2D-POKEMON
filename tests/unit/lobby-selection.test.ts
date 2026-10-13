import { expect, it } from "vitest";
import { LobbySelection } from "../../apps/client/src/lobby-selection";

it("keeps a pending choice through stale snapshots", () => {
  const selection = new LobbySelection();
  selection.choose("cindrake");
  expect(selection.reconcile("voltkit", true)).toBe("cindrake");
  expect(selection.reconcile("cindrake", true)).toBe("cindrake");
  expect(selection.reconcile("tidefin", true)).toBe("tidefin");
});

it("ignores older replies and intermediate snapshots during rapid selection", () => {
  const selection = new LobbySelection();
  const first = selection.choose("cindrake");
  const latest = selection.choose("tidefin");
  expect(selection.reject(first)).toBe(false);
  expect(selection.reconcile("cindrake", true)).toBe("tidefin");
  expect(selection.reject(latest)).toBe(true);
  expect(selection.reconcile("cindrake", true)).toBe("cindrake");
});

it("uses the authoritative fighter when a match starts or the room resets", () => {
  const selection = new LobbySelection();
  selection.choose("cindrake");
  expect(selection.reconcile("voltkit", false)).toBe("voltkit");
  selection.choose("tidefin");
  selection.reset();
  expect(selection.reconcile("voltkit", true)).toBe("voltkit");
});
