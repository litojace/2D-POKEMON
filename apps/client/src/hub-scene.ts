/**
 * The hub has scenes, switched in the middle of the top bar: the Lobby (one
 * screen, PLAY) and the Plaza (the walkable world). The choice is remembered
 * on this device.
 */
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
/** The segmented scene switch for the top bar. */
export function sceneSwitchMarkup(scene: HubScene) {
  return HUB_SCENES.map(
    (s) =>
      `<button type="button" data-hub-scene="${s.id}" aria-pressed="${s.id === scene}">${s.label}</button>`,
  ).join("");
}
