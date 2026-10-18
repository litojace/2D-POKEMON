/**
 * The Raid Hub's roster: seven bosses, one featured each day of the week.
 * Only bosses marked `playable` can be raided; the rest are shown as
 * "coming soon" until they are built (see docs/raid-roster-design.md).
 */
export type RaidBossId =
  | "grumblecrag"
  | "tidewyrm"
  | "gloomshade"
  | "somnara"
  | "prismatail"
  | "emberwing"
  | "storm-twins";

export interface RaidBossInfo {
  id: RaidBossId;
  name: string;
  epithet: string;
  element: string;
  /** CSS colour for crests and accents. */
  color: string;
  /** Day of the week it is featured: 0 = Sunday … 6 = Saturday. */
  day: number;
  stars: 1 | 2 | 3;
  /** The signature mechanic in one line. */
  signature: string;
  blurb: string;
  playable: boolean;
}

export const RAID_BOSSES: Record<RaidBossId, RaidBossInfo> = {
  grumblecrag: {
    id: "grumblecrag",
    name: "Grumblecrag",
    epithet: "The living mountain",
    element: "Earth",
    color: "#d9a35b",
    day: 6,
    stars: 1,
    signature: "Bait its charge into a pillar",
    blurb:
      "A grumpy mountain that woke up on the wrong side of the valley. Lead its charges into pillars to crack the armor and strike the glowing core.",
    playable: true,
  },
  tidewyrm: {
    id: "tidewyrm",
    name: "Tidewyrm",
    epithet: "The rising tide",
    element: "Water",
    color: "#4fd6c8",
    day: 5,
    stars: 2,
    signature: "Strand it on an island",
    blurb:
      "A sleepy sea serpent with a pearl on its brow. Lure its dive onto dry land, share the islands when the tide rises, and pop your friends out of bubbles.",
    playable: true,
  },
  gloomshade: {
    id: "gloomshade",
    name: "Gloomshade",
    epithet: "Lights out",
    element: "Shadow",
    color: "#9c7bff",
    day: 1,
    stars: 2,
    signature: "Find the one that casts a shadow",
    blurb:
      "A floppy-eared puff of shadow with a crescent-moon tail. Keep the lanterns lit, find the real one among its copies, and spread out when the curse creeps.",
    playable: true,
  },
  somnara: {
    id: "somnara",
    name: "Somnara",
    epithet: "The dream whale",
    element: "Psychic",
    color: "#c9a3ff",
    day: 3,
    stars: 2,
    signature: "Step the runes only the Dreamer sees",
    blurb:
      "A huge sleepy sky whale with a tiny house on its back. One raider sees its dream; the team must step the runes in order to wake it.",
    playable: false,
  },
  prismatail: {
    id: "prismatail",
    name: "Prismatail",
    epithet: "Carry the light",
    element: "Light",
    color: "#ffe27a",
    day: 0,
    stars: 3,
    signature: "Relay the sunbeam to its heart",
    blurb:
      "A proud crystal peacock with a shielded heart. Pass the sunbeam raider to raider until it reaches the boss and shatters the shield.",
    playable: false,
  },
  emberwing: {
    id: "emberwing",
    name: "Emberwing",
    epithet: "Ground the sky",
    element: "Fire",
    color: "#ff8a4f",
    day: 2,
    stars: 3,
    signature: "Light three braziers at once",
    blurb:
      "A plump, smug fire bird that refuses to land. Light all three braziers together to knock it out of the sky.",
    playable: false,
  },
  "storm-twins": {
    id: "storm-twins",
    name: "Storm Twins",
    epithet: "Fizz & Crackle",
    element: "Electric",
    color: "#ffd65b",
    day: 4,
    stars: 3,
    signature: "Beat both twins together",
    blurb:
      "Two floating thunder-jellies tied by a crackling ribbon. Pair up with opposite charges and bring both down before either can revive the other.",
    playable: false,
  },
};

/** Hub order: the tutorial boss first, then the planned build order. */
export const RAID_BOSS_ORDER: RaidBossId[] = [
  "grumblecrag",
  "tidewyrm",
  "gloomshade",
  "somnara",
  "prismatail",
  "emberwing",
  "storm-twins",
];

/** Featured boss by weekday, Sunday first (the old planet names of the week). */
export const RAID_DAY_SCHEDULE: RaidBossId[] = [0, 1, 2, 3, 4, 5, 6].map(
  (day) => RAID_BOSS_ORDER.find((id) => RAID_BOSSES[id].day === day)!,
);

export const RAID_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The group plays on Pacific time; the day changes at midnight there. */
export const RAID_TIME_ZONE = "America/Los_Angeles";

const datePart = new Intl.DateTimeFormat("en-CA", {
  timeZone: RAID_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Pacific calendar date, as YYYY-MM-DD. */
export function pacificDate(date = new Date()) {
  return datePart.format(date);
}

/** Weekday (0 = Sunday) of a YYYY-MM-DD calendar date. */
export function weekdayOf(day: string) {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** Calendar date `n` days after a YYYY-MM-DD date. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** When the next Pacific day starts (handles 23- and 25-hour days). */
export function nextRaidDayAt(date = new Date()) {
  const today = pacificDate(date);
  // Step forward by hours to the first instant of the next date, then refine.
  let t = date.getTime();
  while (pacificDate(new Date(t)) === today) t += 3_600_000;
  let lo = t - 3_600_000,
    hi = t;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (pacificDate(new Date(mid)) === today) lo = mid;
    else hi = mid;
  }
  return hi;
}

const hash = (text: string) => {
  let seed = 2166136261;
  for (const ch of text)
    seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return seed;
};

/**
 * The featured raid on a calendar date: the scheduled boss when it can be
 * played, otherwise the playable bosses take turns. Everyone gets the same
 * seed for that day.
 */
export function featuredOn(day: string) {
  const weekday = weekdayOf(day);
  const scheduled = RAID_DAY_SCHEDULE[weekday];
  const playable = RAID_BOSS_ORDER.filter((id) => RAID_BOSSES[id].playable);
  const dayNumber = Math.round(
    new Date(`${day}T12:00:00Z`).getTime() / 86_400_000,
  );
  const boss = RAID_BOSSES[scheduled].playable
    ? scheduled
    : playable[dayNumber % playable.length];
  return { day, weekday, scheduled, boss, seed: hash(`${day}:${boss}`), peril: 2 as const };
}

/** Today's featured raid (Pacific calendar). */
export function raidDay(date = new Date()) {
  return featuredOn(pacificDate(date));
}

/** The Sunday–Saturday week containing a date (for the Hub's week strip). */
export function raidWeekDays(day = pacificDate()) {
  const start = addDays(day, -weekdayOf(day));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => featuredOn(addDays(start, i)));
}
