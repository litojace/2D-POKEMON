import type { Economy } from "../../../../packages/shared/src/shop";
import type {
  FarmAction,
  FarmActResult,
  FarmOrderResult,
  FarmState,
} from "../../../../packages/shared/src/farm";
import { openFarm } from "./farm-scene";

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
  reduced: boolean;
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
