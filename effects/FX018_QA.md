# FX018 - Bitcrusher: Manual QA

Date: 2026-11-09
Engine: Tone.js 15.1.22
Environment: Local Vite browser laboratory

Result: PASS - User confirmed working audible prototype.

Implemented:
- Adjustable bit depth (1 to 16 bits)
- Presets for 16, 8, 4 and 2 bits
- Wet/dry mixing
- Bypass
- Sustained C3 synthesizer audition
- Browser pagehide resource cleanup

Evidence limitations:
- Audible prototype operation confirmed by user.
- Individual control responses not independently documented.
- Quantization distortion not quantitatively measured.
- Sample-rate reduction is not implemented.
- Output peak levels not measured.
- Automated audio testing pending.
- Effects-chain compatibility not yet tested.
- SoundFont integration pending.
- Resource cleanup implemented but not independently verified.

Next:
- Verify bit-depth changes independently.
- Measure quantization artifacts.
- Check output levels at low bit depths.
- Evaluate sample-rate reduction as a future enhancement.
- Test effects-chain integration.
- Add automated audio tests.
