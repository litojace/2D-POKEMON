import type { Fighter } from "../../../packages/shared/src/index.js";
import {
  bossClears,
  raidLookOf,
  type RaidProgress,
} from "../../../packages/shared/src/raid.js";
import type { AccountProvider } from "./accounts.js";
import { isAvatar } from "../../../packages/shared/src/avatars.js";

/** Room and battle snapshots use saved appearances, never client-supplied gear. */
export class FighterAppearance {
  private pending = new WeakMap<Fighter, symbol>();
  constructor(private accounts: Pick<AccountProvider, "rpc">) {}

  async refresh(
    fighter: Fighter,
    token: string,
    current: () => boolean,
    changed: () => void,
  ) {
    const request = Symbol();
    this.pending.set(fighter, request);
    const read = (name: string) =>
      Promise.resolve().then(() => this.accounts.rpc(token, name, {}));
    const [progress, skins, avatar] = await Promise.allSettled([
      read("arena_raid_progress"),
      read("arena_my_looks"),
      read("arena_my_avatar"),
    ]);
    if (this.pending.get(fighter) !== request || !current()) return;
    this.pending.delete(fighter);
    if (progress.status === "fulfilled") {
      fighter.raidLook = raidLookOf(progress.value as RaidProgress);
      fighter.raidClears = bossClears(progress.value as RaidProgress);
    }
    if (skins.status === "fulfilled")
      fighter.championLooks = (skins.value ?? {}) as Fighter["championLooks"];
    // The player's own avatar (who they are, whatever they play).
    if (avatar.status === "fulfilled")
      fighter.avatar = isAvatar(avatar.value)
        ? (avatar.value as string)
        : undefined;
    if (
      progress.status === "fulfilled" ||
      skins.status === "fulfilled" ||
      avatar.status === "fulfilled"
    )
      changed();
  }
}

/** Serialize saved portrait choices, so rapid champion switches cannot finish backwards. */
export class PortraitChoice {
  private pending = new Map<string, Promise<void>>();
  constructor(private accounts: Pick<AccountProvider, "rpc">) {}
  save(id: string, token: string, character: Fighter["character"]) {
    const task = (this.pending.get(id) ?? Promise.resolve())
      .then(() =>
        this.accounts.rpc(token, "arena_set_portrait_character", {
          p_character: character,
        }),
      )
      .then(
        () => {},
        () => {},
      );
    this.pending.set(id, task);
    void task.finally(() => {
      if (this.pending.get(id) === task) this.pending.delete(id);
    });
    return task;
  }
}
