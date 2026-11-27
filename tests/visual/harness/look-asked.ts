// The suite's specs were written against the look underneath: its sizes,
// places and colours. Players get Poster (ui-theme.ts, DEFAULT_UI_THEME);
// the specs keep the look they measure until they are moved over, by
// saving it as this device's choice. A spec about Poster asks for it in the
// address (`?ui=poster`, or VISUAL_UI=poster for any spec), which wins; a
// spec about the default sets `window.__lookDefault` before the page loads.
//
// VITE_VISUAL_LOOK=poster, set where the harness's server starts, runs the
// whole suite on Poster instead, whichever way a spec loads the page: the
// way to see what the suite says about the look players have, and the
// switch each migrated shard will flip.
const SUITE_LOOK: string =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_VISUAL_LOOK ?? "classic";
try {
  if (
    !(window as { __lookDefault?: boolean }).__lookDefault &&
    localStorage.getItem("ea-ui") === null
  )
    localStorage.setItem("ea-ui", SUITE_LOOK);
} catch {
  /* No storage: the default look shows. */
}
