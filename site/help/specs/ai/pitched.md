# Piano Roll / Pitched CSV — SymphonyCSV Studio RC1

Tracks 1–2; exact RC1 header count: 86. The older 85-column format remains accepted.

## Authoring rules

- Use the blank-template ZIP and preserve all header names and their exact order.
- Human composer owns musical decisions; AI assistance is optional.
- Use UTF-8 CSV with standard quoted fields and no unrelated columns.
- Do not invent notation or silent defaults. Blank panning means native SoundFont placement; 0 means centre.
- Every per-event pan is a whole integer between -100 and +100.
- The composition ends at its declared final full-measure barline.
- Treat the Rust/WASM parser as authoritative; consult validation errors for advanced fields.

## MIDI import and Pan_Position

When using Studio's MIDI Import workspace, MIDI channel CC10 (0 left, 64 centre, 127 right) is read at each pitched note onset and converted to the whole-number `Pan_Position` range −100..+100. The active CC10 is tracked per source MIDI channel, including controller messages on separate MIDI tracks. CC121 resets MIDI pan to centre (CSV 0). If no CC10/reset was encountered on that channel, leave `Pan_Position` blank; do not replace blank with zero.

This is a per-event snapshot, not a continuous MIDI controller automation lane. Mid-note pan sweeps are not reproduced and generate an import warning. Equal-tick ordering is deterministic by source track and event sequence. Other continuous controllers and original MIDI programs do not become Studio note events. The separate `cc10_pan` controller field, if present in the Pitched schema, is not populated redundantly by the importer.

## Exact RC1 CSV header

```csv
staff,measure,count_aloud,running_time,pitch_label,duration_beats,duration_ms,velocity,tempo_bpm,time_signature,key_signature,instrument,event_type,event_id,onset_beat_in_measure,onset_ms,end_ms,midi_pitch,velocity_description,written_pitch,pitch_spelling_source,clef,clef_sign,clef_line,voice,notated_type,notated_duration_beats,notated_dots,tie_start,tie_stop,articulation,beam,midi_file_format,ticks_per_quarter,midi_track,midi_track_name,midi_channel,midi_program,program_change_emit,program_source,midi_bank_msb,midi_bank_lsb,note_off_method,note_off_velocity,absolute_tick,onset_tick_in_measure,duration_ticks,end_tick,tempo_us_per_quarter,tempo_beat_unit,pitch_octave_convention,tick_rounding_policy,same_tick_event_order,time_signature_num,time_signature_den,key_signature_fifths,key_signature_mode,controller_number,controller_value,cc1_modulation,cc2_breath,cc7_channel_volume,cc10_pan,cc11_expression,cc64_sustain,cc91_reverb_send,cc93_chorus_send,pitch_bend,channel_aftertouch,poly_aftertouch,sysex_payload,controller_event_policy,composition_title,composer,composition_total_measures,composition_end_tick,composition_duration,lyric,marker,source_note_data,source_clef,source_key_signature,source_instrument,source_license,source_url,Pan_Position
```

## Column-by-column guide

### 1. `staff`
Type: Text. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Names the notation staff for this event.

Accepted values / units: Text, e.g. Upper staff or Lower staff

Blank meaning: Not valid for a sounding Pitched event.

### 2. `measure`
Type: Integer. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: One-based bar number in the composition.

Accepted values / units: Positive integer, 1 = first bar

Blank meaning: Required for every event.

### 3. `count_aloud`
Type: Text. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Human-friendly counted onset inside the bar.

Accepted values / units: Meter-specific count, e.g. One, Two and

Blank meaning: Required on Pitched note rows.

### 4. `running_time`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Display of the event onset on the whole-piece clock.

Accepted values / units: m minutes and two-digit seconds; e.g. 0m 02s

Blank meaning: Regenerate; do not invent it independently.

### 5. `pitch_label`
Type: Text. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Sounding concert pitch, including octave. Middle C is C4.

Accepted values / units: Pitch such as C4, F#5 or Bb3

Blank meaning: Required for a Pitched note.

### 6. `duration_beats`
Type: Decimal. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Sounding note length measured in quarter-note beats.

Accepted values / units: Positive decimal; 1 = quarter note, 0.25 = sixteenth

Blank meaning: Required for a sounding note.

### 7. `duration_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Calculated duration of the event in milliseconds.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from authoritative timing.

### 8. `velocity`
Type: Integer. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: MIDI note-on attack strength, not mixer volume.

Accepted values / units: Integer 1–127; 64 is a common starting choice

Blank meaning: Required for a sounding note.

### 9. `tempo_bpm`
Type: Decimal. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Composition tempo expressed as quarter notes per minute.

Accepted values / units: Positive number, e.g. 92 or 120

Blank meaning: Required; must agree across imported parts.

### 10. `time_signature`
Type: Text. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Meter used to interpret bars and counts.

Accepted values / units: Text, e.g. 4/4; historical manual defines 2/4,3/4,4/4,5/4,6/8,7/8

Blank meaning: Required; must agree across imported parts.

### 11. `key_signature`
Type: Text. Responsibility: Composer. Requirement: Conditional / optional / derived.

Meaning: Notated tonal key, distinct from the actual MIDI pitches.

Accepted values / units: Text, e.g. C major, Bb major

Blank meaning: Do not infer or silently change a composer-selected key.

### 12. `instrument`
Type: Text. Responsibility: Composer. Requirement: Conditional / optional / derived.

Meaning: Human-readable musical part or instrument name.

Accepted values / units: Text, e.g. Piano, Bass, Strings

Blank meaning: Historical default Piano; Studio routing is track-specific.

### 13. `event_type`
Type: Enum. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Kind of musical event represented by the row.

Accepted values / units: Pitched baseline: note

Blank meaning: Required event classification.

### 14. `event_id`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Stable, unique identifier used to review edits and receipts.

Accepted values / units: Text ID; e.g. N00001

Blank meaning: Do not silently regenerate IDs of surviving notes.

### 15. `onset_beat_in_measure`
Type: Decimal. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Numerical beat offset expressed with 1 at the barline.

Accepted values / units: Decimal, 1 + elapsed quarter-note beats in the bar

Blank meaning: Derived from count and meter.

### 16. `onset_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Event attack position from the start of the composition.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from tempo and tick position.

### 17. `end_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Event release position from composition start.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from onset and sounding duration.

### 18. `midi_pitch`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Absolute MIDI note number for the sounding pitch.

Accepted values / units: Integer 0–127; C4 = 60

Blank meaning: Derived from pitch_label for Pitched notes.

### 19. `velocity_description`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Readable dynamic description of the note velocity.

Accepted values / units: Text such as p, mf or Medium

Blank meaning: Display-level derived value; do not use instead of velocity.

### 20. `written_pitch`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Optional engraved spelling, which may differ enharmonically from the sounding label.

Accepted values / units: Text, e.g. Bb3 in place of A#3

Blank meaning: No explicit spelling asserted.

### 21. `pitch_spelling_source`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Records how an engraving spelling was obtained.

Accepted values / units: Text, e.g. composer, score or inference

Blank meaning: No provenance assertion.

### 22. `clef`
Type: Text. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Clef to present on the staff.

Accepted values / units: Text, e.g. Treble or Bass

Blank meaning: May be derived from the staff mapping.

### 23. `clef_sign`
Type: Text. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Notation clef sign associated with the clef.

Accepted values / units: Typically G or F for pitched staves

Blank meaning: Derived from clef if omitted.

### 24. `clef_line`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Staff line where the clef sign is anchored.

Accepted values / units: Integer; typical G clef = 2, F clef = 4

Blank meaning: Derived from clef when possible.

### 25. `voice`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Voice number for notation within the staff.

Accepted values / units: Positive integer

Blank meaning: Exporter or reader may infer a notation voice.

### 26. `notated_type`
Type: Enum. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Engraved duration category, independently of sounding duration.

Accepted values / units: whole, half, quarter, eighth, 16th in historical guide

Blank meaning: Reader may choose notated appearance; no assertion.

### 27. `notated_duration_beats`
Type: Decimal. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Optional written note value in quarter-note beats.

Accepted values / units: Positive decimal

Blank meaning: Follow sounding duration when not separately specified.

### 28. `notated_dots`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Augmentation-dot count for written notation.

Accepted values / units: Nonnegative integer

Blank meaning: Notation may infer dotting.

### 29. `tie_start`
Type: Boolean. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Notation flag indicating the beginning of a tie.

Accepted values / units: Boolean text / encoded truth value

Blank meaning: No start of tie explicitly asserted.

### 30. `tie_stop`
Type: Boolean. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Notation flag indicating the end of a tie.

Accepted values / units: Boolean text / encoded truth value

Blank meaning: No end of tie explicitly asserted.

### 31. `articulation`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Written/performance articulation of the event.

Accepted values / units: Text such as staccato, accent, tenuto, marcato

Blank meaning: No articulation specified.

### 32. `beam`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Explicit beaming role in notated rhythm.

Accepted values / units: begin, continue or end in original manual

Blank meaning: Notation may infer beaming.

### 33. `midi_file_format`
Type: Integer. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Standard MIDI File structural format policy.

Accepted values / units: Integer, historical default 1

Blank meaning: Must use consistent export policy.

### 34. `ticks_per_quarter`
Type: Integer. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: MIDI timeline resolution: ticks per quarter note.

Accepted values / units: Positive integer; current fixtures commonly use 480

Blank meaning: Do not assume a hard-coded value; read the file.

### 35. `midi_track`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Track number used in MIDI export and mappings.

Accepted values / units: Nonnegative integer; conductor often track 0

Blank meaning: May be mapped from Studio track/staff.

### 36. `midi_track_name`
Type: Text. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Readable name of the target MIDI track.

Accepted values / units: Text

Blank meaning: Can be derived from part/staff if absent.

### 37. `midi_channel`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: MIDI channel assigned to this part.

Accepted values / units: Integer 1–16 in the format documentation

Blank meaning: Requires track/part mapping if absent.

### 38. `midi_program`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Zero-based General MIDI program number.

Accepted values / units: Integer 0–127; Acoustic Grand Piano = 0

Blank meaning: Mapped or chosen by instrument profile.

### 39. `program_change_emit`
Type: Yes/No. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Whether a MIDI program-change event should be emitted.

Accepted values / units: Yes or No

Blank meaning: Historical default No; do not emit changes unasked.

### 40. `program_source`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Provenance of the MIDI program selection.

Accepted values / units: Text

Blank meaning: No source assertion.

### 41. `midi_bank_msb`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Optional MIDI bank-select most-significant byte, CC0.

Accepted values / units: Integer 0–127

Blank meaning: No bank event requested.

### 42. `midi_bank_lsb`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Optional MIDI bank-select least-significant byte, CC32.

Accepted values / units: Integer 0–127

Blank meaning: No bank event requested.

### 43. `note_off_method`
Type: Enum. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Policy for serializing note release events.

Accepted values / units: note_off or note_on_velocity_zero

Blank meaning: Historical default note_on_velocity_zero.

### 44. `note_off_velocity`
Type: Integer. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Release velocity when a note-off is sent.

Accepted values / units: Integer 0–127; often 0

Blank meaning: Historical default 0.

### 45. `absolute_tick`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Onset tick counted from the composition start.

Accepted values / units: Nonnegative integer

Blank meaning: Recompute from measure and local onset.

### 46. `onset_tick_in_measure`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Tick offset after the start of the bar.

Accepted values / units: Nonnegative integer

Blank meaning: Recompute from local onset.

### 47. `duration_ticks`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Sounding duration in MIDI ticks.

Accepted values / units: Positive integer for sounding notes

Blank meaning: Recompute from beats and tick resolution.

### 48. `end_tick`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Absolute release tick of the note.

Accepted values / units: Nonnegative integer; onset tick + duration ticks

Blank meaning: Recompute from event timing.

### 49. `tempo_us_per_quarter`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: MIDI tempo as microseconds for one quarter note.

Accepted values / units: Positive integer; 60,000,000 / tempo_bpm

Blank meaning: Recompute from tempo_bpm.

### 50. `tempo_beat_unit`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Unit against which the BPM count is expressed.

Accepted values / units: quarter in the original six-meter baseline

Blank meaning: Historical policy is quarter.

### 51. `pitch_octave_convention`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Defines the pitch/octave naming system.

Accepted values / units: C4=60 in the reference format

Blank meaning: Policy must remain consistent.

### 52. `tick_rounding_policy`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: States how fractional tick results are rounded/handled.

Accepted values / units: Text policy; respect actual imported policy

Blank meaning: Do not silently invent new rounding.

### 53. `same_tick_event_order`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Ordering policy for simultaneous note releases and attacks.

Accepted values / units: note_off_before_note_on in reference

Blank meaning: Protect deterministic retrigger ordering.

### 54. `time_signature_num`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Numerator derived from the time signature.

Accepted values / units: Positive integer, e.g. 4 for 4/4

Blank meaning: Computed from time_signature.

### 55. `time_signature_den`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Denominator derived from the time signature.

Accepted values / units: Positive integer, e.g. 4 for 4/4

Blank meaning: Computed from time_signature.

### 56. `key_signature_fifths`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Circle-of-fifths encoding of key signature.

Accepted values / units: Integer; flats negative, sharps positive

Blank meaning: Derived from key_signature.

### 57. `key_signature_mode`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Major/minor designation for MIDI key signature.

Accepted values / units: major or minor

Blank meaning: Derived from key_signature.

### 58. `controller_number`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Generic MIDI Continuous Controller number.

Accepted values / units: Integer 0–127

Blank meaning: No generic controller event.

### 59. `controller_value`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Value for the generic MIDI controller above.

Accepted values / units: Integer 0–127; zero is explicit

Blank meaning: No generic controller event; verify paired fields.

### 60. `cc1_modulation`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC1 modulation amount.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 61. `cc2_breath`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC2 breath controller amount.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 62. `cc7_channel_volume`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC7 channel volume; different from note velocity.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 63. `cc10_pan`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC10 pan position.

Accepted values / units: Integer 0–127; centre 64

Blank meaning: Do not emit controller event.

### 64. `cc11_expression`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC11 musical expression amount.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 65. `cc64_sustain`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC64 sustain-pedal state.

Accepted values / units: Integer 0–127; >=64 generally on

Blank meaning: Blank means no event, not pedal release.

### 66. `cc91_reverb_send`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC91 reverb send, not Studio’s necessarily separate audio effect settings.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 67. `cc93_chorus_send`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC93 chorus send, not Studio’s necessarily separate audio effect settings.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 68. `pitch_bend`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Raw MIDI pitch bend position for this event.

Accepted values / units: Integer 0–16383; centre 8192

Blank meaning: No pitch-bend message requested.

### 69. `channel_aftertouch`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Channel-wide pressure aftertouch amount.

Accepted values / units: Integer 0–127

Blank meaning: No channel-pressure event.

### 70. `poly_aftertouch`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Per-note pressure aftertouch amount.

Accepted values / units: Integer 0–127

Blank meaning: No per-note aftertouch event.

### 71. `sysex_payload`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI System Exclusive content if implemented by an exporter.

Accepted values / units: Text payload; codec/encoding must be specified separately

Blank meaning: No SysEx message.

### 72. `controller_event_policy`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Describes whether an empty controller column emits an event.

Accepted values / units: Text policy; reference: blank = emit no event

Blank meaning: Do not assume unspecified controller events.

### 73. `composition_title`
Type: Text. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Title establishing the identity of the shared composition.

Accepted values / units: Text; identical across participating tracks

Blank meaning: Required to establish/import a composition.

### 74. `composer`
Type: Text. Responsibility: Composer. Requirement: Conditional / optional / derived.

Meaning: Human-approved composer credit.

Accepted values / units: Text

Blank meaning: Never fabricate a composer credit.

### 75. `composition_total_measures`
Type: Integer. Responsibility: Computed. Requirement: Required event/composition value.

Meaning: Declared total number of full measures in the composition.

Accepted values / units: Positive integer; same across tracks

Blank meaning: Required for synchronized composition identity.

### 76. `composition_end_tick`
Type: Integer. Responsibility: Computed. Requirement: Required event/composition value.

Meaning: Final measure closing barline, independent of final note onset.

Accepted values / units: Integer computed from meter × ticks-per-quarter × total measures

Blank meaning: Recompute/verify; do not end early at last note.

### 77. `composition_duration`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Readable whole-piece length for display.

Accepted values / units: Text such as 0m 08s

Blank meaning: Derived from full-measure composition length.

### 78. `lyric`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Lyric syllable attached to the musical event.

Accepted values / units: Text

Blank meaning: No lyric attached.

### 79. `marker`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Section marker or structural cue at an onset.

Accepted values / units: Text

Blank meaning: No marker attached.

### 80. `source_note_data`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains the provenance of note content.

Accepted values / units: Text

Blank meaning: No note-source claim recorded.

### 81. `source_clef`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains where the chosen clef came from.

Accepted values / units: Text

Blank meaning: No clef-source claim.

### 82. `source_key_signature`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains evidence for the selected key signature.

Accepted values / units: Text

Blank meaning: No key-source claim.

### 83. `source_instrument`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains the observed or authored instrument/program choice.

Accepted values / units: Text

Blank meaning: No instrument-source claim.

### 84. `source_license`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Describes the rights/licence of source musical material.

Accepted values / units: Text; verify externally before redistributing

Blank meaning: No licence claim. Do not assume public domain.

### 85. `source_url`
Type: URL. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: A source reference for provenance and attribution.

Accepted values / units: URL text

Blank meaning: No source URL claimed.

### 86. `Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places this musical note or drum hit in the stereo field; each event can be positioned independently.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by RC1 pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −40, 0, 70, or blank


## Source and compatibility

Verified against RC1 fixture: tests/fixtures/SymphonyCSV_Pitched_Pan_QA_2Measures_86col.csv. Legacy order verified against Track_01_A_Criminal_Mind_Piano.csv.

Descriptions inherited from earlier dictionary should be treated as guidance wherever not specifically proven by RC1 integration tests.
