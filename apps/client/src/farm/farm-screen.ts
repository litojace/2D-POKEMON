import type { Economy } from "../../../../packages/shared/src/shop";
import type {
  FarmAction,
  FarmActResult,
  FarmEmote,
  FarmHere,
  FarmLikeResult,
  FarmTourEntry,
  FarmCup,
  FarmCupResult,
  FarmStall,
  FarmStallAction,
  FarmStallResult,
  FarmBalloon,
  FarmBalloonResult,
  FarmHelpList,
  FarmHelpResult,
  FarmFriend,
  FarmGiftResult,
  FarmGiftsState,
  FarmOrderResult,
  FarmState,
  FarmVisit,
  FarmVisitAction,
  FarmVisitResult,
} from "../../../../packages/shared/src/farm";
import { openFarm } from "./farm-scene";
import type { FarmCue } from "./farm-sound";

/**
 * The Farm scene of the hub (hub redesign phase 4): the typed entry point
 * for the ported farm scene. All state comes from the server; the scene only
 * draws it and sends actions.
 */
export interface FarmScreenOptions {
  load(): Promise<FarmState>;
  act(actions: FarmAction[]): Promise<FarmActResult>;
  /** Trade lots of 100 leaves for 5 coins each. */
  trade(lots: number): Promise<void>;
  toast(message: string): void;
  playerName(): string;
  /** The Lobby fighter: the farmer, whose perk the farm uses (migration 046). */
  character(): string;
  economy(): Economy | undefined;
  /** The leaf balance changed (top bar pill). */
  onLeaves(balance: number): void;
  /** Deliver or skip an order on the board (migration 040). */
  order(slot: number, kind: "deliver" | "skip"): Promise<FarmOrderResult>;
  /** A fighter's picture (who placed an order). */
  art(character: string): string;
  /** Buy a crop's next mastery star (migration 043). */
  master(crop: string): Promise<{
    farm: FarmState;
    ok: boolean;
    error?: string | null;
    stars?: number;
  }>;
  /** Today's wish at the well (migration 042). */
  wish(): Promise<{
    farm: FarmState;
    ok: boolean;
    error?: string;
    seeds?: string[];
  }>;
  /** Friends' farms (migration 047): the list, a visit, and acting there. */
  friends(): Promise<FarmFriend[]>;
  visit(id: string): Promise<FarmVisit>;
  visitAct(
    friend: string,
    actions: FarmVisitAction[],
  ): Promise<FarmVisitResult>;
  /** Gifts, friendship days and invites (migration 057). */
  gifts?(): Promise<FarmGiftsState>;
  giftSend?(friend: string): Promise<FarmGiftResult>;
  giftOpen?(friend: string): Promise<FarmGiftResult>;
  /** The Supply Balloon and friends' help (migration 058). */
  balloon?(): Promise<FarmBalloon>;
  balloonAct?(
    kind: "fill" | "ask" | "launch",
    slot?: number,
  ): Promise<FarmBalloonResult>;
  help?(): Promise<FarmHelpList>;
  helpFill?(friend: string, slot: number): Promise<FarmHelpResult>;
  /** The Farm Stall and the Valley Paper (migration 059). */
  stall?(): Promise<FarmStall>;
  stallAct?(action: FarmStallAction): Promise<FarmStallResult>;
  /** Co-ops and the weekly Valley Cup (migration 060). */
  cup?(): Promise<FarmCup>;
  cupAct?(
    kind: "create" | "join" | "leave" | "take" | "drop" | "claim",
    arg?: string,
  ): Promise<FarmCupResult>;
  /** Live visits, Harvest Parties and farm likes (migration 061). */
  here?(owner: string | null, emote?: FarmEmote): Promise<FarmHere>;
  gone?(): Promise<void>;
  tour?(): Promise<FarmTourEntry[]>;
  like?(owner: string): Promise<FarmLikeResult>;
  /** The farm invite link for a friend code. */
  inviteLink?(code: string): string;
  /** A farm sound effect (farm-sound.ts); `step` raises a harvest pop's pitch. */
  sound?(cue: FarmCue, step?: number): void;
  /** Rain on the farm: 0 off, 1 rain, 1.6 a storm. */
  rainSound?(level: number): void;
  reduced: boolean;
  /** Low graphics (Settings → Graphics): 30 fps, 1× canvas, no ambient animals. */
  low?: boolean;
}
export interface FarmScreen {
  refresh(): Promise<void>;
  close(): void;
}
export function openFarmScreen(options: FarmScreenOptions): FarmScreen {
  document.body.classList.add("hub-screen", "hub-farm");
  const scene = openFarm(options) as FarmScreen & { _dbg?: unknown };
  // Visual tests find plots through this (development builds only).
  if (import.meta.env.DEV)
    (window as unknown as { __farm?: unknown }).__farm = scene._dbg;
  return {
    refresh: () => scene.refresh(),
    close() {
      scene.close();
      document.body.classList.remove("hub-farm");
      if (!document.querySelector(".lobby-layer"))
        document.body.classList.remove("hub-screen");
    },
  };
}
