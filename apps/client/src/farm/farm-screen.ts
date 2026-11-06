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
  close(): void;
}
/*
 * The farm, ready before you open it: the last state the server sent this
 * session (from a prefetch when you reach the hub, or from the farm's own
 * loads and actions while you play). Opening the farm draws it on the first
 * frame, moved on by the time since it came, then refreshes from the server.
 * Loading the farm counts as being on it (bugs and crows can come if you
 * were there in the last 150 s), so it is fetched once a session at most
 * unless you open the farm (a failed try is not repeated).
 */
let ready: { owner: string; state: FarmState; at: number } | null = null;
const tried = new Set<string>();
function keep(owner: string | undefined, state: FarmState | undefined) {
  if (owner && state?.now) ready = { owner, state, at: Date.now() };
}
/** Fetch the farm in the background, once, so it opens ready. */
export function prefetchFarm(
  owner: string,
  load: () => Promise<FarmState>,
): void {
  if (tried.has(owner) || ready?.owner === owner) return;
  tried.add(owner);
  load()
    .then((state) => {
      // The farm may have opened meanwhile and kept a newer state.
      if (ready?.owner !== owner) keep(owner, state);
    })
    .catch(() => {});
}
/** The ready farm for this owner, its clock moved on to now. */
function readyFor(owner: string | undefined): FarmState | undefined {
  if (!owner || ready?.owner !== owner) return undefined;
  const { state, at } = ready;
  return {
    ...state,
    now: new Date(Date.parse(state.now) + (Date.now() - at)).toISOString(),
  };
}
export function openFarmScreen(options: FarmScreenOptions): FarmScreen {
  document.body.classList.add("hub-screen", "hub-farm");
  const owner = options.owner;
  const scene = openFarm({
    ...options,
    initial: readyFor(owner),
    load: async () => {
      const state = await options.load();
      keep(owner, state);
      return state;
    },
    act: async (actions: FarmAction[]) => {
      const r = await options.act(actions);
      keep(owner, r.farm);
      return r;
    },
  }) as FarmScreen & { _dbg?: unknown };
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
