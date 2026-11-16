/**
 * The chat filter (docs/chat-plan.md). The server runs it on every typed
 * line before anyone sees it; the client runs the same code only to warn
 * the writer first.
 *
 * - Words on the name filter's lists (name-filter.ts) are masked with *,
 *   the rest of the line is kept. Look-alikes and accents are read the same
 *   way (0→o, @→a, é→e), and letters split by dots or single spaces
 *   ("f.u.c.k", "f u c k") are read as one word.
 * - Links, email addresses and phone numbers are refused: chat isn't a way
 *   to move players somewhere else or to share contact details.
 * - Control, invisible and direction-changing characters are removed, runs
 *   of spaces become one, and a line is cut to CHAT_LIMITS.length.
 *
 * It catches the common cases, not every spelling: players report and block,
 * and admins can stop a player chatting.
 */
import { CHAT_LIMITS } from "./chat.js";
import {
  NAME_PART_WORDS,
  NAME_WHOLE_WORDS,
  nameLetters,
} from "./name-filter.js";

/** Name-only words: reserved for names ("Admin"), fine in a sentence. */
const NAME_ONLY = new Set([
  "admin",
  "administrator",
  "moderator",
  "official",
  "staff",
  "elementarena",
]);
// "kkkk" is laughter in some languages: in chat, "kkk" only as a word.
const PART = NAME_PART_WORDS.filter((w) => !NAME_ONLY.has(w) && w !== "kkk");
const WHOLE = [
  ...NAME_WHOLE_WORDS.filter((w) => !NAME_ONLY.has(w)),
  "kkk",
] as readonly string[];

export type ChatFilterResult =
  { ok: true; text: string; filtered: boolean } | { ok: false; error: string };

export const CHAT_NO_LINKS = "Links can't be sent in chat.";
export const CHAT_NO_CONTACT =
  "Email addresses and phone numbers can't be sent in chat.";

// Controls, zero-width and bidirectional marks, the BOM, tag characters.
const INVISIBLE =
  /[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁯﻿\u{e0000}-\u{e007f}]/gu;
const TLD =
  "com|net|org|gg|io|me|co|ly|xyz|app|link|tk|ru|vn|be|tv|info|biz|site|online|shop|club|top|cc|us|uk|gl";
// "site.com", or spelled out with spaces: "site (dot) com". A plain dot needs
// no space around it, so "home. Me too" stays a sentence.
const URL = new RegExp(
  `(https?:\\/\\/|www\\.|\\b[a-z0-9-]+(\\.|\\s?(\\(dot\\)|\\[dot\\])\\s?)(${TLD})\\b)`,
  "i",
);
const DISCORD = /\bdiscord\s*(\.\s*gg|app|\.com)?\s*\/\s*\w+/i;
const EMAIL =
  /[a-z0-9._%+-]+(@|\s?(\(at\)|\[at\])\s?)[a-z0-9-]+(\.|\s?(\(dot\)|\[dot\])\s?)[a-z]{2,}/i;

/**
 * A phone number: 7 or more digits written together or split by dashes,
 * dots or brackets ("555-1234", "(028) 3822.1234"), or 10 or more split by
 * spaces ("0912 345 678"). Scores like "100 200 300" stay allowed.
 */
function hasPhone(text: string) {
  const digits = (r: string) => r.replace(/\D/g, "").length;
  const tight = text.match(/\+?\(?\d[\d().-]*\d/g) ?? [];
  if (tight.some((r) => digits(r) >= 7)) return true;
  const spaced = text.match(/\+?\(?\d[\d\s().-]*\d/g) ?? [];
  return spaced.some((r) => digits(r) >= 10);
}

/** Whether a word (letters only, read as the name filter reads) is rude. */
function rude(letters: string) {
  if (!letters) return false;
  if (PART.some((w) => letters.includes(w))) return true;
  return WHOLE.some((w) => letters === w || letters === `${w}s`);
}

/** Clean, check and mask one typed line. */
export function filterChat(raw: unknown): ChatFilterResult {
  if (typeof raw !== "string") return { ok: false, error: "Type a message." };
  let text = raw.normalize("NFC").replace(INVISIBLE, "");
  text = text.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "Type a message." };
  if ([...text].length > CHAT_LIMITS.length)
    text = [...text].slice(0, CHAT_LIMITS.length).join("").trim();
  // An email address holds a domain: check it before links.
  if (EMAIL.test(text) || hasPhone(text))
    return { ok: false, error: CHAT_NO_CONTACT };
  if (URL.test(text) || DISCORD.test(text))
    return { ok: false, error: CHAT_NO_LINKS };

  // Words split on spaces; each one's letters, read as the name filter does.
  const tokens = text.split(" ");
  const letters = tokens.map((t) => nameLetters(t).replace(/[^a-z]/g, ""));
  const masked = new Array<boolean>(tokens.length).fill(false);
  for (let i = 0; i < tokens.length; i++)
    if (rude(letters[i])) masked[i] = true;
  // Single letters in a row ("f u c k") read as one word.
  for (let i = 0; i < tokens.length;) {
    if (letters[i].length !== 1) {
      i++;
      continue;
    }
    let j = i;
    while (j < tokens.length && letters[j].length === 1) j++;
    if (j - i > 1 && rude(letters.slice(i, j).join("")))
      for (let k = i; k < j; k++) masked[k] = true;
    i = j;
  }
  const filtered = masked.some(Boolean);
  if (filtered)
    text = tokens
      .map((t, i) => (masked[i] ? "*".repeat(Math.min(8, [...t].length)) : t))
      .join(" ");
  return { ok: true, text, filtered };
}
