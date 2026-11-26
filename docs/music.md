# Music

The soundtrack is retro: each scene's original tune, arranged for a console sound chip and synthesized as it plays. There are no audio files, so nothing downloads and the music starts with the first tap (the owner chose this set on 26 Nov 2026, replacing the recorded orchestra).

| Scene     | Tune                 | Retro role                                                                                                                           | Tempo   | Loop |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---- |
| Hub       | Pocket Parade        | A cheerful town: square and pulse take turns, a bouncing octave bass, light hats; a quiet bridge                                     | 112 BPM | 1:43 |
| PvP       | Hopscotch Heroes     | A fight: a bold square lead, a driving pulse bass, a full kit with fills, arpeggio shimmer                                           | 148 BPM | 1:18 |
| Boss raid | Big Friendly Trouble | A boss that gets fiercer as it weakens: phase 1 bass and kick, 2 adds snare and alarm arpeggios, 3 adds busy hats, harmony and fills | 132 BPM | 1:27 |
| Spire     | Skyward Steps        | A climb: a thin pulse line over a rising ostinato, long notes on the triangle, drums with the phase                                  | 132 BPM | 1:27 |

Victory, defeat and draw are chip jingles of their old tunes (a square fanfare, a falling pulse with vibrato, two neutral phrases). The Lobby's tune plays across the hub, the Plaza included, so going between them doesn't restart it (owner, 26 Nov 2026; the Plaza's own Fountain Square was retired). Spire floors play Skyward Steps (`battle-music.ts`).

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

Each theme carries a trim (`RETRO_GAIN`) that evens the scenes out (pulse waves are dense), and the triangle bass sits a little under the tune, since phones can't play it and it weighed on headphones. How loud it all plays is set in `audio.ts`; see "Volume" below.

## Volume

The music and the effects each have a bus: the Settings slider's level times a gain (`MIX` 1 for music, `SFX_GAIN` 0.52 for effects), then a safety limiter (a compressor at −14 dB for music, −10 dB for effects, ratio 12, 1 ms attack). A player who never moved the sliders hears 35% music and 60% effects. Raid boss cues go through the effects bus too.

Until 26 Nov 2026 the defaults were 12% music (at a gain of 0.5) and 30% effects (at 0.26), which put the music near −53 dB: too quiet on a phone even with the slider full (owner, 26 Nov). Measured offline in Chromium, with the limiters, after they settle (a compressor starts with its gain still moving, and Web Audio's adds a little makeup gain under its threshold):

| At the default sliders           | Before (dB) | Now (dB)     |
| -------------------------------- | ----------- | ------------ |
| Music, average (Lobby to Spire)  | −52 to −55  | −30.5 to −33 |
| A basic attack, loudest 50 ms    | −37         | −26          |
| A skill, loudest 50 ms           | −33         | −21          |
| An ultimate, loudest 50 ms       | −27         | −16          |
| A hit (12 damage), loudest 50 ms | −34         | −22.5        |

The music sits under the skills, as it did, but much less far under. The worst case found, a knockout you take every half second over the raid's busiest phase with both sliders full, peaks at −0.5 dBFS; at the default sliders, −2 dBFS.

## Sound effects

Effects are synthesized, not recorded (`sfx.ts`): a recipe is up to eight short layers, each a tone or filtered noise with its own pitch and filter sweep, and nothing downloads. Each sound costs a handful of Web Audio nodes, released when it ends.

Skill sounds come from the shared data (`sfx-recipes.ts`), so a new champion needs no sound work:

- **The element is the timbre**: Electric zaps and crackles, Fire roars and crackles, Water bloops and splashes, Aura rings like glass, Light chimes, Psychic warbles, Earth thuds and knocks, Shadow breathes darkly, Nature knocks like wood and rustles. A new element sounds like Aura until it gets a palette (the unit test asks for one).
- **The kind is the gesture**: a shot, a volley, a strike, a beam, a field, a move or a buff (`KIND_GESTURES`; TypeScript asks for every new kind).
- **The slot is the size**: basics are short and quieter, ultimates longer with a low swell and a bright tail. Sturdier champions (more health) sound lower, light ones higher, so two champions of one element differ.

Hits tell yours (a crisp confirm), the ones you take (duller) and others' apart, grow with the damage, add a touch of the attacker's element, and mark knockouts, combos, ambushes and misses. Burn ticks are a quiet tick, at most one per beat per target. Other players' casts play at 42%, panned to their side and softer with distance. Your own cast plays on the key press and not again when the server confirms it (`cast-prediction.ts`). There are also cues for dashes, jumps, landings, healing orbs, ult ready, EX armed, the countdown and "Fight", the end of a round, arena hazards and button taps (not on the battle's touch buttons, which sound as their casts).

`battle-sounds.ts` decides which events sound, how loud and where. The audio manager (`audio.ts`) plays at most 14 effects at once, and other players' only up to 9, so yours are never dropped. Each sound has a minimum gap so repeats don't pile up. Everything goes through one effects bus with a gentle limiter.

### Loudness, measured

Every recipe was rendered offline in Chromium and measured: peak, the loudest 50 ms, and the loudest 50 ms through a phone speaker's range (300 Hz to 9 kHz, where small speakers play). Each element and gesture carries a trim in dB (`gain`), fitted to those measurements, so a shot and a field, or Earth and Light, sit at one level on a phone. Against each other, through a phone's range:

| Sound                         | Against a skill | Note                             |
| ----------------------------- | --------------- | -------------------------------- |
| Basic attacks                 | about −4 dB     | Repeated all match: quieter      |
| Skills                        | 0               | Each within about ±4 dB          |
| Ultimates                     | about +4 dB     |                                  |
| Hits (8 / 25 damage)          | −4 / +1 dB      | Knockouts +3 to +5 dB            |
| Burn ticks, misses            | about −15 dB    |                                  |
| Dash, orb, countdown, EX      | −5 to −7 dB     |                                  |
| Ult ready, "Fight", round end | +1 to −1 dB     |                                  |
| Button tap                    | about −12 dB    | The quietest: it is on every tap |

How loud they play is under "Volume" above. Low thuds start high and drop fast, as a drum's do, so a phone still plays the start while headphones get the rest.
