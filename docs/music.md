# Adventure music

The five background scores are original 48-bar compositions scheduled with Web Audio:

| Scene     | Track                | Character                                                               | Tempo   | Loop |
| --------- | -------------------- | ----------------------------------------------------------------------- | ------- | ---- |
| Lobby     | Pocket Parade        | Skipping G major piano, answering flute and playful harp                | 112 BPM | 1:43 |
| Plaza     | Fountain Square      | A strolling F major flute over harp ripples and plucked cello, no drums | 96 BPM  | 2:00 |
| PvP       | Hopscotch Heroes     | Bright C major hooks, bouncy bass and light offbeat piano               | 144 BPM | 1:20 |
| Boss raid | Big Friendly Trouble | Mischievous D major brass calls, flute choruses and lively drums        | 124 BPM | 1:33 |
| Spire     | Skyward Steps        | Climbing E major strings, horn calls and a flute summit, Lydian lift    | 132 BPM | 1:27 |

The Plaza plays its own tune whenever the hub shows it (`menuMusic()` in `main.ts`); every other menu plays the Lobby's. Spire floors play Skyward Steps (`battle-music.ts`), and like the raid it adds percussion with the fight's phase; its results use the raid's victory and defeat themes.

Each track is a new melody and arrangement with a statement, answer, quieter bridge, celebratory chorus, varied answer and homecoming. Major keys, added-sixth chords, short articulated notes and clear rests give the soundtrack a cheerful adventure feel. Piano and flute trade the tune, harp fills the gaps, and light spiccato chords supply the bounce. The lobby has no drums; PvP uses a restrained backbeat; raid phases gradually add percussion and upper strings without restarting the song. Closing phrases leave a breath and lead smoothly back to the opening key.

Recorded instruments retain the same short stereo room reflections. Victory, defeat and draw keep their finite result themes. Music respects the existing volume, mute, background-page handling and theme crossfades.

## Recorded instruments

The bank uses CC0 public-domain recordings from Samuel Gossner / Versilian Studios:

- [Versilian Community Sample Library](https://github.com/sgossner/VCSL), revision `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`: Kawai grand piano, concert harp, bass drum, rope-tension snare, timpani and suspended cymbal.
- [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), revision `440300901dfe9275fd84e0b7763af1f8443ae62e`: flute, violin section, cello section and French horn.

`apps/client/public/assets/music/sources.json` records each original URL, source SHA-256, processed SHA-256 and sounding root frequency. The CC0 license is alongside the files. Compositions and game code retain the repository's licensing.

Recordings are converted with FFmpeg to mono 32 kHz / 80 kbps MP3, normalized to a peak of 0.85 and trimmed to 1.2–7 seconds with a 150 ms tail fade. Root frequencies account for the libraries' differing octave conventions. Playback chooses the closest recorded pitch and applies short gain envelopes to prevent clicks.

Samples ship locally and are included in the installed app's static precache. The bank loads once per audio context; background music waits for loading while result themes can play immediately. If individual samples cannot load, those instruments use synthesis as a fallback. No runtime music service or external downloads are required.

## Sound effects

Effects are synthesized, not recorded (`sfx.ts`): a recipe is up to eight short layers, each a tone or filtered noise with its own pitch and filter sweep, and nothing downloads. Each sound costs a handful of Web Audio nodes, released when it ends.

Skill sounds come from the shared data (`sfx-recipes.ts`), so a new champion needs no sound work:

- **The element is the timbre**: Electric zaps and crackles, Fire roars and crackles, Water bloops and splashes, Aura rings like glass, Light chimes, Psychic warbles, Earth thuds and knocks, Shadow breathes darkly, Nature knocks like wood and rustles. A new element sounds like Aura until it gets a palette (the unit test asks for one).
- **The kind is the gesture**: a shot, a volley, a strike, a beam, a field, a move or a buff (`KIND_GESTURES`; TypeScript asks for every new kind).
- **The slot is the size**: basics are short and quieter, ultimates longer with a low swell and a bright tail. Sturdier champions (more health) sound lower, light ones higher, so two champions of one element differ.

Hits tell yours (a crisp confirm), the ones you take (duller) and others' apart, grow with the damage, add a touch of the attacker's element, and mark knockouts, combos, ambushes and misses. Burn ticks are a quiet tick, at most one per beat per target. Other players' casts play at 42%, panned to their side and softer with distance. Your own cast plays on the key press and not again when the server confirms it (`cast-prediction.ts`). There are also cues for dashes, jumps, landings, healing orbs, ult ready, EX armed, the countdown and "Fight", the end of a round, arena hazards and button taps (not on the battle's touch buttons, which sound as their casts).

`battle-sounds.ts` decides which events sound, how loud and where. The audio manager (`audio.ts`) plays at most 14 effects at once, and other players' only up to 9, so yours are never dropped. Each sound has a minimum gap so repeats don't pile up. Everything goes through one effects bus with a gentle limiter.

### Loudness, measured

Every recipe was rendered offline in Chromium and measured: peak, the loudest 50 ms, and the loudest 50 ms through a phone speaker's range (300 Hz to 9 kHz, where small speakers play). Each element and gesture carries a trim in dB (`gain`), fitted to those measurements, so a shot and a field, or Earth and Light, sit at one level on a phone. The old single beep measured about −25 dB through a phone's range at full effects volume. Now, at full volume:

| Sound                         | Phone range (dB) | Note                                        |
| ----------------------------- | ---------------- | ------------------------------------------- |
| Basic attacks                 | about −30        | Repeated all match: quieter                 |
| Skills                        | about −26        | Each between −30 and −22                    |
| Ultimates                     | about −22        |                                             |
| Hits (8 / 25 damage)          | −30 / −25        | Taken a little duller; knockouts −21 to −23 |
| Burn ticks, misses            | about −41        |                                             |
| Dash, orb, countdown, EX      | −31 to −33       |                                             |
| Ult ready, "Fight", round end | −25 to −27       |                                             |
| Button tap                    | about −38        | The quietest: it is on every tap            |

The loudest peak of any single sound is −5 dBFS at full volume (a knockout you take), and the limiter handles many sounds together. Low thuds start high and drop fast, as a drum's do, so a phone still plays the start while headphones get the rest.
