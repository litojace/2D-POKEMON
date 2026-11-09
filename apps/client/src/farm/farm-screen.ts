import type { Economy } from "../../../../packages/shared/src/shop";
import type {
  FarmAction,
  FarmActResult,
  FarmEmote,
  FarmHere,
  FarmLikeResult,
  FarmTourEntry,
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
import { keep, keptFor, readyFor } from "./farm-cache";
export { forgetFarms, prefetchFarm } from "./farm-cache";
import type { FarmCue } from "./farm-sound";

/**
 * The Farm scene of the hub (hub redesign phase 4): the typed entry point
 * for the ported farm scene. All state comes from the server; the scene only
 * draws it and sends actions.
 */
export interface FarmScreenOptions {
  load(): Promise<FarmState>;
  /** Whose farm this is (the account id): keys the ready state below. */
  owner?: string;
  /** The farm as last known, drawn on the first frame (set by openFarmScreen). */
  initial?: FarmState;
  /** The Supply Balloon and stall as last known (set by openFarmScreen). */
  initialBalloon?: FarmBalloon;
  initialStall?: FarmStall;
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
  /** Pause it behind another hub scene, kept as it is. */
  hide(): void;
  /** Bring it back as you left it, then refresh. */
  show(): void;
  close(): void;
}
export function openFarmScreen(options: FarmScreenOptions): FarmScreen {
  document.body.classList.add("hub-screen", "hub-farm");
  const owner = options.owner;
  const scene = openFarm({
    ...options,
    initial: readyFor(owner),
    initialBalloon: keptFor(owner)?.balloon,
    initialStall: keptFor(owner)?.stall,
    load: async () => {
      const state = await options.load();
      keep(owner, { state });
      return state;
    },
    act: async (actions: FarmAction[]) => {
      const r = await options.act(actions);
      keep(owner, { state: r.farm });
      return r;
    },
    balloon:
      options.balloon &&
      (async () => {
        const balloon = await options.balloon!();
        keep(owner, { balloon });
        return balloon;
      }),
    balloonAct:
      options.balloonAct &&
      (async (...args: Parameters<NonNullable<typeof options.balloonAct>>) => {
        const r = await options.balloonAct!(...args);
        if (r.balloon) keep(owner, { balloon: r.balloon });
        return r;
      }),
    stall:
      options.stall &&
      (async () => {
        const stall = await options.stall!();
        keep(owner, { stall });
        return stall;
      }),
    stallAct:
      options.stallAct &&
      (async (action: FarmStallAction) => {
        const r = await options.stallAct!(action);
        keep(owner, { stall: r });
        return r;
      }),
  }) as FarmScreen & { _dbg?: unknown };
  // Visual tests find plots through this (development builds only).
  if (import.meta.env.DEV)
    (window as unknown as { __farm?: unknown }).__farm = scene._dbg;
  const away = () => {
    document.body.classList.remove("hub-farm");
    if (!document.querySelector(".lobby-layer"))
      document.body.classList.remove("hub-screen");
  };
  return {
    refresh: () => scene.refresh(),
    hide() {
      scene.hide();
      away();
    },
    show() {
      document.body.classList.add("hub-screen", "hub-farm");
      scene.show();
    },
    close() {
      scene.close();
      away();
    },
  };
}
/** The Farm's and the Plaza's shared sprite cache (released before a battle). */
export { GFX as hubGfx } from "./farm-gfx";
