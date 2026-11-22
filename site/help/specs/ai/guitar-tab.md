# Guitar TAB CSV — SymphonyCSV Studio RC1

Tracks 3–4; exact RC1 header count: 135. The older 129-column format remains accepted.

## Authoring rules

- Use the blank-template ZIP and preserve all header names and their exact order.
- Human composer owns musical decisions; AI assistance is optional.
- Use UTF-8 CSV with standard quoted fields and no unrelated columns.
- Do not invent notation or silent defaults. Blank panning means native SoundFont placement; 0 means centre.
- Every per-event pan is a whole integer between -100 and +100.
- The composition ends at its declared final full-measure barline.
- Treat the Rust/WASM parser as authoritative; consult validation errors for advanced fields.

## Exact RC1 CSV header

```csv
staff,measure,count_aloud,running_time,duration_beats,duration_ms,velocity,tempo_bpm,time_signature,key_signature,instrument,event_type,event_id,onset_beat_in_measure,onset_ms,end_ms,velocity_description,clef,clef_sign,clef_line,voice,notated_type,notated_duration_beats,notated_dots,tie_start,tie_stop,articulation,beam,midi_file_format,ticks_per_quarter,midi_track,midi_track_name,midi_channel,midi_program,program_change_emit,program_source,midi_bank_msb,midi_bank_lsb,note_off_method,note_off_velocity,absolute_tick,onset_tick_in_measure,duration_ticks,end_tick,tempo_us_per_quarter,tempo_beat_unit,pitch_octave_convention,tick_rounding_policy,same_tick_event_order,time_signature_num,time_signature_den,key_signature_fifths,key_signature_mode,controller_number,controller_value,cc1_modulation,cc2_breath,cc7_channel_volume,cc10_pan,cc11_expression,cc64_sustain,cc91_reverb_send,cc93_chorus_send,pitch_bend,channel_aftertouch,poly_aftertouch,sysex_payload,controller_event_policy,composition_title,composer,composition_total_measures,composition_end_tick,composition_duration,lyric,marker,source_note_data,source_clef,source_key_signature,source_instrument,source_license,source_url,HighE_Fret,B_Fret,G_Fret,D_Fret,A_Fret,LowE_Fret,HighE_TuneOffset_st,B_TuneOffset_st,G_TuneOffset_st,D_TuneOffset_st,A_TuneOffset_st,LowE_TuneOffset_st,HighE_Articulation,B_Articulation,G_Articulation,D_Articulation,A_Articulation,LowE_Articulation,HighE_TargetFret,B_TargetFret,G_TargetFret,D_TargetFret,A_TargetFret,LowE_TargetFret,LowE_Velocity,A_Velocity,D_Velocity,G_Velocity,B_Velocity,HighE_Velocity,String_Emphasis,LowE_Duration_Beats,A_Duration_Beats,D_Duration_Beats,G_Duration_Beats,B_Duration_Beats,HighE_Duration_Beats,Stroke_Direction,Stroke_Strings,Strum_Spread_ms,Picking_Method,Palm_Mute,Let_Ring,Capo_Fret,measure_start_tick,measure_start_ms,measure_end_tick,measure_end_ms,String_1_Pan_Position,String_2_Pan_Position,String_3_Pan_Position,String_4_Pan_Position,String_5_Pan_Position,String_6_Pan_Position
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

### 5. `duration_beats`
Type: Decimal. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Sounding note length measured in quarter-note beats.

Accepted values / units: Positive decimal; 1 = quarter note, 0.25 = sixteenth

Blank meaning: Required for a sounding note.

### 6. `duration_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Calculated duration of the event in milliseconds.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from authoritative timing.

### 7. `velocity`
Type: Integer. Responsibility: Composer. Requirement: Conditional / optional / derived.

Meaning: MIDI note-on attack strength, not mixer volume.

Accepted values / units: Integer 1–127; 64 is a common starting choice

Blank meaning: Required for a sounding note.

### 8. `tempo_bpm`
Type: Decimal. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Composition tempo expressed as quarter notes per minute.

Accepted values / units: Positive number, e.g. 92 or 120

Blank meaning: Required; must agree across imported parts.

### 9. `time_signature`
Type: Text. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Meter used to interpret bars and counts.

Accepted values / units: Text, e.g. 4/4; historical manual defines 2/4,3/4,4/4,5/4,6/8,7/8

Blank meaning: Required; must agree across imported parts.

### 10. `key_signature`
Type: Text. Responsibility: Composer. Requirement: Conditional / optional / derived.

Meaning: Notated tonal key, distinct from the actual MIDI pitches.

Accepted values / units: Text, e.g. C major, Bb major

Blank meaning: Do not infer or silently change a composer-selected key.

### 11. `instrument`
Type: Text. Responsibility: Composer. Requirement: Conditional / optional / derived.

Meaning: Human-readable musical part or instrument name.

Accepted values / units: Text, e.g. Piano, Bass, Strings

Blank meaning: Historical default Piano; Studio routing is track-specific.

### 12. `event_type`
Type: Enum. Responsibility: Mapped default. Requirement: Required event/composition value.

Meaning: TAB chord, strum or rest classification driving which string data apply.

Accepted values / units: tab_chord and rest observed in historical examples; validate other events with current Rust core.

Blank meaning: Event type must be explicit.

### 13. `event_id`
Type: Text. Responsibility: Computed. Requirement: Required event/composition value.

Meaning: Stable, unique identifier used to review edits and receipts.

Accepted values / units: Text ID; e.g. N00001

Blank meaning: Do not silently regenerate IDs of surviving notes.

### 14. `onset_beat_in_measure`
Type: Decimal. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Numerical beat offset expressed with 1 at the barline.

Accepted values / units: Decimal, 1 + elapsed quarter-note beats in the bar

Blank meaning: Derived from count and meter.

### 15. `onset_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Event attack position from the start of the composition.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from tempo and tick position.

### 16. `end_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Event release position from composition start.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from onset and sounding duration.

### 17. `velocity_description`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Readable dynamic description of the note velocity.

Accepted values / units: Text such as p, mf or Medium

Blank meaning: Display-level derived value; do not use instead of velocity.

### 18. `clef`
Type: Text. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Clef to present on the staff.

Accepted values / units: Text, e.g. Treble or Bass

Blank meaning: May be derived from the staff mapping.

### 19. `clef_sign`
Type: Text. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Notation clef sign associated with the clef.

Accepted values / units: Typically G or F for pitched staves

Blank meaning: Derived from clef if omitted.

### 20. `clef_line`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Staff line where the clef sign is anchored.

Accepted values / units: Integer; typical G clef = 2, F clef = 4

Blank meaning: Derived from clef when possible.

### 21. `voice`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Voice number for notation within the staff.

Accepted values / units: Positive integer

Blank meaning: Exporter or reader may infer a notation voice.

### 22. `notated_type`
Type: Enum. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Engraved duration category, independently of sounding duration.

Accepted values / units: whole, half, quarter, eighth, 16th in historical guide

Blank meaning: Reader may choose notated appearance; no assertion.

### 23. `notated_duration_beats`
Type: Decimal. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Optional written note value in quarter-note beats.

Accepted values / units: Positive decimal

Blank meaning: Follow sounding duration when not separately specified.

### 24. `notated_dots`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Augmentation-dot count for written notation.

Accepted values / units: Nonnegative integer

Blank meaning: Notation may infer dotting.

### 25. `tie_start`
Type: Boolean. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Notation flag indicating the beginning of a tie.

Accepted values / units: Boolean text / encoded truth value

Blank meaning: No start of tie explicitly asserted.

### 26. `tie_stop`
Type: Boolean. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Notation flag indicating the end of a tie.

Accepted values / units: Boolean text / encoded truth value

Blank meaning: No end of tie explicitly asserted.

### 27. `articulation`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Written/performance articulation of the event.

Accepted values / units: Text such as staccato, accent, tenuto, marcato

Blank meaning: No articulation specified.

### 28. `beam`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Explicit beaming role in notated rhythm.

Accepted values / units: begin, continue or end in original manual

Blank meaning: Notation may infer beaming.

### 29. `midi_file_format`
Type: Integer. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Standard MIDI File structural format policy.

Accepted values / units: Integer, historical default 1

Blank meaning: Must use consistent export policy.

### 30. `ticks_per_quarter`
Type: Integer. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: MIDI timeline resolution: ticks per quarter note.

Accepted values / units: Positive integer; current fixtures commonly use 480

Blank meaning: Do not assume a hard-coded value; read the file.

### 31. `midi_track`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Track number used in MIDI export and mappings.

Accepted values / units: Nonnegative integer; conductor often track 0

Blank meaning: May be mapped from Studio track/staff.

### 32. `midi_track_name`
Type: Text. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Readable name of the target MIDI track.

Accepted values / units: Text

Blank meaning: Can be derived from part/staff if absent.

### 33. `midi_channel`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: MIDI channel assigned to this part.

Accepted values / units: Integer 1–16 in the format documentation

Blank meaning: Requires track/part mapping if absent.

### 34. `midi_program`
Type: Integer. Responsibility: Mapped default. Requirement: Conditional / optional / derived.

Meaning: Zero-based General MIDI program number.

Accepted values / units: Integer 0–127; Acoustic Grand Piano = 0

Blank meaning: Mapped or chosen by instrument profile.

### 35. `program_change_emit`
Type: Yes/No. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Whether a MIDI program-change event should be emitted.

Accepted values / units: Yes or No

Blank meaning: Historical default No; do not emit changes unasked.

### 36. `program_source`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Provenance of the MIDI program selection.

Accepted values / units: Text

Blank meaning: No source assertion.

### 37. `midi_bank_msb`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Optional MIDI bank-select most-significant byte, CC0.

Accepted values / units: Integer 0–127

Blank meaning: No bank event requested.

### 38. `midi_bank_lsb`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Optional MIDI bank-select least-significant byte, CC32.

Accepted values / units: Integer 0–127

Blank meaning: No bank event requested.

### 39. `note_off_method`
Type: Enum. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Policy for serializing note release events.

Accepted values / units: note_off or note_on_velocity_zero

Blank meaning: Historical default note_on_velocity_zero.

### 40. `note_off_velocity`
Type: Integer. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Release velocity when a note-off is sent.

Accepted values / units: Integer 0–127; often 0

Blank meaning: Historical default 0.

### 41. `absolute_tick`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Onset tick counted from the composition start.

Accepted values / units: Nonnegative integer

Blank meaning: Recompute from measure and local onset.

### 42. `onset_tick_in_measure`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Tick offset after the start of the bar.

Accepted values / units: Nonnegative integer

Blank meaning: Recompute from local onset.

### 43. `duration_ticks`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Sounding duration in MIDI ticks.

Accepted values / units: Positive integer for sounding notes

Blank meaning: Recompute from beats and tick resolution.

### 44. `end_tick`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Absolute release tick of the note.

Accepted values / units: Nonnegative integer; onset tick + duration ticks

Blank meaning: Recompute from event timing.

### 45. `tempo_us_per_quarter`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: MIDI tempo as microseconds for one quarter note.

Accepted values / units: Positive integer; 60,000,000 / tempo_bpm

Blank meaning: Recompute from tempo_bpm.

### 46. `tempo_beat_unit`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Unit against which the BPM count is expressed.

Accepted values / units: quarter in the original six-meter baseline

Blank meaning: Historical policy is quarter.

### 47. `pitch_octave_convention`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Defines the pitch/octave naming system.

Accepted values / units: C4=60 in the reference format

Blank meaning: Policy must remain consistent.

### 48. `tick_rounding_policy`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: States how fractional tick results are rounded/handled.

Accepted values / units: Text policy; respect actual imported policy

Blank meaning: Do not silently invent new rounding.

### 49. `same_tick_event_order`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Ordering policy for simultaneous note releases and attacks.

Accepted values / units: note_off_before_note_on in reference

Blank meaning: Protect deterministic retrigger ordering.

### 50. `time_signature_num`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Numerator derived from the time signature.

Accepted values / units: Positive integer, e.g. 4 for 4/4

Blank meaning: Computed from time_signature.

### 51. `time_signature_den`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Denominator derived from the time signature.

Accepted values / units: Positive integer, e.g. 4 for 4/4

Blank meaning: Computed from time_signature.

### 52. `key_signature_fifths`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Circle-of-fifths encoding of key signature.

Accepted values / units: Integer; flats negative, sharps positive

Blank meaning: Derived from key_signature.

### 53. `key_signature_mode`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Major/minor designation for MIDI key signature.

Accepted values / units: major or minor

Blank meaning: Derived from key_signature.

### 54. `controller_number`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Generic MIDI Continuous Controller number.

Accepted values / units: Integer 0–127

Blank meaning: No generic controller event.

### 55. `controller_value`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Value for the generic MIDI controller above.

Accepted values / units: Integer 0–127; zero is explicit

Blank meaning: No generic controller event; verify paired fields.

### 56. `cc1_modulation`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC1 modulation amount.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 57. `cc2_breath`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC2 breath controller amount.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 58. `cc7_channel_volume`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC7 channel volume; different from note velocity.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 59. `cc10_pan`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC10 pan position.

Accepted values / units: Integer 0–127; centre 64

Blank meaning: Do not emit controller event.

### 60. `cc11_expression`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC11 musical expression amount.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 61. `cc64_sustain`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC64 sustain-pedal state.

Accepted values / units: Integer 0–127; >=64 generally on

Blank meaning: Blank means no event, not pedal release.

### 62. `cc91_reverb_send`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC91 reverb send, not Studio’s necessarily separate audio effect settings.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 63. `cc93_chorus_send`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI CC93 chorus send, not Studio’s necessarily separate audio effect settings.

Accepted values / units: Integer 0–127

Blank meaning: Do not emit controller event.

### 64. `pitch_bend`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Raw MIDI pitch bend position for this event.

Accepted values / units: Integer 0–16383; centre 8192

Blank meaning: No pitch-bend message requested.

### 65. `channel_aftertouch`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Channel-wide pressure aftertouch amount.

Accepted values / units: Integer 0–127

Blank meaning: No channel-pressure event.

### 66. `poly_aftertouch`
Type: Integer. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Per-note pressure aftertouch amount.

Accepted values / units: Integer 0–127

Blank meaning: No per-note aftertouch event.

### 67. `sysex_payload`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: MIDI System Exclusive content if implemented by an exporter.

Accepted values / units: Text payload; codec/encoding must be specified separately

Blank meaning: No SysEx message.

### 68. `controller_event_policy`
Type: Text. Responsibility: Policy. Requirement: Conditional / optional / derived.

Meaning: Describes whether an empty controller column emits an event.

Accepted values / units: Text policy; reference: blank = emit no event

Blank meaning: Do not assume unspecified controller events.

### 69. `composition_title`
Type: Text. Responsibility: Composer. Requirement: Required event/composition value.

Meaning: Title establishing the identity of the shared composition.

Accepted values / units: Text; identical across participating tracks

Blank meaning: Required to establish/import a composition.

### 70. `composer`
Type: Text. Responsibility: Composer. Requirement: Conditional / optional / derived.

Meaning: Human-approved composer credit.

Accepted values / units: Text

Blank meaning: Never fabricate a composer credit.

### 71. `composition_total_measures`
Type: Integer. Responsibility: Computed. Requirement: Required event/composition value.

Meaning: Declared total number of full measures in the composition.

Accepted values / units: Positive integer; same across tracks

Blank meaning: Required for synchronized composition identity.

### 72. `composition_end_tick`
Type: Integer. Responsibility: Computed. Requirement: Required event/composition value.

Meaning: Closing full-measure barline shared with all parts; not the tick of the last guitar chord.

Accepted values / units: Integer computed from meter × ticks-per-quarter × total measures

Blank meaning: Recompute/verify; do not end early at last note.

### 73. `composition_duration`
Type: Text. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Readable whole-piece length for display.

Accepted values / units: Text such as 0m 08s

Blank meaning: Derived from full-measure composition length.

### 74. `lyric`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Lyric syllable attached to the musical event.

Accepted values / units: Text

Blank meaning: No lyric attached.

### 75. `marker`
Type: Text. Responsibility: Composer, optional. Requirement: Conditional / optional / derived.

Meaning: Section marker or structural cue at an onset.

Accepted values / units: Text

Blank meaning: No marker attached.

### 76. `source_note_data`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains the provenance of note content.

Accepted values / units: Text

Blank meaning: No note-source claim recorded.

### 77. `source_clef`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains where the chosen clef came from.

Accepted values / units: Text

Blank meaning: No clef-source claim.

### 78. `source_key_signature`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains evidence for the selected key signature.

Accepted values / units: Text

Blank meaning: No key-source claim.

### 79. `source_instrument`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Explains the observed or authored instrument/program choice.

Accepted values / units: Text

Blank meaning: No instrument-source claim.

### 80. `source_license`
Type: Text. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: Describes the rights/licence of source musical material.

Accepted values / units: Text; verify externally before redistributing

Blank meaning: No licence claim. Do not assume public domain.

### 81. `source_url`
Type: URL. Responsibility: Source. Requirement: Conditional / optional / derived.

Meaning: A source reference for provenance and attribution.

Accepted values / units: URL text

Blank meaning: No source URL claimed.

### 82. `HighE_Fret`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Fret selected on the HighE guitar string for this chord event.

Accepted values / units: Integer fret position, 0 for open; blank when not played

Blank meaning: String is not selected by this field alone; inspect Stroke_Strings and event type.

### 83. `B_Fret`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Fret selected on the B guitar string for this chord event.

Accepted values / units: Integer fret position, 0 for open; blank when not played

Blank meaning: String is not selected by this field alone; inspect Stroke_Strings and event type.

### 84. `G_Fret`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Fret selected on the G guitar string for this chord event.

Accepted values / units: Integer fret position, 0 for open; blank when not played

Blank meaning: String is not selected by this field alone; inspect Stroke_Strings and event type.

### 85. `D_Fret`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Fret selected on the D guitar string for this chord event.

Accepted values / units: Integer fret position, 0 for open; blank when not played

Blank meaning: String is not selected by this field alone; inspect Stroke_Strings and event type.

### 86. `A_Fret`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Fret selected on the A guitar string for this chord event.

Accepted values / units: Integer fret position, 0 for open; blank when not played

Blank meaning: String is not selected by this field alone; inspect Stroke_Strings and event type.

### 87. `LowE_Fret`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Fret selected on the LowE guitar string for this chord event.

Accepted values / units: Integer fret position, 0 for open; blank when not played

Blank meaning: String is not selected by this field alone; inspect Stroke_Strings and event type.

### 88. `HighE_TuneOffset_st`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Static pitch offset for the HighE string, measured in semitones.

Accepted values / units: Signed integer semitones in current Rust validation; e.g. -2, 0, +1

Blank meaning: Confirm inherited/zero offset with the actual parser; do not guess fractions.

### 89. `B_TuneOffset_st`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Static pitch offset for the B string, measured in semitones.

Accepted values / units: Signed integer semitones in current Rust validation; e.g. -2, 0, +1

Blank meaning: Confirm inherited/zero offset with the actual parser; do not guess fractions.

### 90. `G_TuneOffset_st`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Static pitch offset for the G string, measured in semitones.

Accepted values / units: Signed integer semitones in current Rust validation; e.g. -2, 0, +1

Blank meaning: Confirm inherited/zero offset with the actual parser; do not guess fractions.

### 91. `D_TuneOffset_st`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Static pitch offset for the D string, measured in semitones.

Accepted values / units: Signed integer semitones in current Rust validation; e.g. -2, 0, +1

Blank meaning: Confirm inherited/zero offset with the actual parser; do not guess fractions.

### 92. `A_TuneOffset_st`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Static pitch offset for the A string, measured in semitones.

Accepted values / units: Signed integer semitones in current Rust validation; e.g. -2, 0, +1

Blank meaning: Confirm inherited/zero offset with the actual parser; do not guess fractions.

### 93. `LowE_TuneOffset_st`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Static pitch offset for the LowE string, measured in semitones.

Accepted values / units: Signed integer semitones in current Rust validation; e.g. -2, 0, +1

Blank meaning: Confirm inherited/zero offset with the actual parser; do not guess fractions.

### 94. `HighE_Articulation`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional articulation attached specifically to the HighE string.

Accepted values / units: Text; supported techniques depend on current runtime

Blank meaning: No articulation requested; avoid assuming all techniques render.

### 95. `B_Articulation`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional articulation attached specifically to the B string.

Accepted values / units: Text; supported techniques depend on current runtime

Blank meaning: No articulation requested; avoid assuming all techniques render.

### 96. `G_Articulation`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional articulation attached specifically to the G string.

Accepted values / units: Text; supported techniques depend on current runtime

Blank meaning: No articulation requested; avoid assuming all techniques render.

### 97. `D_Articulation`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional articulation attached specifically to the D string.

Accepted values / units: Text; supported techniques depend on current runtime

Blank meaning: No articulation requested; avoid assuming all techniques render.

### 98. `A_Articulation`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional articulation attached specifically to the A string.

Accepted values / units: Text; supported techniques depend on current runtime

Blank meaning: No articulation requested; avoid assuming all techniques render.

### 99. `LowE_Articulation`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional articulation attached specifically to the LowE string.

Accepted values / units: Text; supported techniques depend on current runtime

Blank meaning: No articulation requested; avoid assuming all techniques render.

### 100. `HighE_TargetFret`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional destination fret for an expressive action on HighE.

Accepted values / units: Nonnegative integer when supported

Blank meaning: No target change requested.

### 101. `B_TargetFret`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional destination fret for an expressive action on B.

Accepted values / units: Nonnegative integer when supported

Blank meaning: No target change requested.

### 102. `G_TargetFret`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional destination fret for an expressive action on G.

Accepted values / units: Nonnegative integer when supported

Blank meaning: No target change requested.

### 103. `D_TargetFret`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional destination fret for an expressive action on D.

Accepted values / units: Nonnegative integer when supported

Blank meaning: No target change requested.

### 104. `A_TargetFret`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional destination fret for an expressive action on A.

Accepted values / units: Nonnegative integer when supported

Blank meaning: No target change requested.

### 105. `LowE_TargetFret`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional destination fret for an expressive action on LowE.

Accepted values / units: Nonnegative integer when supported

Blank meaning: No target change requested.

### 106. `LowE_Velocity`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional attack velocity override for the LowE string.

Accepted values / units: Integer 1–127

Blank meaning: In Custom/blank String_Emphasis mode, inherit row velocity.

### 107. `A_Velocity`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional attack velocity override for the A string.

Accepted values / units: Integer 1–127

Blank meaning: In Custom/blank String_Emphasis mode, inherit row velocity.

### 108. `D_Velocity`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional attack velocity override for the D string.

Accepted values / units: Integer 1–127

Blank meaning: In Custom/blank String_Emphasis mode, inherit row velocity.

### 109. `G_Velocity`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional attack velocity override for the G string.

Accepted values / units: Integer 1–127

Blank meaning: In Custom/blank String_Emphasis mode, inherit row velocity.

### 110. `B_Velocity`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional attack velocity override for the B string.

Accepted values / units: Integer 1–127

Blank meaning: In Custom/blank String_Emphasis mode, inherit row velocity.

### 111. `HighE_Velocity`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional attack velocity override for the HighE string.

Accepted values / units: Integer 1–127

Blank meaning: In Custom/blank String_Emphasis mode, inherit row velocity.

### 112. `String_Emphasis`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Per-row categorical profile for bass-to-treble strum emphasis. When nonblank it takes precedence over the six stored per-string velocity values.

Accepted values / units: Blank/Custom, Balanced, Bass Emphasis, Treble Emphasis

Blank meaning: Blank enables per-string velocity overrides; do not erase inactive stored values.

### 113. `LowE_Duration_Beats`
Type: Decimal. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional sounding duration of the LowE string, independent of the other strings.

Accepted values / units: Positive quarter-note beats; may cross barlines if accepted by validator

Blank meaning: Inherit the row duration if omitted.

### 114. `A_Duration_Beats`
Type: Decimal. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional sounding duration of the A string, independent of the other strings.

Accepted values / units: Positive quarter-note beats; may cross barlines if accepted by validator

Blank meaning: Inherit the row duration if omitted.

### 115. `D_Duration_Beats`
Type: Decimal. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional sounding duration of the D string, independent of the other strings.

Accepted values / units: Positive quarter-note beats; may cross barlines if accepted by validator

Blank meaning: Inherit the row duration if omitted.

### 116. `G_Duration_Beats`
Type: Decimal. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional sounding duration of the G string, independent of the other strings.

Accepted values / units: Positive quarter-note beats; may cross barlines if accepted by validator

Blank meaning: Inherit the row duration if omitted.

### 117. `B_Duration_Beats`
Type: Decimal. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional sounding duration of the B string, independent of the other strings.

Accepted values / units: Positive quarter-note beats; may cross barlines if accepted by validator

Blank meaning: Inherit the row duration if omitted.

### 118. `HighE_Duration_Beats`
Type: Decimal. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Optional sounding duration of the HighE string, independent of the other strings.

Accepted values / units: Positive quarter-note beats; may cross barlines if accepted by validator

Blank meaning: Inherit the row duration if omitted.

### 119. `Stroke_Direction`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: The direction of the guitar strum, governing attack ordering.

Accepted values / units: Down or Up in verified examples

Blank meaning: Do not infer strum direction when meaning matters.

### 120. `Stroke_Strings`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Explicit ordered set of strings attacked in this row.

Accepted values / units: Pipe-delimited string names; e.g. LowE|A|D|G|B|HighE

Blank meaning: No explicit struck-string list; review before playback.

### 121. `Strum_Spread_ms`
Type: Decimal. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Elapsed milliseconds between first and last struck string attacks.

Accepted values / units: Nonnegative number in milliseconds; e.g. 60

Blank meaning: No spread specified; do not silently assign a musical performance.

### 122. `Picking_Method`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Performance gesture or pick/finger technique for the row.

Accepted values / units: Text, e.g. Pick

Blank meaning: No picking method specified.

### 123. `Palm_Mute`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Whether a palm-muted articulation is requested for the event.

Accepted values / units: True or False in current examples

Blank meaning: No explicit palm-mute request.

### 124. `Let_Ring`
Type: Text. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Whether sounding strings should be allowed to sustain in the performance model.

Accepted values / units: True or False in current examples

Blank meaning: No explicit sustain instruction.

### 125. `Capo_Fret`
Type: Integer. Responsibility: Composer / performer. Requirement: Conditional / optional / derived.

Meaning: Capo position applied to the guitar part/row.

Accepted values / units: Nonnegative integer; 0 means no capo

Blank meaning: No capo position asserted.

### 126. `measure_start_tick`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Absolute tick of this measure’s start.

Accepted values / units: Nonnegative integer, computed from bar index

Blank meaning: Recompute from declared composition timeline.

### 127. `measure_start_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Millisecond position of the measure opening.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from tempo and tick resolution.

### 128. `measure_end_tick`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Absolute tick of the measure closing barline.

Accepted values / units: Nonnegative integer

Blank meaning: Recompute from meter; do not truncate at last note.

### 129. `measure_end_ms`
Type: Integer. Responsibility: Computed. Requirement: Conditional / optional / derived.

Meaning: Millisecond position of the measure closing barline.

Accepted values / units: Integer milliseconds

Blank meaning: Recompute from tempo and tick resolution.

### 130. `String_1_Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places the named guitar string’s sounding event in the stereo field independently of the other strings in the same row.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by RC1 pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −100 for a left-panned string, 100 for a right-panned string, or blank

### 131. `String_2_Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places the named guitar string’s sounding event in the stereo field independently of the other strings in the same row.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by RC1 pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −100 for a left-panned string, 100 for a right-panned string, or blank

### 132. `String_3_Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places the named guitar string’s sounding event in the stereo field independently of the other strings in the same row.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by RC1 pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −100 for a left-panned string, 100 for a right-panned string, or blank

### 133. `String_4_Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places the named guitar string’s sounding event in the stereo field independently of the other strings in the same row.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by RC1 pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −100 for a left-panned string, 100 for a right-panned string, or blank

### 134. `String_5_Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places the named guitar string’s sounding event in the stereo field independently of the other strings in the same row.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by RC1 pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −100 for a left-panned string, 100 for a right-panned string, or blank

### 135. `String_6_Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places the named guitar string’s sounding event in the stereo field independently of the other strings in the same row.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by RC1 pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −100 for a left-panned string, 100 for a right-panned string, or blank


## Source and compatibility

Verified against RC1 fixture: tests/fixtures/SymphonyCSV_TAB_SixString_Pan_QA_135col.csv. Legacy order verified against Track_03_A_Criminal_Mind_Gm_Guitar_TAB_143_Two_Chords_129col.csv.

Descriptions inherited from earlier dictionary should be treated as guidance wherever not specifically proven by RC1 integration tests.
