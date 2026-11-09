import type { Socket } from "socket.io-client";
import type { CharacterId, Reply } from "@arena/shared";
import type { PlazaProgress } from "../../../../packages/shared/src/plaza";
import { openPlaza } from "./plaza-scene";

/**
 * The Plaza scene of the hub (hub redesign phase 3): the typed entry point
 * for the ported scene. The game server moves everyone and owns the ball,
 * the Orb Shower, laps, quests and Volt Boba; the scene draws what it sends
 * and predicts only your own steps.
 */
export interface PlazaScreenOptions {
  socket: Socket;
  character: CharacterId;
  skin: { skin: string; stage?: number } | null;
  /** An image URL for a fighter in a skin (canvas sprite); `flat` leaves
   * out the masked overlays some browsers draw wrong (plaza-sprite.ts). */
  art(
    character: string,
    skin: { skin: string; stage?: number } | null,
    flat?: boolean,
  ): string;
  skinName(skin: string): string | null;
  fighterName(character: string): string;
  playerName(): string;
  loadProgress(): Promise<PlazaProgress>;
  goFarm(): void;
  toast(message: string): void;
  onLeaves(balance: number): void;
  /** Add a player you tapped as a friend, or invite them to your party. */
  onPlayer(action: "friend" | "party", accountId: string): Promise<void>;
  /** The server closed the Plaza (a room opened) or refused the join. */
  onClose(failed: boolean): void;
  /** Fewer particles (reduced motion). */
  reduced: boolean;
  /** Low graphics: no ambient animals or night glow, 30 fps. */
  low: boolean;
}
export interface PlazaScreen {
  /** Behind another hub scene: off the Plaza on the server, kept here. */
  hide(): void;
  /** Back on the Plaza: shown at once, joined again (where you stood). */
  show(): void;
  look(
    character: CharacterId,
    skin: { skin: string; stage?: number } | null,
  ): void;
  close(): void;
}
export function openPlazaScreen(options: PlazaScreenOptions): PlazaScreen {
  document.body.classList.add("hub-screen", "hub-plaza");
  const scene = openPlaza(options) as {
    look(character: string, skin: unknown): void;
    hide(): void;
    show(): void;
    close(): void;
    _dbg?: unknown;
  };
  scene.look(options.character, options.skin);
  // Visual tests read positions through this (development builds only).
  if (import.meta.env.DEV)
    (window as unknown as { __plaza?: unknown }).__plaza = scene._dbg;
  let closed = false,
    away = false;
  const finish = (failed: boolean, tellServer: boolean) => {
    if (closed) return;
    closed = true;
    options.socket.off("plaza-closed", onServerClose);
    options.socket.off("connect", rejoin);
    if (tellServer && !away) options.socket.emit("plaza-leave", {}, () => {});
    scene.close();
    document.body.classList.remove("hub-plaza");
    if (
      !document.querySelector(".lobby-layer") &&
      !document.querySelector(".farm-layer")
    )
      document.body.classList.remove("hub-screen");
    options.onClose(failed);
  };
  const onServerClose = () => finish(false, false);
  let character = options.character;
  const join = () =>
    options.socket.emit(
      "plaza-join",
      { character },
      (reply: Reply | undefined) => {
        if (!reply?.ok) {
          options.toast(reply?.error ?? "The Plaza is busy. Try again soon.");
          finish(true, false);
        }
      },
    );
  // A dropped connection loses your place: join again when it is back.
  const rejoin = () => join();
  options.socket.on("plaza-closed", onServerClose);
  options.socket.on("connect", rejoin);
  join();
  return {
    look(next, skin) {
      scene.look(next, skin);
      character = next;
      // The server reloads the saved skin and wardrobe itself.
      options.socket.emit("plaza-look", { character: next }, () => {});
    },
    hide() {
      if (closed || away) return;
      away = true;
      // Others must not see you standing there: leave the Plaza (the server
      // keeps your spot for a while), and don't rejoin on a reconnect.
      options.socket.off("connect", rejoin);
      options.socket.emit("plaza-leave", {}, () => {});
      scene.hide();
      document.body.classList.remove("hub-plaza");
      if (
        !document.querySelector(".lobby-layer") &&
        !document.querySelector(".farm-layer:not([style*='display: none'])")
      )
        document.body.classList.remove("hub-screen");
    },
    show() {
      if (closed || !away) return;
      away = false;
      document.body.classList.add("hub-screen", "hub-plaza");
      scene.show();
      options.socket.on("connect", rejoin);
      join();
    },
    close: () => finish(false, true),
  };
}
/** The Farm's and the Plaza's shared sprite cache (released before a battle). */
export { GFX as hubGfx } from "../farm/farm-gfx";
