/**
 * In-game chat: the channels, the quick-chat catalogue and the limits, shared
 * by the server (the judge) and the client (docs/chat-plan.md).
 *
 * Quick chat travels as an id ("gg", "wave"), never as text: the server
 * checks the id against this list, so a quick line needs no filter, stays
 * tiny on the wire, and reads the same for everyone.
 *
 * Who may type:
 * - party, room and friend: players with an account (not guests) whose chat
 *   setting is "free", outside a battle;
 * - place (the Plaza): quick chat only, as these are strangers;
 * - in a battle: quick chat only; opponents see emotes, not phrases.
 */

/**
 * team: a 2v2 room's own side only (docs/hidden-picks.md: agree on picks
 * the other team can't read); room: everyone in the room, both teams.
 */
export type ChatChannel = "party" | "team" | "room" | "place" | "friend";
export const CHAT_CHANNELS: readonly ChatChannel[] = [
  "party",
  "team",
  "room",
  "place",
  "friend",
];

/** free: type and quick chat; quick: quick chat only; off: nothing shown. */
export type ChatMode = "free" | "quick" | "off";
export const CHAT_MODES: readonly ChatMode[] = ["free", "quick", "off"];

export const CHAT_LIMITS = {
  /** Characters in a typed line. */
  length: 120,
  /** Lines kept per channel (server memory, client list). */
  history: 50,
  /** A typed line at most this often (ms)... */
  typedGapMs: 1200,
  /** ...and at most `typedBurst` typed lines in `burstMs`. */
  typedBurst: 6,
  burstMs: 10_000,
  /** A quick line at most this often (ms), as the Plaza's emotes. */
  quickGapMs: 1000,
  /** The same typed line can't be sent again for this long (ms). */
  repeatMs: 30_000,
} as const;

/** Emotes: shown over the sender's head, and seen by opponents in battle. */
export const CHAT_EMOTES = {
  wave: "👋",
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  clap: "👏",
  dance: "💃",
  cool: "😎",
  party: "🎉",
  smile: "😄",
  sparkle: "💫",
} as const;
/** Phrases anyone may use anywhere. */
export const CHAT_PHRASES = {
  hi: "Hi!",
  gg: "GG",
  thanks: "Thanks!",
  wp: "Well played!",
  nice: "Nice!",
  oops: "Oops",
  ready: "Ready!",
  go: "Let's go!",
  again: "One more?",
  wait: "Wait for me",
  brb: "BRB",
} as const;
/** Calls for teammates in a battle. */
export const CHAT_CALLS = {
  attack: "Attack!",
  back: "Fall back",
  help: "Help me",
  omw: "On my way",
  group: "Group up",
  careful: "Careful!",
} as const;

export type ChatEmote = keyof typeof CHAT_EMOTES;
export type ChatQuick =
  ChatEmote | keyof typeof CHAT_PHRASES | keyof typeof CHAT_CALLS;
export type ChatQuickKind = "emote" | "phrase" | "call";

const own = (o: object, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

/** What kind of quick line an id is, or null when it isn't one. */
export function quickKind(id: unknown): ChatQuickKind | null {
  if (typeof id !== "string") return null;
  if (own(CHAT_EMOTES, id)) return "emote";
  if (own(CHAT_PHRASES, id)) return "phrase";
  if (own(CHAT_CALLS, id)) return "call";
  return null;
}

/** The text of a quick line (the emoji for an emote). */
export function quickText(id: ChatQuick): string {
  const all: Record<string, string> = {
    ...CHAT_EMOTES,
    ...CHAT_PHRASES,
    ...CHAT_CALLS,
  };
  return all[id];
}

/** Where a line is said, from the sender's side. */
export interface ChatContext {
  channel: ChatChannel;
  /** The sender is in a battle (the room's match is running). */
  inBattle: boolean;
  /** The sender plays as a guest. */
  guest: boolean;
  /** The sender's chat setting. */
  mode: ChatMode;
}

/** Why a sender may not type here, or null when they may. */
export function typingRefusal(c: ChatContext): string | null {
  if (c.mode === "off") return "Chat is off in your settings.";
  if (c.guest) return "Make an account to type in chat.";
  if (c.mode === "quick") return "Your chat is set to quick chat only.";
  if (c.channel === "place") return "Here you can use quick chat.";
  if (c.inBattle) return "Use quick chat in a battle.";
  return null;
}

/** Why a sender may not send this quick line here, or null when they may. */
export function quickRefusal(c: ChatContext, id: ChatQuick): string | null {
  if (c.mode === "off") return "Chat is off in your settings.";
  // Calls are for a battle (teammates in a room).
  if (
    quickKind(id) === "call" &&
    !((c.channel === "room" || c.channel === "team") && c.inBattle)
  )
    return "Calls are for battles.";
  return null;
}

/**
 * Whether a receiver sees a quick line in a battle: teammates see all of it,
 * opponents only emotes (and none once they muted opponents' emotes).
 */
export function quickSeenInBattle(
  id: ChatQuick,
  sameTeam: boolean,
  opponentsMuted: boolean,
) {
  if (sameTeam) return true;
  return quickKind(id) === "emote" && !opponentsMuted;
}

/** One line of chat as the server sends it. */
export interface ChatLine {
  /** Increasing per server run; the client drops lines it has seen. */
  id: number;
  channel: ChatChannel;
  from: { id: string; name: string };
  /** Milliseconds since 1970 (server clock). */
  at: number;
  /** A typed line, after the filter. */
  text?: string;
  /** A quick line's id. */
  quick?: ChatQuick;
  /** In a room: the speaker's fighter, for a bubble over them in battle. */
  fighter?: string;
  /** In a room: the speaker is watching it (no fighter, no side). */
  watcher?: boolean;
  /** Between friends: who it was sent to. */
  to?: string;
}
