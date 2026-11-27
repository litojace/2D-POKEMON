// The look picker (apps/client/src/ui-theme-picker.ts) opens once on the
// Lobby of an account that hasn't been asked for its look. Every spec's
// Lobby would get it, so the harness's account has been asked already,
// unless a test is about the picker: it sets `window.__lookAsk` before the
// page loads (tests/visual/ui-theme.spec.ts).
const ACCOUNT = "11111111-1111-4111-8111-111111111111";
try {
  if (!(window as { __lookAsk?: boolean }).__lookAsk)
    localStorage.setItem(`ea-ui-asked:${ACCOUNT}`, "1");
} catch {
  /* No storage: the picker may show. */
}
