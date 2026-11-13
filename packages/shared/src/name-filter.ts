/**
 * The player-name filter (migration 110). The database is the judge: a
 * trigger on arena_profiles refuses a new name that matches this list (and
 * turns one picked at sign-up into "Trainer"). This copy only lets the
 * client say so before it asks; tests/integration/name-filter.test.ts
 * checks that the two lists and the two checks agree.
 *
 * How a name is checked:
 * - lower case, common accents taken off, look-alike digits and symbols
 *   read as letters (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s, !→i);
 * - a "part" word is refused anywhere in the name with everything but
 *   letters removed, so spaces and dots can't split it ("f.u c k");
 * - a "whole" word is refused only as a word of its own (or with an "s"),
 *   so ordinary words that contain it ("class", "peacock", "grape",
 *   "therapist", "Nazir") stay allowed.
 *
 * It catches the common cases, not every spelling; players can still
 * report a name, and admins rename players.
 */

/** Refused anywhere in the name once spaces and symbols are removed. */
export const NAME_PART_WORDS = [
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "tranny",
  "wetback",
  "fuck",
  "shit",
  "cunt",
  "bitch",
  "whore",
  "slut",
  "porn",
  "penis",
  "vagina",
  "dildo",
  "jizz",
  "blowjob",
  "handjob",
  "asshole",
  "pedophile",
  "paedophile",
  "molest",
  "hitler",
  "kkk",
  "elementarena",
] as const;

/** Refused only as a word of its own (or the same word with an "s"). */
export const NAME_WHOLE_WORDS = [
  "ass",
  "arse",
  "cock",
  "dick",
  "pussy",
  "fag",
  "cum",
  "rape",
  "rapist",
  "nazi",
  "pedo",
  "spic",
  "coon",
  "chink",
  "kike",
  "gook",
  "dyke",
  "twat",
  "tit",
  "tits",
  "boob",
  "boobs",
  "sex",
  "anal",
  "wank",
  "wanker",
  "bastard",
  "admin",
  "administrator",
  "moderator",
  "official",
  "staff",
] as const;

const ACCENTS = "àáâãäåèéêëìíîïòóôõöùúûüýÿñç";
const PLAIN = "aaaaaaeeeeiiiiooooouuuuyync";
const LOOKALIKE = "0134578@$!";
const LETTERS = "oieastbasi";

/** Lower case, accents off, look-alikes read as letters (as the database). */
export function nameLetters(name: string) {
  let out = "";
  for (const ch of name.toLowerCase()) {
    const a = ACCENTS.indexOf(ch);
    const l = LOOKALIKE.indexOf(ch);
    out += a >= 0 ? PLAIN[a] : l >= 0 ? LETTERS[l] : ch;
  }
  return out;
}

/** Whether a player name passes the filter. */
export function nameAllowed(name: string) {
  const letters = nameLetters(name);
  const squashed = letters.replace(/[^a-z]/g, "");
  const words = letters.split(/[^a-z]+/).filter(Boolean);
  if (NAME_PART_WORDS.some((w) => squashed.includes(w))) return false;
  return !NAME_WHOLE_WORDS.some(
    (w) => words.includes(w) || words.includes(`${w}s`),
  );
}

export const NAME_NOT_ALLOWED =
  "That name isn't allowed. Please choose another.";
