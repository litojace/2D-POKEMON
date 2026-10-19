# Adventure music

The three background scores are original 48-bar compositions scheduled with Web Audio:

| Scene     | Track                | Character                                                        | Tempo   | Loop |
| --------- | -------------------- | ---------------------------------------------------------------- | ------- | ---- |
| Lobby     | Pocket Parade        | Skipping G major piano, answering flute and playful harp         | 112 BPM | 1:43 |
| PvP       | Hopscotch Heroes     | Bright C major hooks, bouncy bass and light offbeat piano        | 144 BPM | 1:20 |
| Boss raid | Big Friendly Trouble | Mischievous D major brass calls, flute choruses and lively drums | 124 BPM | 1:33 |

Each track is a new melody and arrangement with a statement, answer, quieter bridge, celebratory chorus, varied answer and homecoming. Major keys, added-sixth chords, short articulated notes and clear rests give the soundtrack a cheerful adventure feel. Piano and flute trade the tune, harp fills the gaps, and light spiccato chords supply the bounce. The lobby has no drums; PvP uses a restrained backbeat; raid phases gradually add percussion and upper strings without restarting the song. Closing phrases leave a breath and lead smoothly back to the opening key.

Recorded instruments retain the same short stereo room reflections. Victory, defeat and draw keep their finite result themes. Music respects the existing volume, mute, background-page handling and theme crossfades.

## Recorded instruments

The bank uses CC0 public-domain recordings from Samuel Gossner / Versilian Studios:

- [Versilian Community Sample Library](https://github.com/sgossner/VCSL), revision `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`: Kawai grand piano, concert harp, bass drum, rope-tension snare, timpani and suspended cymbal.
- [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), revision `440300901dfe9275fd84e0b7763af1f8443ae62e`: flute, violin section, cello section and French horn.

`apps/client/public/assets/music/sources.json` records each original URL, source SHA-256, processed SHA-256 and sounding root frequency. The CC0 license is alongside the files. Compositions and game code retain the repository's licensing.

Recordings are converted with FFmpeg to mono 32 kHz / 80 kbps MP3, normalized to a peak of 0.85 and trimmed to 1.2–7 seconds with a 150 ms tail fade. Root frequencies account for the libraries' differing octave conventions. Playback chooses the closest recorded pitch and applies short gain envelopes to prevent clicks.

Samples ship locally and are included in the installed app's static precache. The bank loads once per audio context; background music waits for loading while result themes can play immediately. If individual samples cannot load, those instruments use synthesis as a fallback. No runtime music service or external downloads are required.
