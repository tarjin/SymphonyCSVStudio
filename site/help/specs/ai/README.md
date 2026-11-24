# SymphonyCSV Studio — LABS RC1 AI entry point

This documentation was generated after verifying exact headers against Checkpoint 072 (a45dad7), and successfully running the RC1 Rust/WASM panning test.

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
7. Show changes and run the RC1 validator; a plausible CSV is not necessarily an accepted CSV.
8. Treat descriptions for uncommon fields as documented guidance rather than a guarantee of accepted enumerations.

The JSON field dictionaries are in ../schemas/ and accepted QA examples in ../examples/.
