// The title screen shows once per launch (title-screen.ts). Specs about
// other screens start past it, as a player who pressed Start; a spec about
// it sets window.__showTitle in an init script.
const w = window as unknown as { __showTitle?: boolean };
try {
  if (!w.__showTitle) sessionStorage.setItem("ea-title-passed", "1");
} catch {
  /* No storage: the client shows no title screen without it either. */
}
