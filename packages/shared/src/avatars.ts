/**
 * The player avatar library (docs/hidden-picks.md, "Avatars"): who a player
 * is, shown wherever they are (seats, the player card, Friends), whatever
 * fighter they play. 26 characters (the 18 champions and 8 raid bosses) in
 * two styles, Soft 3D and Anime 2D, made for the game (Nov 2026). The
 * pictures are 256 px WebP in apps/client/public/assets/avatars/<id>.webp,
 * transparent outside their circle; the frame is drawn by the game.
 *
 * Every avatar here is free. The id is what is saved (arena_profiles.avatar).
 */
import { z } from "zod";

export type AvatarStyle = "soft-3d" | "anime-2d";
export interface Avatar {
  id: string;
  name: string;
  style: AvatarStyle;
  kind: "champion" | "boss";
}

const LIST: [string, string, AvatarStyle, Avatar["kind"]][] = [
  ["ea-avatar-001", "Voltkit", "soft-3d", "champion"],
  ["ea-avatar-002", "Cindrake", "soft-3d", "champion"],
  ["ea-avatar-003", "Tidefin", "soft-3d", "champion"],
  ["ea-avatar-004", "Auralynx", "soft-3d", "champion"],
  ["ea-avatar-005", "Lumoth", "soft-3d", "champion"],
  ["ea-avatar-006", "Mystowl", "soft-3d", "champion"],
  ["ea-avatar-007", "Terradon", "soft-3d", "champion"],
  ["ea-avatar-008", "Duskveil", "soft-3d", "champion"],
  ["ea-avatar-009", "Coilemur", "soft-3d", "champion"],
  ["ea-avatar-010", "Pyranda", "soft-3d", "champion"],
  ["ea-avatar-011", "Glacelle", "soft-3d", "champion"],
  ["ea-avatar-012", "Halcyra", "soft-3d", "champion"],
  ["ea-avatar-013", "Sunbara", "soft-3d", "champion"],
  ["ea-avatar-014", "Astrabun", "soft-3d", "champion"],
  ["ea-avatar-015", "Wombolder", "soft-3d", "champion"],
  ["ea-avatar-016", "Shadopus", "soft-3d", "champion"],
  ["ea-avatar-017", "Pangrove", "soft-3d", "champion"],
  ["ea-avatar-018", "Mossloth", "soft-3d", "champion"],
  ["ea-avatar-019", "Cragmuff", "soft-3d", "boss"],
  ["ea-avatar-020", "Tidelotl", "soft-3d", "boss"],
  ["ea-avatar-021", "Inkpurr", "soft-3d", "boss"],
  ["ea-avatar-022", "Snoozaku", "soft-3d", "boss"],
  ["ea-avatar-023", "Prismell", "soft-3d", "boss"],
  ["ea-avatar-024", "Lumiwick", "soft-3d", "boss"],
  ["ea-avatar-025", "Fizz", "soft-3d", "boss"],
  ["ea-avatar-026", "Crackle", "soft-3d", "boss"],
  ["ea-avatar-027", "Voltkit", "anime-2d", "champion"],
  ["ea-avatar-028", "Cindrake", "anime-2d", "champion"],
  ["ea-avatar-029", "Tidefin", "anime-2d", "champion"],
  ["ea-avatar-030", "Auralynx", "anime-2d", "champion"],
  ["ea-avatar-031", "Lumoth", "anime-2d", "champion"],
  ["ea-avatar-032", "Mystowl", "anime-2d", "champion"],
  ["ea-avatar-033", "Terradon", "anime-2d", "champion"],
  ["ea-avatar-034", "Duskveil", "anime-2d", "champion"],
  ["ea-avatar-035", "Coilemur", "anime-2d", "champion"],
  ["ea-avatar-036", "Pyranda", "anime-2d", "champion"],
  ["ea-avatar-037", "Glacelle", "anime-2d", "champion"],
  ["ea-avatar-038", "Halcyra", "anime-2d", "champion"],
  ["ea-avatar-039", "Sunbara", "anime-2d", "champion"],
  ["ea-avatar-040", "Astrabun", "anime-2d", "champion"],
  ["ea-avatar-041", "Wombolder", "anime-2d", "champion"],
  ["ea-avatar-042", "Shadopus", "anime-2d", "champion"],
  ["ea-avatar-043", "Pangrove", "anime-2d", "champion"],
  ["ea-avatar-044", "Mossloth", "anime-2d", "champion"],
  ["ea-avatar-045", "Cragmuff", "anime-2d", "boss"],
  ["ea-avatar-046", "Tidelotl", "anime-2d", "boss"],
  ["ea-avatar-047", "Inkpurr", "anime-2d", "boss"],
  ["ea-avatar-048", "Snoozaku", "anime-2d", "boss"],
  ["ea-avatar-049", "Prismell", "anime-2d", "boss"],
  ["ea-avatar-050", "Lumiwick", "anime-2d", "boss"],
  ["ea-avatar-051", "Fizz", "anime-2d", "boss"],
  ["ea-avatar-052", "Crackle", "anime-2d", "boss"],
];
export const AVATARS: readonly Avatar[] = LIST.map(
  ([id, name, style, kind]) => ({
    id,
    name,
    style,
    kind,
  }),
);
export const AVATAR_IDS = AVATARS.map((a) => a.id) as [string, ...string[]];
export const AVATAR_BY_ID: ReadonlyMap<string, Avatar> = new Map(
  AVATARS.map((a) => [a.id, a]),
);
/** A new player's avatar until they choose one. */
export const DEFAULT_AVATAR = "ea-avatar-001";
export const AVATAR_STYLES: { id: AvatarStyle; name: string }[] = [
  { id: "soft-3d", name: "Soft 3D" },
  { id: "anime-2d", name: "Anime 2D" },
];
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

/** A library avatar or a picture. */
export const isAvatar = (id: unknown) =>
  typeof id === "string" && (AVATAR_BY_ID.has(id) || !!photoIdOf(id));
/** A saved value, or the default when it isn't one. */
export const knownAvatar = (id: unknown) =>
  isAvatar(id) ? (id as string) : DEFAULT_AVATAR;
/**
 * Where the picture is served from: the client's public folder for the
 * library, the game server for a photo (prefix the server's origin).
 */
export const avatarUrl = (id: string) => {
  const photo = photoIdOf(id);
  if (photo) return `/api/avatar-photo/${photo}`;
  return `/assets/avatars/${AVATAR_BY_ID.has(id) ? id : DEFAULT_AVATAR}.webp`;
};
