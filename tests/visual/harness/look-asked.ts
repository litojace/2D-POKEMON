// The look picker (apps/client/src/ui-theme-picker.ts) opens once on the
// Lobby of an account that hasn't been asked for its look. Every spec's
// Lobby would get it, so the harness's account has been asked already,
// unless a test is about the picker: it sets `window.__lookAsk` before the
// page loads (tests/visual/ui-theme.spec.ts).
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
// The suite's specs were written against the look underneath: its sizes,
// places and colours. Players get Poster (ui-theme.ts, DEFAULT_UI_THEME);
// the specs keep the look they measure until they are moved over, by
// saving it as this device's choice. A spec about Poster asks for it in the
// address (`?ui=poster`, or VISUAL_UI=poster for any spec), which wins; a
// spec about the default sets `window.__lookDefault` before the page loads.
try {
  if (
    !(window as { __lookDefault?: boolean }).__lookDefault &&
    localStorage.getItem("ea-ui") === null
  )
    localStorage.setItem("ea-ui", "classic");
} catch {
  /* No storage: the default look shows. */
}
try {
  if (!(window as { __lookAsk?: boolean }).__lookAsk)
    localStorage.setItem(`ea-ui-asked:${ACCOUNT}`, "1");
} catch {
  /* No storage: the picker may show. */
}
