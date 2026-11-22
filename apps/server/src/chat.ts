import {
  CHAT_LIMITS,
  quickKind,
  quickRefusal,
  quickSeenInBattle,
  quickText,
  typingRefusal,
  type ChatChannel,
  type ChatLine,
  type ChatMode,
  type ChatQuick,
} from "../../../packages/shared/src/chat.js";
import { filterChat } from "../../../packages/shared/src/chat-filter.js";
import {
  PLAZA_EMOTES,
  type PlazaEmote,
} from "../../../packages/shared/src/plaza.js";

/**
 * The Plaza's own emote for a quick line, if it has one: the Plaza shows it
 * over the sender's head through its snapshots, as before chat.
 */
export function plazaEmoteFor(quick: ChatQuick): PlazaEmote | null {
  const text = quickText(quick);
  return (PLAZA_EMOTES as readonly string[]).includes(text)
    ? (text as PlazaEmote)
    : null;
}

/**
 * In-game chat on the server (docs/chat-plan.md): pure state, no sockets,
 * so the rules are tested directly; server.ts works out who is in a channel
 * and delivers the lines this returns.
 *
 * Channels live in memory, like parties and rooms: a restart forgets them.
 * Each keeps its last CHAT_LIMITS.history lines for players who open the
 * chat late. Lines are never delivered between two players when either one
 * blocked the other, and a history read leaves those lines out too.
 */

/** A player as chat sees them. */
export interface ChatMember {
  accountId: string;
  name: string;
  guest: boolean;
  mode: ChatMode;
  /** Their team in a battle (rooms only). */
  team?: number;
  /** Watching the room, on no side (rooms only). */
  watcher?: boolean;
}
/** Where a line goes: worked out by the server from its own state. */
export interface ChatRoute {
  channel: ChatChannel;
  /** One channel instance: "party:AB12CD", "room:XYZ123", "place:plaza:1". */
  key: string;
  members: ChatMember[];
  /** The room's match is running (typing off, opponents see emotes only). */
  inBattle: boolean;
}
export type ChatSend =
  | { ok: true; line: ChatLine; deliver: string[] }
  | { ok: false; error: string };

interface Pace {
  lastTyped: number;
  lastQuick: number;
  typed: number[];
  lastText: string;
  lastTextAt: number;
}

export class ChatHub {
  private lines = new Map<string, ChatLine[]>();
  private paces = new Map<string, Pace>();
  /** Who each online account blocked (loaded from arena_blocks). */
  private blocked = new Map<string, Set<string>>();
  private nextId = 1;

  constructor(
    private options: {
      now?: () => number;
      /** Typed lines on (the CHAT_FREE_TEXT switch); quick chat always on. */
      freeText?: () => boolean;
      /**
       * Why this account may not type now (paused by reports, stopped by an
       * admin), or null. Quick chat stays open to them.
       */
      typingStopped?: (accountId: string) => string | null;
    } = {},
  ) {}

  /** Typed lines are on (quick chat is always on). */
  get freeText() {
    return this.options.freeText?.() ?? true;
  }

  private now() {
    return this.options.now?.() ?? Date.now();
  }

  /** The players this account blocked (replaces what was known). */
  setBlocks(accountId: string, ids: Iterable<string>) {
    this.blocked.set(accountId, new Set(ids));
  }
  /** Forget an account that went offline. */
  forget(accountId: string) {
    this.blocked.delete(accountId);
    this.paces.delete(accountId);
  }
  /** Either of the two blocked the other. */
  blocks(a: string, b: string) {
    return !!(this.blocked.get(a)?.has(b) || this.blocked.get(b)?.has(a));
  }

  /** Say something: a typed line (`text`) or a quick line (`quick`). */
  send(
    senderId: string,
    route: ChatRoute,
    input: { text?: unknown; quick?: unknown },
  ): ChatSend {
    const sender = route.members.find((m) => m.accountId === senderId);
    if (!sender) return { ok: false, error: "You're not in this chat." };
    const context = {
      channel: route.channel,
      inBattle: route.inBattle,
      guest: sender.guest,
      mode: sender.mode,
    };
    const now = this.now();
    const pace = this.pace(senderId);
    let line: ChatLine;
    if (input.quick !== undefined) {
      const kind = quickKind(input.quick);
      if (!kind) return { ok: false, error: "Unknown quick chat." };
      const quick = input.quick as ChatQuick;
      const refused = quickRefusal(context, quick);
      if (refused) return { ok: false, error: refused };
      // Calls ("Fall back"…) are a side's: a watcher has none.
      if (sender.watcher && kind === "call")
        return { ok: false, error: "Calls are for the players." };
      if (now - pace.lastQuick < CHAT_LIMITS.quickGapMs)
        return { ok: false, error: "Wait a moment." };
      pace.lastQuick = now;
      line = this.line(route, sender, now, { quick });
    } else {
      if (this.options.freeText && !this.options.freeText())
        return {
          ok: false,
          error: "Typing in chat is paused. Use quick chat.",
        };
      const refused = typingRefusal(context);
      if (refused) return { ok: false, error: refused };
      const stopped = this.options.typingStopped?.(senderId);
      if (stopped) return { ok: false, error: stopped };
      const filtered = filterChat(input.text);
      if (!filtered.ok) return filtered;
      pace.typed = pace.typed.filter((t) => now - t < CHAT_LIMITS.burstMs);
      if (
        now - pace.lastTyped < CHAT_LIMITS.typedGapMs ||
        pace.typed.length >= CHAT_LIMITS.typedBurst
      )
        return { ok: false, error: "You're sending messages too fast." };
      const same = filtered.text.toLowerCase();
      if (
        same === pace.lastText &&
        now - pace.lastTextAt < CHAT_LIMITS.repeatMs
      )
        return { ok: false, error: "You just said that." };
      pace.lastTyped = now;
      pace.typed.push(now);
      pace.lastText = same;
      pace.lastTextAt = now;
      line = this.line(route, sender, now, { text: filtered.text });
    }
    const deliver = route.members
      .filter((m) => this.sees(route, sender, m, line))
      .map((m) => m.accountId);
    if (!route.inBattle) this.keep(route.key, line);
    return { ok: true, line, deliver };
  }

  /** A channel's kept lines, as this account may see them. */
  history(key: string, viewerId: string): ChatLine[] {
    return (this.lines.get(key) ?? []).filter(
      (l) => !this.blocks(l.from.id, viewerId),
    );
  }

  /** A kept line of a channel, as this account sees it (for a report). */
  keptLine(key: string, id: number, viewerId: string) {
    return this.history(key, viewerId).find((l) => l.id === id);
  }

  /** A party ended, a room closed: its lines go. */
  drop(key: string) {
    this.lines.delete(key);
  }
  /** How many channels keep lines (tests, diagnostics). */
  get channels() {
    return this.lines.size;
  }

  private sees(
    route: ChatRoute,
    sender: ChatMember,
    m: ChatMember,
    line: ChatLine,
  ) {
    if (m.accountId === sender.accountId) return true;
    if (m.mode === "off" || this.blocks(sender.accountId, m.accountId))
      return false;
    if (!route.inBattle || !line.quick) return true;
    // A watcher's emotes and phrases reach everyone (they take no side, so
    // they give nothing away); what a side says stays with that side.
    if (sender.watcher) return true;
    const sameTeam = m.team !== undefined && m.team === sender.team;
    // Opponents who muted emotes hide them on their side.
    return quickSeenInBattle(line.quick, sameTeam, false);
  }

  private line(
    route: ChatRoute,
    sender: ChatMember,
    at: number,
    body: { text: string } | { quick: ChatQuick },
  ): ChatLine {
    return {
      id: this.nextId++,
      channel: route.channel,
      from: { id: sender.accountId, name: sender.name },
      at,
      ...(sender.watcher ? { watcher: true } : {}),
      ...body,
    };
  }

  private keep(key: string, line: ChatLine) {
    let list = this.lines.get(key);
    if (!list) this.lines.set(key, (list = []));
    list.push(line);
    if (list.length > CHAT_LIMITS.history) list.shift();
  }

  private pace(accountId: string) {
    let p = this.paces.get(accountId);
    if (!p)
      this.paces.set(
        accountId,
        (p = {
          lastTyped: -Infinity,
          lastQuick: -Infinity,
          typed: [],
          lastText: "",
          lastTextAt: -Infinity,
        }),
      );
    return p;
  }
}
