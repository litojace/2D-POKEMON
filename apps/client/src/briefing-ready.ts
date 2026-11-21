import { button as uiButton } from "./ui/components";

/** This device's progress with the arena, for a briefing's ready button. */
export type ArenaLoad = { loading: boolean; progress: number };
/**
 * A raid or Spire briefing's ready button: held while this device still
 * loads the arena (fighters, the boss, the illustrated floor), as the PvP
 * Reveal is, so the fight never starts on stand-ins. arenaLoading gives up
 * after its cap, so it never blocks for good.
 */
export function readyButton(
  waiting: boolean,
  arena: ArenaLoad | undefined,
  ready: string,
  aria: string,
) {
  const loading = !waiting && !!arena?.loading;
  const text = waiting
    ? "Waiting for the team…"
    : loading
      ? `Loading the arena · ${Math.round((arena?.progress ?? 0) * 100)}%`
      : ready;
  return uiButton(text, {
    kind: "primary",
    icon: waiting || loading ? undefined : "battle",
    disabled: waiting || loading,
    attrs: {
      id: "raid-instructions",
      "aria-label": waiting
        ? "Waiting for the team"
        : loading
          ? "Loading the arena"
          : aria,
    },
  });
}
