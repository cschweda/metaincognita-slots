# Audio credits

The only audio **files** in this project. Everything else you hear — reel whirrs,
reel stops, coin trays, the LDW party, the wheel's decelerating ticker, every
synth fanfare — is generated at runtime in Web Audio by `app/utils/audio.ts` and
`app/utils/soundBank.ts`, with no assets at all.

These three are recorded one-shot stings, used where the spectacle peaks: a
feature arming, and a jackpot landing. When one is missing or won't decode,
`playSampleNow()` returns false and the synth fanfare sings in its place — the
cabinet is never silenced by a bad asset.

| File | Original | Length |
|---|---|---|
| `bonus-1.mp3` | `floraphonic-playful-casino-slot-machine-bonus-1-183918.mp3` | 4.15s |
| `bonus-2.mp3` | `floraphonic-playful-casino-slot-machine-bonus-2-183919.mp3` | 4.15s |
| `jackpot.mp3` | `floraphonic-playful-casino-slot-machine-jackpot-3-183921.mp3` | 5.64s |

- **Artist:** Floraphonic
- **Source:** [Pixabay](https://pixabay.com/sound-effects/)
- **License:** Pixabay Content License — free to use, including commercially;
  attribution is not required. Credited here anyway, because the work deserves it.

Served same-origin from `/audio/`. They're pulled in with `fetch()` +
`decodeAudioData`, so the CSP directive that actually authorizes them is
`connect-src 'self'` — `media-src 'self'` is declared too, but that one governs
`<audio>`/`<video>` elements, which this app doesn't use. They are fetched and
decoded lazily — never on boot — and warmed on the first user gesture, so the
sting is already in memory when it is needed.
