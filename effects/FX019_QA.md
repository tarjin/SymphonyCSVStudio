# FX019 - Pitch Shifter: Manual QA

Date: 2026-11-09
Engine: Tone.js 15.1.22
Environment: Local Vite browser laboratory

Result: PASS - User confirmed working audible prototype.

Implemented:
- Adjustable pitch shift (-12 to +12 semitones)
- Presets for octave down, unison, fifth up, octave up
- Adjustable window size (0.03 to 0.1 seconds)
- Feedback (0 to 0.5)
- Wet/dry mixing
- Bypass
- Sustained C3 synthesizer audition
- Browser pagehide resource cleanup

Evidence limitations:
- Audible prototype operation confirmed by user.
- Exact transposition accuracy not independently measured.
- Individual control responses not separately documented.
- Pitch-shifting artifacts and latency not measured.
- Feedback behavior not quantitatively verified.
- Automated audio testing pending.
- Effects-chain compatibility not yet tested.
- SoundFont integration pending.
- Resource cleanup implemented but not independently verified.

Next:
- Verify transposition accuracy at -12, 0, +7 and +12.
- Measure latency and pitch-shifting artifacts.
- Verify feedback and window-size behavior.
- Test within configurable effects chains.
- Test with SoundFont instruments.
- Add automated audio tests.
