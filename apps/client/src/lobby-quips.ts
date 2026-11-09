import type { CharacterId } from "@arena/shared";

/**
 * What your fighter says and does when you tap it in the Lobby (owner,
 * 8 Nov 2026): a gesture from its own rig and a short line in a bubble,
 * picked at random, never the same line twice in a row. Each champion has
 * lines in its own voice; a shared pool keeps it fresh; tapping on and on
 * gets its own answers. Lines stay short so the bubble fits a phone.
 */
export type QuipMove =
  | "wave"
  | "victory"
  | "jump"
  | "hurt"
  | "basic"
  | "skill0"
  | "skill1"
  | "skill2"
  | "skill3";
export interface Quip {
  text: string;
  move: QuipMove;
}
/** How long each gesture plays (ms). */
export const QUIP_MOVE_MS: Record<QuipMove, number> = {
  wave: 1400,
  victory: 1800,
  jump: 700,
  hurt: 500,
  basic: 450,
  skill0: 700,
  skill1: 700,
  skill2: 700,
  skill3: 1300,
};
/** The longest a line may be: the bubble's width on a phone. */
export const QUIP_MAX_LENGTH = 44;

const q = (move: QuipMove, text: string): Quip => ({ text, move });

/** Anyone can say these. */
export const COMMON_QUIPS: readonly Quip[] = [
  q("wave", "Oh, hi! Didn't see you there."),
  q("wave", "Ready when you are!"),
  q("jump", "Let's go, let's go, let's go!"),
  q("victory", "I've been practising. Watch!"),
  q("hurt", "Hey! That tickles!"),
  q("hurt", "Boop received."),
  q("wave", "Is it time? Is it time?"),
  q("jump", "Pick me! Oh wait, you did."),
  q("victory", "Best team in the arena. Us."),
  q("basic", "Hi-yah! Did that look cool?"),
  q("wave", "Snack break after this one?"),
  q("jump", "I can feel a win coming!"),
  q("hurt", "Careful, I'm very poke-able."),
  q("victory", "Ta-da! That's my good side."),
  q("wave", "You look like a winner today."),
  q("basic", "Warming up... and done!"),
  q("jump", "Boing!"),
  q("wave", "I saved you a spot. Right here."),
  q("victory", "Tell the others I said hi."),
  q("hurt", "Personal space! ...Okay, fine."),
  q("wave", "Did you bring the good snacks?"),
  q("jump", "My legs are full of zoom."),
  q("victory", "Pose for the crowd!"),
  q("wave", "One more match. Then one more."),
  q("basic", "Practice swing. Totally on purpose."),
  q("hurt", "Ow! Kidding. I'm tough."),
  q("wave", "Psst. Press PLAY."),
  q("jump", "Today feels like a lucky day."),
  q("victory", "Champion vibes only."),
  q("wave", "Thanks for picking me!"),
];

/** Tapped again and again (many taps in a few seconds). */
export const POKED_QUIPS: readonly Quip[] = [
  q("hurt", "Okay, okay, I'm awake!"),
  q("hurt", "Are you poking or knocking?"),
  q("jump", "Stop! No, keep going. No, stop!"),
  q("hurt", "I'm going to need a nap."),
  q("hurt", "My fur is all ruffled now!"),
  q("jump", "Save some energy for the match!"),
  q("hurt", "That's the tenth boop. I'm counting."),
  q("victory", "Fine. You win. Happy now?"),
  q("hurt", "I'm a fighter, not a button!"),
  q("jump", "Tickle attack! It's super effective!"),
];

/** Each champion's own voice. */
export const CHAMPION_QUIPS: Record<CharacterId, readonly Quip[]> = {
  voltkit: [
    q("skill0", "Zap! Sorry, static again."),
    q("jump", "Wheee! I'm gliding! Sort of."),
    q("hurt", "Careful, my antennae are charged!"),
    q("victory", "Fully charged. One hundred percent."),
    q("skill1", "Want to see a ball of lightning?"),
    q("wave", "My fur's all fluffy. Static day."),
    q("basic", "Pew pew! Long range, baby."),
    q("jump", "I'm the fastest. Probably."),
  ],
  cindrake: [
    q("skill0", "Is it warm in here, or is it me?"),
    q("victory", "My crest is extra flamey today."),
    q("hurt", "Ouch, hot! I mean, I'm hot. Ow."),
    q("basic", "Get close. I dare you."),
    q("skill1", "Magma bomb incoming! Duck!"),
    q("wave", "Roasted marshmallow? On me."),
    q("jump", "Fire up! Let's burn some HP!"),
    q("victory", "Small newt. Big flames."),
  ],
  tidefin: [
    q("jump", "Splish! Splash! Ready!"),
    q("wave", "Stay hydrated, champion."),
    q("skill2", "There's two of me now. Surprise!"),
    q("hurt", "Hey, don't poke my gills!"),
    q("basic", "Poke, slip away, repeat."),
    q("victory", "Quickest fins in the arena."),
    q("wave", "I can regrow a whole leg. Cool, huh?"),
    q("skill3", "Riptide! Hold on to something!"),
  ],
  auralynx: [
    q("victory", "Patience. Then pounce."),
    q("skill2", "Go on, hit me. I'll wait."),
    q("hurt", "A careless poke. Noted."),
    q("basic", "My fists are pure crystal."),
    q("wave", "Breathe in. Breathe out. Win."),
    q("skill1", "Shatter Paw! ...Too much?"),
    q("victory", "Calm mind, sharp claws."),
    q("jump", "Meditation over. Fight time!"),
  ],
  lumoth: [
    q("jump", "Ooh, is that a lamp? No. Focus."),
    q("skill0", "Sparkle dust! Free of charge!"),
    q("hurt", "Watch the wings! They're fluffy!"),
    q("wave", "I glow a little when I'm happy."),
    q("victory", "Shine bright, fight bright."),
    q("skill2", "Kindle time! Let's race!"),
    q("basic", "Any range. Any time."),
    q("jump", "Flutter flutter, here I go!"),
  ],
  mystowl: [
    q("skill0", "My third eye sees victory."),
    q("hurt", "Hoo! Hoo poked me?"),
    q("victory", "I knew you'd tap me. I saw it."),
    q("skill1", "HOOT. Sorry, was that loud?"),
    q("wave", "Wise move, picking me."),
    q("basic", "Slow. Heavy. Unstoppable."),
    q("skill2", "Now you see me. Now you don't."),
    q("wave", "I predict a win. Probably."),
  ],
  terradon: [
    q("wave", "Mmm... five more minutes..."),
    q("skill1", "Shell up. Nap time. Wake me later."),
    q("hurt", "Huh? Oh. Was that a poke?"),
    q("victory", "Slow and steady wins the match."),
    q("basic", "Bonk."),
    q("wave", "Come to me. I'm not moving."),
    q("skill3", "Tremor! That was a yawn, mostly."),
    q("jump", "I jumped! ...Did I jump?"),
  ],
  duskveil: [
    q("skill2", "My lantern says hello. Spookily."),
    q("wave", "Boo! ...Did I scare you?"),
    q("hurt", "You can't poke a ghost! Oh, you can."),
    q("victory", "The shadows are on our side."),
    q("skill1", "Ghostfire! Pretty, isn't it?"),
    q("basic", "Shhh. I'm lurking."),
    q("jump", "Spooky jump scare!"),
    q("wave", "I'm not haunted. Just hooded."),
  ],
  coilemur: [
    q("skill0", "Come here! Magnet lash!"),
    q("hurt", "Watch the tail, it's magnetic!"),
    q("jump", "My tail is buzzing. Fight time?"),
    q("victory", "Once I grab you, I don't let go."),
    q("skill1", "Static clamp! Hug time!"),
    q("wave", "I stuck to the fridge again."),
    q("basic", "Zip, zap, gotcha!"),
    q("jump", "Ring-tailed and ready!"),
  ],
  pyranda: [
    q("wave", "Oh! H-hi. You picked me?"),
    q("skill0", "Chestnuts! Fresh and toasty!"),
    q("hurt", "Eep! Don't poke the tail!"),
    q("victory", "I can be brave. Watch."),
    q("skill2", "I'll just hide behind my tail..."),
    q("basic", "Back line, best line."),
    q("jump", "Okay! Okay! I'm ready!"),
    q("wave", "Want a roasted chestnut?"),
  ],
  glacelle: [
    q("skill0", "Hailstone! Chill out."),
    q("hurt", "Brr! Your finger is warm!"),
    q("victory", "Freeze! You're it."),
    q("wave", "Stay frosty."),
    q("skill2", "One breath and you're an ice cube."),
    q("jump", "Floating is basically flying."),
    q("basic", "Slow down. Then stop. Then freeze."),
    q("skill3", "Whiteout! Can't see a thing!"),
  ],
  halcyra: [
    q("skill1", "Focus... focus... got it."),
    q("hurt", "Careful, I'm delicate! And sharp."),
    q("victory", "Longest reach in the arena."),
    q("basic", "I can hit you from over there."),
    q("wave", "Wait, let me fix my feathers."),
    q("skill2", "Rewind! Let's try that again."),
    q("jump", "Dive bomb! Just kidding."),
    q("skill3", "Skyline Lance! Bullseye!"),
  ],
  sunbara: [
    q("wave", "Hi friend! Everyone's my friend."),
    q("skill1", "Warm spring! Ahhh, nice."),
    q("hurt", "Hehe, that tickles!"),
    q("victory", "Group hug after the match?"),
    q("skill0", "Yuzu? Fresh from my head."),
    q("jump", "Sunshine power, activate!"),
    q("wave", "Did you drink water today?"),
    q("skill3", "Sanctuary! Everyone's safe here."),
  ],
  astrabun: [
    q("skill0", "Hop hop! I'm on the moon!"),
    q("hurt", "Hey! My ears are sensitive!"),
    q("basic", "Mochi pound! Squish!"),
    q("victory", "I'll land right on top of them."),
    q("jump", "Boing! Low gravity mode!"),
    q("wave", "Want some mochi? It's fresh."),
    q("skill2", "Moon gravity! Everybody float!"),
    q("skill3", "It's a full moon tonight!"),
  ],
  wombolder: [
    q("skill0", "Out of the way! Digging through!"),
    q("hurt", "Bonk me on the back. It's armoured."),
    q("victory", "Strongest rump in the land."),
    q("basic", "I bulldoze. That's the plan."),
    q("wave", "I dug a tunnel to say hi."),
    q("skill1", "Bush boomerang! It comes back!"),
    q("jump", "Gah, I can't jump. Wombat things."),
    q("skill3", "Landslide! Mind the rocks!"),
  ],
  shadopus: [
    q("skill0", "Ink! Whoops. Sorry."),
    q("hurt", "Eight arms and you poke this one?"),
    q("victory", "Gone before they turn around."),
    q("skill2", "Poof! Ink cloud! Can't see me!"),
    q("wave", "I wave with all eight. Hi hi hi!"),
    q("basic", "Sneaky sneaky."),
    q("jump", "Squish. Splat. Ready."),
    q("skill3", "Kraken grasp! Gotcha!"),
  ],
  pangrove: [
    q("skill2", "Curl and roll! Wheee!"),
    q("hurt", "Ow! Ha, my scales are leaves!"),
    q("victory", "Three plates of pure armour."),
    q("skill0", "Tongue grapple! Thlurp!"),
    q("wave", "Want to see me roll? I roll."),
    q("basic", "Leaf me alone! Just kidding."),
    q("jump", "Rolling into battle!"),
    q("skill3", "Pinball time! Bounce!"),
  ],
  mossloth: [
    q("wave", "Heyyy... nice... to... meet... you."),
    q("skill1", "Let's... slow... time... down."),
    q("hurt", "Easy, you'll disturb my moss."),
    q("victory", "Patience grows the best gardens."),
    q("skill0", "Plant a seed. Watch it grow."),
    q("basic", "Lazy swing... still counts."),
    q("jump", "That was me being fast."),
    q("skill3", "Overgrowth! Everything's green!"),
  ],
};

/** A line for this champion, never `last` again (index into its pool). */
export function pickQuip(
  champion: CharacterId,
  last: string | undefined,
  poked: boolean,
  random: () => number = Math.random,
): Quip {
  const own = CHAMPION_QUIPS[champion] ?? [];
  // Poked again and again: those answers. Otherwise its own voice more
  // often than the shared pool (two in three).
  const pool = poked
    ? POKED_QUIPS
    : random() < 2 / 3 && own.length
      ? own
      : COMMON_QUIPS;
  const choices = pool.filter((quip) => quip.text !== last);
  return choices[Math.floor(random() * choices.length)] ?? pool[0];
}
