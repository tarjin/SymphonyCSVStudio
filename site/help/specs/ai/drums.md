# Drums CSV — SymphonyCSV Studio LABS

Tracks 5–6; exact LABS header count: 21. The older 20-column format remains accepted.

## Authoring rules

- Use the blank-template ZIP and preserve all header names and their exact order.
- Human composer owns musical decisions; AI assistance is optional.
- Use UTF-8 CSV with standard quoted fields and no unrelated columns.
- Do not invent notation or silent defaults. Blank panning means native SoundFont placement; 0 means centre.
- Every per-event pan is a whole integer between -100 and +100.
- The composition ends at its declared final full-measure barline.
- Treat the Rust/WASM parser as authoritative; consult validation errors for advanced fields.

## MIDI import and Pan_Position

When using Studio's MIDI Import workspace, MIDI channel CC10 (0 left, 64 centre, 127 right) is read at each drum hit onset and converted to the whole-number `Pan_Position` range −100..+100. The active CC10 is tracked per source MIDI channel, including controller messages on separate MIDI tracks. CC121 resets MIDI pan to centre (CSV 0). If no CC10/reset was encountered on that channel, leave `Pan_Position` blank; do not replace blank with zero.

This is a per-event snapshot, not a continuous MIDI controller automation lane. Mid-note pan sweeps are not reproduced and generate an import warning. Equal-tick ordering is deterministic by source track and event sequence. Other continuous controllers and original MIDI programs do not become Studio note events. The separate `cc10_pan` controller field, if present in the Pitched schema, is not populated redundantly by the importer.

## Exact LABS CSV header

```csv
composition_title,composition_total_measures,composition_end_tick,tempo_bpm,time_signature,ticks_per_quarter,event_id,event_type,measure,absolute_tick,onset_tick_in_measure,timing_offset_ms,duration_ticks,surface_id,articulation,variant_id,velocity,note_off_velocity,note_off_method,choke_group,Pan_Position
```

## Column-by-column guide

### 1. `composition_title`
Type: Text. Responsibility: Composition or performer. Requirement: Required event/composition value.

Meaning: Shared song title; identifies which composition the drum part belongs to.

Accepted values / units: Nonblank text

Blank meaning: Required.

### 2. `composition_total_measures`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Full count of bars in the piece, including measures with no drum hits.

Accepted values / units: Positive integer

Blank meaning: Required; must match other tracks.

### 3. `composition_end_tick`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Absolute closing barline tick of the final full measure.

Accepted values / units: Nonnegative integer

Blank meaning: Required; do not use last hit time as song end.

### 4. `tempo_bpm`
Type: Decimal. Responsibility: Composition or performer. Requirement: Required event/composition value.

Meaning: Quarter-note tempo of the composition.

Accepted values / units: Positive BPM number

Blank meaning: Required; must match the rest of the song.

### 5. `time_signature`
Type: Text. Responsibility: Composition or performer. Requirement: Required event/composition value.

Meaning: Shared musical meter.

Accepted values / units: Meter text such as 4/4

Blank meaning: Required; must match the rest of the song.

### 6. `ticks_per_quarter`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Tick resolution defining the drum timeline.

Accepted values / units: Positive integer; verified sample uses 480

Blank meaning: Required; must match the rest of the song.

### 7. `event_id`
Type: Text. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Unique identifier for this drum event; use it to review edits.

Accepted values / units: Text, e.g. DR0001

Blank meaning: Required for drum event rows.

### 8. `event_type`
Type: Text. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Type of drum event represented.

Accepted values / units: hit in verified sample; other values require validator confirmation

Blank meaning: Required; do not invent a new type.

### 9. `measure`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: One-based measure containing the event onset.

Accepted values / units: Positive integer within declared length

Blank meaning: Required for events.

### 10. `absolute_tick`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Absolute attack tick since composition start.

Accepted values / units: Nonnegative integer

Blank meaning: Required for timed events.

### 11. `onset_tick_in_measure`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Attack offset in ticks relative to the start of this bar.

Accepted values / units: Nonnegative integer less than measure tick length

Blank meaning: Required for timed events.

### 12. `timing_offset_ms`
Type: Decimal. Responsibility: Composition or performer. Requirement: Conditional / optional / derived.

Meaning: Optional microtiming deviation in milliseconds from the grid-aligned hit.

Accepted values / units: Signed/unsigned millisecond value; exact accepted bounds need validator check

Blank meaning: No performance offset; retain blank.

### 13. `duration_ticks`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Required event/composition value.

Meaning: Length in ticks assigned to the trigger/release event, not necessarily acoustic sample tail.

Accepted values / units: Positive integer ticks in hit examples

Blank meaning: Required for hit scheduling.

### 14. `surface_id`
Type: Text. Responsibility: Composition or performer. Requirement: Required event/composition value.

Meaning: Musical playing surface such as kick or snare, independent of the loaded SoundFont mapping.

Accepted values / units: Surface identifier; verified values include kick_1, snare_1, hihat_1

Blank meaning: Required for a hit; kit mapping resolves actual MIDI note.

### 15. `articulation`
Type: Text. Responsibility: Composition or performer. Requirement: Conditional / optional / derived.

Meaning: Surface-specific way of striking, e.g. closed hi-hat.

Accepted values / units: Text; closed and open appear in verified fixture

Blank meaning: Blank means standard/unspecified articulation for the surface.

### 16. `variant_id`
Type: Text. Responsibility: Timeline / event metadata. Requirement: Conditional / optional / derived.

Meaning: Optional sample/performance variation within an articulation or kit.

Accepted values / units: Text identifier resolved by drum kit/mapping

Blank meaning: No variant selected.

### 17. `velocity`
Type: Integer. Responsibility: Composition or performer. Requirement: Required event/composition value.

Meaning: Attack intensity for this individual hit.

Accepted values / units: Integer 1–127

Blank meaning: Required for a sounding hit.

### 18. `note_off_velocity`
Type: Integer. Responsibility: Timeline / event metadata. Requirement: Conditional / optional / derived.

Meaning: Optional MIDI release strength for this hit.

Accepted values / units: Integer 0–127 when applicable

Blank meaning: No explicit release velocity override.

### 19. `note_off_method`
Type: Text. Responsibility: Timeline / event metadata. Requirement: Conditional / optional / derived.

Meaning: MIDI representation used when releasing the event.

Accepted values / units: Implementation/policy-specific; e.g. note_off or note_on_velocity_zero

Blank meaning: No explicit override; follow validated kit policy.

### 20. `choke_group`
Type: Text. Responsibility: Timeline / event metadata. Requirement: Conditional / optional / derived.

Meaning: Identifier linking sounds that cut each other off, such as exclusive cymbal/hi-hat groups.

Accepted values / units: Text group ID; playback support depends on kit mapping

Blank meaning: No choke group declared.

### 21. `Pan_Position`
Type: Integer. Responsibility: Composer / performer. Requirement: Optional stereo placement.

Meaning: Places this musical note or drum hit in the stereo field; each event can be positioned independently.

Accepted values / units: Whole integer −100 (hard left) through 0 (centre) to +100 (hard right); fractional positions and values outside the range are rejected by LABS pan validation.

Blank meaning: No authored pan override; preserve the loaded SoundFont’s native stereo placement. A blank is NOT the same as 0.

Example: −40, 0, 70, or blank


## Source and compatibility

Verified against LABS fixture: tests/fixtures/SymphonyCSV_Drums_Pan_QA_21col.csv. Legacy order verified against Track_05_A_Criminal_Mind_Acoustic_Drums_143_Arranged.csv.

Descriptions inherited from earlier dictionary should be treated as guidance wherever not specifically proven by LABS integration tests.
