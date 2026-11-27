# SymphonyCSV Studio — LABS AI entry point

This documentation was generated after verifying exact headers against Checkpoint 072 (a45dad7), and successfully running the LABS Rust/WASM panning test.

- Piano Roll / Pitched, Tracks 1–2: [pitched.md](pitched.md), 86 current fields (85 legacy).
- Guitar TAB, Tracks 3–4: [guitar-tab.md](guitar-tab.md), 135 current fields (129 legacy). Both are guitar tracks.
- Drums, Track 5 Acoustic and Track 6 Electronic: [drums.md](drums.md), 21 current fields (20 legacy).

## Open musical formats

The SymphonyCSV musical CSV formats are openly documented and freely available for anyone to use and implement. Musicians, software developers, researchers and AI systems may create, read, edit and exchange compatible musical files without paying format licensing fees. SymphonyCSV Studio is free to use, while its application source code remains proprietary. See the [format-use policy](https://symphonycsvstudio.com/help/specs/format-use-policy.html), effective 24 November 2026.

## AI behavior contract

1. Start from the official blank header, not an improvised schema.
2. Preserve exact column names, order, UTF-8, CSV quoting, empty values and stable event IDs.
3. Never substitute a header-only template for a playable composition.
4. Respect human musical decisions. Do not invent notes, key, tempo, meter, instruments, licenses, or provenance.
5. When adding authored panning, use whole integers -100 to 100; leave empty for SoundFont-native placement.
6. Compute note times and whole-bar composition endings with code, not with language-model estimates.
7. Show changes and run the LABS validator; a plausible CSV is not necessarily an accepted CSV.
8. Treat descriptions for uncommon fields as documented guidance rather than a guarantee of accepted enumerations.

## Master Output Gain and playback troubleshooting (27 November 2026)

Master Output Gain is a global performance control in Performance Settings (−12 to +12 dB, 0.5 dB steps, default 0 dB). It adjusts the combined stereo mix of Tracks 1–8 and shared wet returns after the Graphic EQ and before the fixed output limiter. It is independent of track gain, Master Drum Volume, compressor and EQ bypasses, and event velocity. Live audition and Mix All WAV/MP3 use the same gain stage. It does not modify musical CSV or MIDI data.

Project ZIPs preserve the numeric playback.global_effects.masterOutputGainDb field; browser snapshots preserve effects.masterOutputGainDb; standalone Performance Settings JSON uses master_output_gain_db. Missing gain fields in older supported saves default to 0 dB. Values must be finite numbers between −12 and +12. Standalone settings files are distinct from the ZIP manifest.

If live playback distorts while the rendered WAV or MP3 sounds clean, reduce output gain and headphone volume, then audition the same passage with fewer tracks or effects, or on another computer/browser. Real-time audio deadlines, overlapping sampled voices and audio/device configuration can contribute; the cause is not established by listening alone. Offline rendering is not subject to the same real-time deadlines. Keep the musical CSV unchanged until a musical problem is isolated. The existing limiter reduces peaks but is not a brick-wall or true-peak guarantee.

See the [Product & Functional Reference](https://symphonycsvstudio.com/help/reference/#mixer) for the audio signal flow. The three musical CSV schemas remain unchanged.

The JSON field dictionaries are in ../schemas/ and accepted QA examples in ../examples/.
