/**
 * The hub has scenes, switched in the middle of the top bar: the Lobby (one
 * screen, PLAY) and the Plaza (the walkable world). The choice is remembered
 * on this device.
 */
import { featureLocked, lockBadge, lockedLabel } from "./feature-unlocks";

export type HubScene = "lobby" | "plaza";
const KEY = "ea-hub-scene";
export const HUB_SCENES: readonly { id: HubScene; label: string }[] = [
  { id: "lobby", label: "Lobby" },
  { id: "plaza", label: "Plaza" },
];
export function savedHubScene(): HubScene {
  try {
    const value = localStorage.getItem(KEY) as HubScene | null;
    // A scene that is gone (the Farm, the Bistro) opens the Lobby.
    if (value && HUB_SCENES.some((s) => s.id === value)) return value;
  } catch {
    /* Optional preference. */
  }
  return "lobby";
}
export function saveHubScene(scene: HubScene) {
  try {
    localStorage.setItem(KEY, scene);
  } catch {
    /* Optional preference. */
  }
}
/**
 * The segmented scene switch for the top bar. The Plaza opens by level
 * (feature-unlocks.ts): until then its tab wears the padlock.
 */
export function sceneSwitchMarkup(scene: HubScene, level?: number) {
  return HUB_SCENES.map((s) => {
    const locked = s.id === "plaza" && featureLocked("plaza", level);
    return `<button type="button" data-hub-scene="${s.id}" aria-pressed="${s.id === scene}"${locked ? ` class="is-locked" aria-label="${lockedLabel(s.label, "plaza")}"` : ""}>${s.label}${locked ? lockBadge("plaza") : ""}</button>`;
  }).join("");
}
