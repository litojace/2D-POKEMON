# Music

The soundtrack is modern retro: each scene's original tune, played by chip-like voices with the mix a shipped game's soundtrack has, and synthesized as it plays. There are no audio files, so nothing downloads and the music starts with the first tap. The owner chose the retro set on 26 Nov 2026 (replacing the recorded orchestra), then the produced hub and PvP themes the same day after a side-by-side listen; the raid, the Spire and the results followed in the same style, which retired the plain chip voices.

| Scene     | Tune                 | Arrangement                                                                                                                                                                                                                                      | Tempo   | Loop |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---- |
| Hub       | Pocket Parade        | A friendly town theme with a wide lead and glides, a counter-line, pad, plucked arpeggios through the delay, a syncopated bass that ducks under the kick, a gentle intro and a riser into the chorus                                             | 112 BPM | 1:43 |
| PvP       | Hopscotch Heroes     | A fight with a driving ducked bass, four-on-the-floor in the chorus, a harmony line, arpeggio shimmer and tom fills                                                                                                                              | 148 BPM | 1:18 |
| Boss raid | Big Friendly Trouble | A boss that gets fiercer as it weakens: phase 1 is bass and kick, 2 adds the snare, an alarm of plucked sixteenths and a chord stab, 3 a four-on-the-floor kick, sixteenth hats, a harmony line, a bell an octave up and a riser every four bars | 132 BPM | 1:27 |
| Spire     | Skyward Steps        | A climb: plucked eighths rising up the chord and over the top through the delay, a bell in the bridge, drums and a shaker that grow with the phase                                                                                               | 132 BPM | 1:27 |

Victory, defeat and draw keep their tunes (`adventure-score.ts`): a fanfare with drums, a crash and a tom fill; a falling farewell with no drums; two short phrases and a bell. The Lobby's tune plays across the hub, the Plaza included, so going between them doesn't restart it (owner, 26 Nov 2026; the Plaza's own Fountain Square was retired). Spire floors play Skyward Steps (`battle-music.ts`).

## How it is made

- **The tunes** (`adventure-score.ts`): 32 bars of melody and chords per scene, played in the form statement, answer, quieter bridge, celebratory chorus, varied answer and homecoming (48 bars); and the results' jingles.
- **The arrangements** (`pro-score.ts`): each scene's role above, a harmony line of chord tones a third to a sixth under the tune in the big sections (`below()`), a counter-line answering in the tune's rests, grooves that change by section (and in the raid and the Spire by phase), tom fills closing each section, a crash opening the big ones and a riser through the bridge's last bar.
- **The voices** (`pro-synth.ts`): leads of two pulse waves a few cents apart and spread left and right, with a filter envelope, delayed vibrato and glides into long notes; a pad of three detuned saws; plucked pulses for arpeggios; a bass of a sub sine and a filtered pulse (bite a phone can play); an FM bell; a synthesized kit (kick, snare, hats, shaker, toms, crash) and a noise riser.
- **The mix**: a plate-like reverb (a 2.2 s impulse made once per audio context), a dotted-eighth ping-pong delay, the pads and bass ducking under each kick (sidechain), and a bus with a low cut, a presence lift at 3 kHz, air above 8 kHz and gentle glue compression. Where a browser lacks a compressor, a convolver or custom waves, that part is left out, not the music (pulse voices fall back to squares).

The volume, mute, background-page handling and theme crossfades are as before (`audio.ts`).

### Levels, measured

Each theme carries a trim (`PRO_GAIN`), set by rendering it offline in Chromium through the game's music bus and limiter at the default slider and measuring it through a phone speaker's range (300 Hz to 9 kHz). The backgrounds are measured over a minute once the limiter has settled, the results over the whole jingle. Each sits within about 1 dB of the chip version it replaced, so no scene got noticeably louder or quieter on a phone:

| Theme          | Phone range (dB) | Chip it replaced (dB) | Peak (dBFS) |
| -------------- | ---------------- | --------------------- | ----------- |
| Hub            | −33.2            | −34.3                 | −3.8        |
| PvP            | −34.2            | −33.8                 | −4.5        |
| Raid, phase 1  | −35.2            | −35.1                 | −5.5        |
| Raid, phase 3  | −33.9            | −34.4                 | −4.0        |
| Spire, phase 1 | −34.6            | −35.2                 | −6.5        |
| Spire, phase 3 | −34.4            | not measured          | −4.3        |
| Victory        | −33.7            | −34.3                 | −13.3       |
| Defeat         | −37.3            | −37.2                 | −17.4       |
| Draw           | −37.0            | −36.9                 | −15.7       |

Against the chip versions the stereo width is up 6 to 11 dB (side against mid), and the energy from 2 to 6 kHz is up from 3–7% to 8–18% in the backgrounds and the victory; the defeat and the draw stay soft (about 2%). How loud it all plays is set in `audio.ts`; see "Volume" below.

### Keeping it light on older phones

The music shares the phone with the battle. Each note is a handful of Web Audio nodes, released when it ends; the reverb, delay and bus are made once per theme. Counted over each loop: the hub creates about 130 nodes a second, PvP 180 (its busiest bar 290), the raid's phases 1, 2 and 3 about 105, 180 and 240 (busiest bar 270) and the Spire 130 to 180. The raid's third phase moves its plucks from sixteenths to eighths, where the hats already carry the sixteenths, so the busiest phase stays within what the PvP chorus already asks.

## Volume

The music and the effects each have a bus: the Settings slider's level times a gain (`MIX` 1 for music, `SFX_GAIN` 0.52 for effects), then a safety limiter (a compressor at −14 dB for music, −10 dB for effects, ratio 12, 1 ms attack). A player who never moved the sliders hears 35% music and 60% effects. Raid boss cues go through the effects bus too.

Until 26 Nov 2026 the defaults were 12% music (at a gain of 0.5) and 30% effects (at 0.26), which put the music near −53 dB: too quiet on a phone even with the slider full (owner, 26 Nov). Measured offline in Chromium, with the limiters, after they settle (a compressor starts with its gain still moving, and Web Audio's adds a little makeup gain under its threshold):

| At the default sliders           | Before (dB) | Now (dB)   |
| -------------------------------- | ----------- | ---------- |
| Music, average (Lobby to Spire)  | −52 to −55  | −30 to −33 |
| A basic attack, loudest 50 ms    | −37         | −26        |
| A skill, loudest 50 ms           | −33         | −21        |
| An ultimate, loudest 50 ms       | −27         | −16        |
| A hit (12 damage), loudest 50 ms | −34         | −22.5      |

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
