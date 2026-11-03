import { playerLevel } from "../../../packages/shared/src/journey.js";
import {
  bossClears,
  raidLookOf,
  type RaidProgress,
} from "../../../packages/shared/src/raid.js";
import type { PlazaProfile } from "../../../packages/shared/src/plaza.js";
import type { AccountProvider } from "./accounts.js";
import type { PlazaWorld } from "./plaza.js";

/** Load only the authenticated account's saved cosmetics; Plaza input cannot grant looks. */
export class PlazaAppearance {
  private pending = new Map<string, symbol>();
  constructor(
    /** The Plaza, or anything else that keeps profiles by socket. */
    private plaza: Pick<PlazaWorld, "profileOf" | "updateProfile">,
    private accounts: Pick<AccountProvider, "rpc">,
  ) {}

  async refresh(key: string, token: string, includeLevel = false) {
    const initial = this.plaza.profileOf(key);
    if (!initial) return;
    const request = Symbol();
    this.pending.set(key, request);
    const { id, character } = initial;
    const apply = (patch: Partial<Omit<PlazaProfile, "id" | "bot">>) => {
      const current = this.plaza.profileOf(key);
      // A late result must not overwrite a newer wardrobe save, fighter, or Plaza visit.
      if (
        this.pending.get(key) !== request ||
        current?.id !== id ||
        current.character !== character
      )
        return;
      if (
        Object.entries(patch).some(
          ([field, value]) =>
            JSON.stringify(current[field as keyof PlazaProfile]) !==
            JSON.stringify(value),
        )
      )
        this.plaza.updateProfile(key, patch);
    };
    const read = (name: string) =>
      Promise.resolve().then(() => this.accounts.rpc(token, name, {}));
    // Cosmetic updates do not wait for the optional level lookup.
    const level = includeLevel
      ? read("arena_journey")
          .then((value) => {
            const xp = Number((value as { xp?: unknown } | null)?.xp);
            if (Number.isFinite(xp)) apply({ level: playerLevel(xp).level });
          })
          .catch(() => undefined)
      : Promise.resolve();
    try {
      const [skins, appearance] = await Promise.allSettled([
        read("arena_my_looks"),
        read("arena_raid_progress"),
      ]);
      const patch: Partial<Omit<PlazaProfile, "id" | "bot">> = {};
      if (skins.status === "fulfilled") {
        const look = (
          skins.value as Record<string, PlazaProfile["skin"]> | null
        )?.[character];
        patch.skin = look?.skin ? { skin: look.skin, stage: look.stage } : null;
      }
      if (appearance.status === "fulfilled") {
        patch.look = raidLookOf(appearance.value as RaidProgress | null);
        patch.raid = bossClears(appearance.value as RaidProgress | null);
      }
      apply(patch);
      await level;
    } finally {
      if (this.pending.get(key) === request) this.pending.delete(key);
    }
  }
}
