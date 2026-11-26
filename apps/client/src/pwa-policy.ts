export function safeToUpdate(phase: string | undefined, menuOpen = false) {
  // Results still have active buttons and scroll position. Wait for the
  // player to return to the hub or a room lobby instead of reloading underneath a tap.
  return !menuOpen && (!phase || phase === "lobby");
}
export function peerMatchActive(
  records: { active: boolean; at: number }[],
  now: number,
) {
  return records.some((record) => record.active && now - record.at < 120000);
}
/**
 * A hub scene that is busy (the Plaza with its map, album or a player's card
 * open, or fishing) sets this attribute on its layer, and fires
 * {@link HUB_BUSY_EVENT} when it changes: the update ask waits, as it does
 * for a Lobby screen (pwa.ts).
 */
export const HUB_BUSY_ATTR = "data-hub-busy";
export const HUB_BUSY_EVENT = "hub-busy-change";
/** Typing in a text field (chat, a name): the update ask would take the
 * focus and close the keyboard mid-word, so it waits. */
export function typingIn(
  el: { tagName: string; type?: string; isContentEditable?: boolean } | null,
) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  return ["text", "search", "email", "url", "tel", "password", ""].includes(
    (el.type ?? "text").toLowerCase(),
  );
}
