import type { CharacterId } from "@arena/shared";
import {
  rosterMarkup,
  rosterView,
  type RosterData,
  type RosterView,
} from "../../apps/client/src/screens/roster-view";

/**
 * The roster's markup for checks that used to read the old room picker
 * (UI remodel step 5: the roster is the game's one fighter picker).
 */
export const rosterData = (extra: Partial<RosterData> = {}): RosterData => ({
  playing: "voltkit",
  matches: () => 0,
  owned: [],
  looks: {},
  keys: {
    skills: ["Q", "E", "R", "F"],
    basic: "LMB",
    dash: "RMB",
    jump: "SPACE",
  },
  ...extra,
});
/** The grid, picked on `focus` (optionally filtered by element). */
export const rosterGrid = (focus: CharacterId, element = "All") =>
  rosterMarkup(rosterView(focus, { element }), rosterData());
/** One fighter's detail on a tab (the Skills tab shows `skill` large). */
export const rosterDetail = (
  focus: CharacterId,
  extra: Partial<RosterView> = {},
) =>
  rosterMarkup(rosterView(focus, { mode: "detail", ...extra }), rosterData());
