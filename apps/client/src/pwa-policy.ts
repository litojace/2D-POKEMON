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
