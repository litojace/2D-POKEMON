/**
 * The hub has scenes, switched in the middle of the top bar: the Lobby (one
 * screen, PLAY), the Plaza (the walkable world), the Farm and the Bistro
 * (a restaurant demo kept on this device). The choice is remembered on
 * this device.
 */
export type HubScene = "lobby" | "plaza" | "farm" | "bistro";
const KEY = "ea-hub-scene";
/** The Farm tab (hub redesign phase 4). */
export const FARM_OPEN = true;
export const HUB_SCENES: readonly { id: HubScene; label: string }[] = [
  { id: "lobby", label: "Lobby" },
  { id: "plaza", label: "Plaza" },
  { id: "farm", label: "Farm" },
  { id: "bistro", label: "Bistro" },
];
export function sceneAvailable(scene: HubScene) {
  return scene !== "farm" || FARM_OPEN;
}
export function savedHubScene(): HubScene {
  try {
    const value = localStorage.getItem(KEY) as HubScene | null;
    if (
      value &&
      HUB_SCENES.some((s) => s.id === value) &&
      sceneAvailable(value)
    )
      return value;
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
  return HUB_SCENES.filter((s) => sceneAvailable(s.id))
    .map(
      (s) =>
        `<button type="button" data-hub-scene="${s.id}" aria-pressed="${s.id === scene}">${s.label}</button>`,
    )
    .join("");
}
