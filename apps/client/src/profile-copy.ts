import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  accountSchema,
  type Account,
} from "../../../packages/shared/src/accounts";
import { isAvatar } from "../../../packages/shared/src/avatars";
import type { Economy } from "../../../packages/shared/src/shop";
import type {
  RaidBossId,
  RaidLoadout,
} from "../../../packages/shared/src/raid";
import type { SpireProgress } from "../../../packages/shared/src/spire";

/**
 * The player's profile as this device last saw it: what the first screen
 * shows (name and title, coins, worn skins and raid look, Journey and
 * missions cards, avatar, the fighter kept with the account). The next start
 * draws the hub from it at once while the server's fresh copy loads
 * (docs/loading-screens.md), so the startup curtain need not wait for the
 * profile's round trips. One account per device: signing out forgets it.
 */
export type ProfileCopy = {
  account: Account;
  economy?: Economy;
  raidLook?: RaidLoadout;
  raidClears: Partial<Record<RaidBossId, number>>;
  spire: SpireProgress | null;
  avatar: string | null;
  /** The fighter the account keeps (null: none saved, undefined: unknown). */
  fighter?: CharacterId | null;
};

export const PROFILE_COPY_KEY = "ea-profile-copy";
/** Bumped when the stored shape changes: an older copy is ignored. */
export const PROFILE_COPY_VERSION = 1;
/** A copy older than this is too stale to show (a month away). */
export const PROFILE_COPY_MAX_AGE_MS = 30 * 86_400_000;

type Stored = ProfileCopy & { v: number; id: string; savedAt: number };

const storage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // Storage blocked (private browsing).
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** The minimum the hub reads from the Shop record without crashing. */
const looksLikeEconomy = (value: unknown): value is Economy =>
  isRecord(value) &&
  typeof value.balance === "number" &&
  isRecord(value.looks) &&
  Array.isArray(value.owned) &&
  Array.isArray(value.missions);

/** This account's copy, if one is kept, fresh enough and well formed. */
export function readProfileCopy(
  accountId: string,
  now = Date.now(),
): ProfileCopy | null {
  try {
    const raw = storage()?.getItem(PROFILE_COPY_KEY);
    if (!raw) return null;
    const kept = JSON.parse(raw) as Partial<Stored>;
    if (
      !isRecord(kept) ||
      kept.v !== PROFILE_COPY_VERSION ||
      kept.id !== accountId ||
      typeof kept.savedAt !== "number" ||
      now - kept.savedAt > PROFILE_COPY_MAX_AGE_MS ||
      kept.savedAt > now + 60_000
    )
      return null;
    const account = accountSchema.safeParse(kept.account);
    if (!account.success || account.data.id !== accountId) return null;
    const fighter =
      kept.fighter === null
        ? null
        : typeof kept.fighter === "string" &&
            Object.hasOwn(CHARACTERS, kept.fighter)
          ? kept.fighter
          : undefined;
    return {
      account: account.data,
      economy: looksLikeEconomy(kept.economy) ? kept.economy : undefined,
      raidLook: isRecord(kept.raidLook)
        ? (kept.raidLook as RaidLoadout)
        : undefined,
      raidClears: isRecord(kept.raidClears)
        ? (kept.raidClears as ProfileCopy["raidClears"])
        : {},
      spire: isRecord(kept.spire) ? (kept.spire as SpireProgress) : null,
      avatar:
        typeof kept.avatar === "string" && isAvatar(kept.avatar)
          ? kept.avatar
          : null,
      fighter,
    };
  } catch {
    return null; // Unreadable: the server's copy is coming anyway.
  }
}

export function keepProfileCopy(copy: ProfileCopy, now = Date.now()) {
  const stored: Stored = {
    ...copy,
    v: PROFILE_COPY_VERSION,
    id: copy.account.id,
    savedAt: now,
  };
  try {
    storage()?.setItem(PROFILE_COPY_KEY, JSON.stringify(stored));
  } catch {
    /* Full or blocked storage: the next start loads from the server. */
  }
}

export function forgetProfileCopy() {
  try {
    storage()?.removeItem(PROFILE_COPY_KEY);
  } catch {
    /* Blocked storage holds no copy. */
  }
}
