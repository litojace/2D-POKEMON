export function safeToUpdate(phase: string | undefined) {
  return !phase || phase === "lobby" || phase === "finished";
}
export function peerMatchActive(
  records: { active: boolean; at: number }[],
  now: number,
) {
  return records.some((record) => record.active && now - record.at < 120000);
}
