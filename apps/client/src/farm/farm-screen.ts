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
/*
 * The farm, ready before you open it: the last state the server sent (from
 * the farm's own loads and actions, or one background load when you reach
 * the hub), with the Supply Balloon and stall. It is kept in memory and in
 * this browser's storage, per player, until you log out or clear the site's
 * data, so the farm draws at once even after the browser was closed: moved
 * on by the time since it came, then refreshed from the server, which
 * always has the last word. Loading the farm counts as being on it (bugs
 * and crows can come if you were there in the last 150 s), so the
 * background load only runs when nothing is kept, once a session, and a
 * failed try is not repeated.
 */
type Kept = {
  owner: string;
  state?: FarmState;
  at: number;
  balloon?: FarmBalloon;
  stall?: FarmStall;
};
const STORE = "arena-farm:";
let ready: Kept | null = null;
const tried = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;
function stored(owner: string): Kept | null {
  try {
    const k = JSON.parse(localStorage.getItem(STORE + owner) ?? "null");
    return k?.v === 1 && k.state?.now
      ? { owner, state: k.state, at: k.at, balloon: k.balloon, stall: k.stall }
      : null;
  } catch {
    return null;
  }
}
function keptFor(owner: string | undefined): Kept | null {
  if (!owner) return null;
  if (ready?.owner !== owner) ready = stored(owner);
  return ready;
}
function keep(
  owner: string | undefined,
  patch: { state?: FarmState; balloon?: FarmBalloon; stall?: FarmStall },
) {
  if (!owner) return;
  if (patch.state && !patch.state.now) return;
  const prev = keptFor(owner) ?? { owner, at: 0 };
  ready = {
    ...prev,
    ...patch,
    at: patch.state ? Date.now() : prev.at,
  };
  // Written a moment later, so a burst of actions saves once.
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const k = ready;
    if (!k?.state) return;
    try {
      localStorage.setItem(
        STORE + k.owner,
        JSON.stringify({
          v: 1,
          at: k.at,
          state: k.state,
          balloon: k.balloon,
          stall: k.stall,
        }),
      );
    } catch {
      /* No storage, or it is full: memory still works this session. */
    }
  }, 400);
}
/** Fetch the farm in the background, once, when nothing is kept. */
export function prefetchFarm(
  owner: string,
  load: () => Promise<FarmState>,
): void {
  if (tried.has(owner) || keptFor(owner)?.state) return;
  tried.add(owner);
  load()
    .then((state) => {
      // The farm may have opened meanwhile and kept a newer state.
      if (!keptFor(owner)?.state) keep(owner, { state });
    })
    .catch(() => {});
}
/** Forget every kept farm (logging out). */
export function forgetFarms(): void {
  ready = null;
  tried.clear();
  clearTimeout(saveTimer);
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORE)) localStorage.removeItem(key);
    }
  } catch {
    /* No storage. */
  }
}
/** The kept farm for this owner, its clock moved on to now. */
function readyFor(owner: string | undefined): FarmState | undefined {
  const k = keptFor(owner);
  if (!k?.state) return undefined;
  return {
    ...k.state,
    now: new Date(Date.parse(k.state.now) + (Date.now() - k.at)).toISOString(),
  };
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
