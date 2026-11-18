/**
 * The player avatar library (docs/hidden-picks.md, "Avatars"): who a player
 * is, shown wherever they are (seats, the player card, Friends), whatever
 * fighter they play. 25 anime avatars made for the game (Nov 2026, the
 * owner's pick of the second batch, docs/avatar-prompts.md): the 18
 * champions, 6 raid bosses and the Storm Twins together. The pictures are
 * 256 px WebP in apps/client/public/assets/avatars/<id>.webp, transparent
 * outside their circle; the frame is drawn by the game.
 *
 * Every avatar here is free. The id is what is saved (arena_profiles.avatar).
 */
import { z } from "zod";

export interface Avatar {
  id: string;
  name: string;
  kind: "champion" | "boss";
}

const LIST: [string, string, Avatar["kind"]][] = [
  ["ea-avatar-001", "Voltkit", "champion"],
  ["ea-avatar-002", "Cindrake", "champion"],
  ["ea-avatar-003", "Tidefin", "champion"],
  ["ea-avatar-004", "Auralynx", "champion"],
  ["ea-avatar-005", "Lumoth", "champion"],
  ["ea-avatar-006", "Mystowl", "champion"],
  ["ea-avatar-007", "Terradon", "champion"],
  ["ea-avatar-008", "Duskveil", "champion"],
  ["ea-avatar-009", "Coilemur", "champion"],
  ["ea-avatar-010", "Pyranda", "champion"],
  ["ea-avatar-011", "Glacelle", "champion"],
  ["ea-avatar-012", "Halcyra", "champion"],
  ["ea-avatar-013", "Sunbara", "champion"],
  ["ea-avatar-014", "Astrabun", "champion"],
  ["ea-avatar-015", "Wombolder", "champion"],
  ["ea-avatar-016", "Shadopus", "champion"],
  ["ea-avatar-017", "Pangrove", "champion"],
  ["ea-avatar-018", "Mossloth", "champion"],
  ["ea-avatar-019", "Cragmuff", "boss"],
  ["ea-avatar-020", "Tidelotl", "boss"],
  ["ea-avatar-021", "Inkpurr", "boss"],
  ["ea-avatar-022", "Snoozaku", "boss"],
  ["ea-avatar-023", "Prismell", "boss"],
  ["ea-avatar-024", "Lumiwick", "boss"],
  ["ea-avatar-025", "Storm Twins", "boss"],
];
export const AVATARS: readonly Avatar[] = LIST.map(([id, name, kind]) => ({
  id,
  name,
  kind,
}));
export const AVATAR_IDS = AVATARS.map((a) => a.id) as [string, ...string[]];
export const AVATAR_BY_ID: ReadonlyMap<string, Avatar> = new Map(
  AVATARS.map((a) => [a.id, a]),
);
/**
 * Avatars no longer in the library (the first library had 52: 026 Crackle
 * and the Anime 2D set, 027 to 052): a player who wore one is shown the
 * same character's avatar now, so nobody's choice is lost (no migration).
 */
export const RETIRED_AVATARS: ReadonlyMap<string, string> = new Map([
  ["ea-avatar-026", "ea-avatar-025"],
  ...Array.from({ length: 24 }, (_, i): [string, string] => [
    `ea-avatar-0${27 + i}`,
    `ea-avatar-${String(1 + i).padStart(3, "0")}`,
  ]),
  ["ea-avatar-051", "ea-avatar-025"],
  ["ea-avatar-052", "ea-avatar-025"],
]);
/** A new player's avatar until they choose one. */
export const DEFAULT_AVATAR = "ea-avatar-001";
/** What a player may choose: the library (a retired one is refused). */
export const avatarSchema = z.enum(AVATAR_IDS);

/**
 * Your own picture (migration 20261119110000): "photo:" and its id. The
 * game server serves it at /api/avatar-photo/<id> (a hidden or removed
 * one redirects to the default avatar).
 */
const PHOTO =
  /^photo:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
export const photoIdOf = (avatar: unknown) =>
  typeof avatar === "string" ? (PHOTO.exec(avatar)?.[1] ?? null) : null;
/** Pictures sent from a phone: 256 px square, at most this many bytes. */
export const PHOTO_SIZE = 256;
export const PHOTO_MAX_BYTES = 65536;
/** The biggest photo a player may pick on their device. */
export const PHOTO_SOURCE_MAX_BYTES = 10 * 1024 * 1024;

/** A saved avatar: a library one (retired ones too) or a picture. */
export const isAvatar = (id: unknown) =>
  typeof id === "string" &&
  (AVATAR_BY_ID.has(id) || RETIRED_AVATARS.has(id) || !!photoIdOf(id));
/**
 * The avatar to show for a saved value: a retired one's replacement, or
 * the default when it isn't an avatar.
 */
export const knownAvatar = (id: unknown) =>
  !isAvatar(id)
    ? DEFAULT_AVATAR
    : (RETIRED_AVATARS.get(id as string) ?? (id as string));
/**
 * Where the picture is served from: the client's public folder for the
 * library, the game server for a photo (prefix the server's origin).
 */
export const avatarUrl = (id: string) => {
  const photo = photoIdOf(id);
  if (photo) return `/api/avatar-photo/${photo}`;
  const shown = RETIRED_AVATARS.get(id) ?? id;
  return `/assets/avatars/${AVATAR_BY_ID.has(shown) ? shown : DEFAULT_AVATAR}.webp`;
};
