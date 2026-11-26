# Music

The soundtrack is retro: each scene's original tune, arranged for a console sound chip and synthesized as it plays. There are no audio files, so nothing downloads and the music starts with the first tap (the owner chose this set on 26 Nov 2026, replacing the recorded orchestra).

| Scene     | Tune                 | Retro role                                                                                                                           | Tempo   | Loop |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---- |
| Lobby     | Pocket Parade        | A cheerful town: square and pulse take turns, a bouncing octave bass, light hats; a quiet bridge                                     | 112 BPM | 1:43 |
| Plaza     | Fountain Square      | A stroll: a soft pulse with vibrato over plucked chord ripples, no drums; a triangle bridge                                          | 96 BPM  | 2:00 |
| PvP       | Hopscotch Heroes     | A fight: a bold square lead, a driving pulse bass, a full kit with fills, arpeggio shimmer                                           | 148 BPM | 1:18 |
| Boss raid | Big Friendly Trouble | A boss that gets fiercer as it weakens: phase 1 bass and kick, 2 adds snare and alarm arpeggios, 3 adds busy hats, harmony and fills | 132 BPM | 1:27 |
| Spire     | Skyward Steps        | A climb: a thin pulse line over a rising ostinato, long notes on the triangle, drums with the phase                                  | 132 BPM | 1:27 |

Victory, defeat and draw are chip jingles of their old tunes (a square fanfare, a falling pulse with vibrato, two neutral phrases). The Plaza plays its own tune whenever the hub shows it (`menuMusic()` in `main.ts`), every other menu the Lobby's, and Spire floors play Skyward Steps (`battle-music.ts`).

## How it is made

- **The tunes** (`adventure-score.ts`): 32 bars of melody and chords per scene, played in the form statement, answer, quieter bridge, celebratory chorus, varied answer and homecoming (48 bars).
- **The arrangements** (`retro-score.ts`): each scene's role above, a harmony line of chord tones a third to a sixth under the tune in the big sections (`below()`), and the result jingles.
- **The voices** (`chip-synth.ts`), after the sound chips of old consoles:
  - pulse waves at 12.5%, 25% and 50% duty (band-limited, from a Fourier series);
  - a triangle that holds its level, as the chip's had no volume control;
  - a pulse bass under a lowpass;
  - a rapid chord arpeggio, one note every two 60 Hz frames;
  - drums from noise held in steps of four samples for a chip's grit, and a kick that drops fast in pitch with a click a phone can hear.
- **Details:** long notes get a delayed vibrato, and the leads send to a soft echo of three-quarters of a beat (`music-synth.ts`). Each note is one oscillator or noise source with a short envelope, released when it ends.

The volume, mute, background-page handling and theme crossfades are as before (`audio.ts`).

### Levels, measured

Every theme was rendered whole offline in Chromium, at the default music volume, and measured over the full range and through a phone speaker's range (300 Hz to 9 kHz). Pulse waves are dense, so each theme carries a trim (`RETRO_GAIN`) that puts it where the recorded track it replaced sat. The triangle bass sits a little under the tune, since phones can't play it and it weighed on headphones.

| Theme           | Retro, full / phone (dB) | Recorded, full / phone (dB) |
| --------------- | ------------------------ | --------------------------- |
| Lobby           | −52.4 / −52.6            | −52.9 / −51.3               |
| Plaza           | −53.2 / −53.2            | −54.5 / −52.6               |
| PvP             | −53.8 / −53.4            | −53.9 / −53.2               |
| Raid (phase 1)  | −54.5 / −54.6            | −54.5 / −53.7               |
| Spire (phase 1) | −55.0 / −55.2            | −54.9 / −54.3               |
| Victory         | −52.9 / −53.2            | −52.0 / −52.9               |
| Defeat          | −52.4 / −55.2            | −53.0 / −54.3               |
| Draw            | −53.5 / −54.7            | −53.7 / −54.6               |

No theme clips: the loudest peak is −26.6 dB at the music bus.

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
