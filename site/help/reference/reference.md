SymphonyCSV Studio / LABS edition

# Product & Functional Reference

The DAW before the DAW. An as-built specification for musicians, technical readers and AI collaborators.

Version 0.3 · Review draft + format-use policy clarification

24 November 2026

Public LABS launch: 23 November 2026

[Open Studio LABS](https://symphonycsvstudio.com/app/)

## Contents · 24 chapters

- [01. Product purpose and boundaries](#vision)
- [02. Audience and core journeys](#audience)
- [03. Functional architecture](#architecture)
- [04. Eight-track model](#tracks)
- [05. Composition authority, timing and synchronization](#timing)
- [06. The three CSV languages](#csv)
- [07. Piano Roll / Pitched CSV](#pitched)
- [08. Guitar TAB CSV](#tab)
- [09. Drums CSV](#drums)
- [10. Expression, spatial placement and precedence](#expression)
- [11. MIDI import and conversion](#midi)
- [12. SoundFonts and instrument interpretation](#soundfonts)
- [13. Recorded WAV tracks](#audio)
- [14. Playback Viewer and performance settings](#playback)
- [15. Mixer, parallel effects and master processing](#mixer)
- [16. Portable projects and settings](#projects)
- [17. Browser session recovery](#sessions)
- [18. Export and downstream interoperability](#exports)
- [19. User interface and navigation](#interface)
- [20. Privacy, licensing and ownership](#privacy)
- [21. AI collaboration and machine-readable behavioural contracts](#ai)
- [22. End-to-end workflows and acceptance examples](#scenarios)
- [23. Troubleshooting and known limitations](#troubleshooting)
- [24. Reference governance, verification and publication](#governance)

## About this reference

This standalone reference describes the product’s functional architecture, data semantics, user journeys and behavioural contracts. It is written for humans and large language models, with stable headings, rule identifiers, explanatory examples and diagrams. It contains no proprietary application source code.

**Review status:** Comprehensive first draft, not a release certification. Current schema tables are linked rather than reconstructed; actual production screenshots and several release-specific interactions need verification. Diagrams are clearly labelled as illustrations. Use the current official format guides for exact import rules.

<a id="vision"></a>

## Chapter 01 — Product purpose and boundaries

SymphonyCSV Studio is a browser-based, eight-track musical composition, auditioning and mixing environment. It is the **DAW before the DAW**: a modern Portastudio for turning structured musical ideas into listenable demos and portable material for subsequent production.

Its central proposition is that music can be described explicitly in structured, readable files. A musician, spreadsheet application, script or AI assistant can prepare those instructions; Studio interprets them, synchronizes the parts and makes them audible. A conventional digital audio workstation (DAW) can then take over for recording, arrangement, editing, notation workflows and final production.

### Compose

Describe notes, performances and rhythms in three specialized CSV formats.

### Audition

Hear the composition through sampled instruments and inspect it against a shared clock.

### Shape

Balance up to eight tracks and use shared effects and master processing.

### Continue

Share rendered audio or move musical events into a DAW or notation application.

### Product principles

| Rule ID | Functional contract                                                                                             |
|---------|-----------------------------------------------------------------------------------------------------------------|
| V-01    | Human-led musical decisions; AI is an optional collaborator, not a required dependency.                         |
| V-02    | The musical CSV is the composition source of truth. A rendered sound is an interpretation of it.                |
| V-03    | Local-first processing: musical and audio assets are processed in the browser, not sent to a rendering service. |
| V-04    | Interoperability: preserve supported musical information rather than require users to remain in Studio.         |
| V-05    | Free to use, with voluntary support. No paid feature tiers or required account in the documented LABS product.  |
| V-06    | Public functional documentation does not imply an open-source software implementation.                          |

### What Studio is not

It is not a full DAW, a VST host, an automatic music transcription service, a general-purpose audio editor, or a guarantee that every MIDI receiver will interpret every expression identically. LABS is an experimental public edition. This reference describes intended and evidenced functional behaviour, not service-level commitments.

<a id="audience"></a>

## Chapter 02 — Audience and core journeys

| Audience                    | Typical need                                       | Successful outcome                                                            |
|-----------------------------|----------------------------------------------------|-------------------------------------------------------------------------------|
| Musician / songwriter       | Hear a song before opening a full DAW              | A coherent demo with synchronized instrumental parts and optional recordings. |
| Producer                    | Explore arrangement, sound and stereo balance      | Reusable MIDI, rendered audio and saved composition assets.                   |
| Notation user               | Move pitched musical events into notation software | MIDI import followed by score cleanup and notation decisions.                 |
| AI-assisted composer        | Turn a musical brief into importable files         | Schema-correct CSVs with aligned timing and playable expression.              |
| Support assistant / analyst | Explain or reproduce a problem                     | A specific rule, test case or documented limitation rather than a guess.      |

> **Figure 1. The core journey**
>
> Musical brief → CSV or supported MIDI → Studio audition → Mix / save → Audio or MIDI downstream
>
> A user may repeat composition and audition as often as needed. Studio does not require a DAW to hear a demo.

### Success criteria

A valid part can be imported and heard in time; incompatible parts are detected rather than silently stretched; users can preserve their work; exported output has a documented purpose and known limitations. For AI, success means producing a usable file and explaining its constraints, not merely generating plausible-looking musical text.

<a id="architecture"></a>

## Chapter 03 — Functional architecture

The public functional model has four layers: input and validation; composition interpretation and scheduling; sound generation and mixing; and independent persistence/export paths. These layers describe observable responsibilities rather than proprietary implementation.

> **Figure 2. System context and data flow**
>
> Human / AI / spreadsheet / MIDI authoring ↓ Musical CSV or supported MIDI conversion WAV recordings Tracks 7–8 ↓ Composition validation Shared time model Musical event scheduler Audio decoding Onset alignment Clip boundary ↓ SoundFonts + recorded audio → track mixer → shared effects → master processing ↓ Live playback / WAV / MP3 Independent data paths: CSV / MIDI / Project ZIP / browser snapshot
>
> Conceptual architecture. Data serialization does not occur downstream of the audio effects chain.

### Data ownership and boundaries

| Data             | Role                                                      | Lifetime                                                                |
|------------------|-----------------------------------------------------------|-------------------------------------------------------------------------|
| Musical CSV      | Authoritative event instructions and composition metadata | User-managed source file; included in music project.                    |
| SoundFont (.sf2) | Sampled instrument and preset definition                  | Bundled or locally selected; subject to license.                        |
| WAV              | Recorded waveform with placement offset                   | Local input; persisted in supported project/audio or session workflows. |
| Mix parameters   | Performance state, not a rewrite of composition           | Current session and supported saved state.                              |
| Rendered audio   | Audible stereo output                                     | Downloaded deliverable; not an editable musical event list.             |
| MIDI             | Interchange of supported performance events               | Downloaded file for a compatible receiver.                              |
| Browser snapshot | Recoverable local working state                           | Browser/origin dependent; not a portable backup.                        |

<a id="tracks"></a>

## Chapter 04 — Eight-track model

| Track | Role                 | Input                | Typical musical use                   |
|-------|----------------------|----------------------|---------------------------------------|
| 1     | Piano Roll / Pitched | CSV, MIDI conversion | Piano, chords, synth, melody          |
| 2     | Piano Roll / Pitched | CSV, MIDI conversion | Bass, strings, secondary pitched line |
| 3     | Guitar TAB           | CSV only             | Six-string rhythm or fingerpicking    |
| 4     | Guitar TAB           | CSV only             | Lead, arpeggio or second guitar       |
| 5     | Acoustic Drums       | CSV, MIDI conversion | Acoustic kit performance              |
| 6     | Electronic Drums     | CSV, MIDI conversion | Electronic percussion and pulse       |
| 7     | WAV Audio            | WAV only             | Vocal, recorded instrument, texture   |
| 8     | WAV Audio            | WAV only             | Second recording or backing part      |

> **Figure 3. Track layout**
>
> 01 Piano Roll Pitched CSV 02 Piano Roll Pitched CSV 03 Guitar TAB TAB CSV 04 Guitar TAB TAB CSV 05 Acoustic Drums Drums CSV 06 Electronic Drums Drums CSV 07 WAV Audio Recorded audio 08 WAV Audio Recorded audio
>
> Conceptual track map, not a screenshot. Tracks 1–6 describe musical instructions; Tracks 7–8 contribute existing audio.

Track type is independent of the sound selected: a bass SoundFont on Track 2 is still a Pitched track. The two drum tracks use the same CSV language with distinct instrument kits. LABS does not expose public arbitrary drum-kit switching. Track numbering is meaningful in projects; do not rename a guitar CSV as a pitched file and expect the format to change.

| Rule ID | Functional contract                                                                        |
|---------|--------------------------------------------------------------------------------------------|
| TR-01   | One musical format per designated track. TAB cannot be directly imported from MIDI.        |
| TR-02   | A musical track establishes the common timeline; audio does not.                           |
| TR-03   | All loaded tracks can contribute to the stereo mix, subject to their volume, mute and pan. |
| TR-04   | The application is not an arbitrary unlimited-track arrangement editor.                    |

<a id="timing"></a>

## Chapter 05 — Composition authority, timing and synchronization

The first successfully imported musical track establishes the composition framework. This is a composition-level contract, not a requirement that Track 1 must always be populated. Later musical tracks must be compatible with that framework. They can contain different notes and rhythms, but should not redefine the song’s identity or end.

| Rule ID | Functional contract                                                                                                                                              |
|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| TIME-01 | The authority includes composition title, measure structure, end tick, tempo, meter and pulses per quarter note (PPQ). Use consistent metadata across all parts. |
| TIME-02 | Notes and strikes are placed at absolute musical positions; the shared playback clock maps those positions to time.                                              |
| TIME-03 | A musical event can begin in one measure and sustain into another. Display boundaries are not automatic note-off events.                                         |
| TIME-04 | Audio onset is measured in milliseconds relative to composition start. Audio must not extend the musical endpoint.                                               |
| TIME-05 | Global natural decay is additional audio time after the musical endpoint. It does not create extra musical measures or alter MIDI/CSV endpoints.                 |
| TIME-06 | Import incompatibility must be resolved in the input files, not by assuming automatic tempo matching or stretching.                                              |

### Timing model: constant-tempo example

Ticks per measure = PPQ × numerator × 4 / denominator\
Milliseconds per tick = 60,000 / (BPM × PPQ)

For 4/4 at 480 PPQ and 120 BPM, one measure contains 1,920 ticks and lasts 2,000 ms. Four complete measures end at tick 7,680 (8,000 ms); a note beginning at tick 1,680 and lasting 480 ticks crosses the first barline and ends at tick 2,160. These calculations are examples, not CSV column names. For a nonconstant tempo map, elapsed time is obtained by integrating each segment at its local tempo; do not assume arbitrary tempo-map import support without checking the current guide.

> **Figure 4. Musical end versus audible end**
>
> Measure 1 0–2 s Measure 2 2–4 s Measure 3 4–6 s Measure 4 6–8 s Decay 8–10 s Start Musical endpoint at 8 s · audio can ring to 10 s
>
> Illustrative four-bar song with 2,000 ms decay. WAV/MP3 may include the tail; musical data ends at the final barline.

### Validation algorithm (functional)

1.  Read the candidate file and identify its expected musical format.
2.  Validate required structure, values and musical metadata.
3.  When no musical composition exists, establish authority from the valid candidate.
4.  Otherwise compare its declared musical framework with the existing composition. Reject incompatible input and report the issue.
5.  Interpret accepted events on the shared timeline; derive display measures and playback scheduling from the same time model.

**Review detail:** Exact compatibility comparison tolerances, variable-tempo support and accepted metadata normalization must be checked against the current release schema and regression tests.

<a id="csv"></a>

## Chapter 06 — The three CSV languages

SymphonyCSV uses distinct structured text formats rather than a single universal event table. The formats encode musical intent and performance information, not rendered samples. An author should always start from the official header for the current release.

| Language   | Current documented width | Earlier width | Event model                                                            |
|------------|--------------------------|---------------|------------------------------------------------------------------------|
| Pitched    | 86 columns               | 85            | One pitched note per row; notes can share an onset.                    |
| Guitar TAB | 135 columns              | 129           | A string-oriented performance event; multiple strings may participate. |
| Drums      | 21 columns               | 20            | One strike per row; simultaneous strikes use multiple rows.            |

The newer widths add event-level spatial information. Earlier widths were accepted in LABS; use the current templates for new material and recheck legacy compatibility for a particular build. The column order, spelling, accepted values, types and defaults are part of the specification. Never append a field just because an AI invented a plausible name.

### Canonical column references

### [Pitched CSV](https://symphonycsvstudio.com/help/specs/pitched.html)

All pitched fields, metadata and event semantics.

### [Guitar TAB CSV](https://symphonycsvstudio.com/help/specs/guitar-tab.html)

All string, stroke and expression fields.

### [Drums CSV](https://symphonycsvstudio.com/help/specs/drums.html)

All percussion strike fields and mappings.

### [Official blank templates](https://symphonycsvstudio.com/help/specs/downloads/SymphonyCSV_Official_Blank_Templates_LABS.zip)

Header-only ZIP: add valid music data before import.

**Schema authority:** This reference explains functional semantics and verified field names. The exact complete 242-column inventory is delegated to the dedicated format guides; their current contents could not be independently retrieved during preparation. Do not treat this overview as a machine validator or reconstruct headers from it.

### General authoring rules

Keep CSV as UTF-8 text, preserve the exact header and field positions, quote commas or embedded quotation marks according to CSV conventions, and retain empty fields where the schema permits them. Spreadsheet software can silently transform values, strip leading zeros or change delimiters; inspect the saved file before import. Blank is not universally interchangeable with zero. Required values, ranges and reserved columns must follow the specific format guide.

<a id="pitched"></a>

## Chapter 07 — Piano Roll / Pitched CSV

Tracks 1–2 use a general-purpose pitched-note language. The same structure can express chords, basslines, piano, strings and synthesized melodies. It is not tied to a keyboard sound. Notes sharing an onset can form polyphony; each event has its own pitch, duration and velocity.

| Field family                     | Meaning                                    | Authoring consequence                                               |
|----------------------------------|--------------------------------------------|---------------------------------------------------------------------|
| Composition metadata             | Shared song identity and time model        | Use consistent values across all tracks.                            |
| Event position                   | Where a note begins in musical time        | Use valid ticks and consistent measure references.                  |
| Pitch                            | Musical pitch / MIDI note representation   | Match musical register to the desired instrument.                   |
| Duration                         | Time from note-on to note-off              | Long notes may cross barlines.                                      |
| Velocity                         | Performance intensity for individual notes | Use variation deliberately; do not substitute track volume.         |
| Expression and controller fields | Supported musical performance information  | Only use fields and values documented by the current guide.         |
| `Pan_Position`                   | Optional event pan, −100 to +100           | Negative left; positive right; 0 explicit centre; blank native pan. |

### Visual interpretation

> **Figure 5. Example: polyphony on a shared clock**
>
> G4 E4 C4 C3 Beat 1 Beat 2 Beat 3 Beat 4
>
> G4: beats 1 and 3, one beat each. E4: beats 1–2. C4: beats 1–3. C3: beats 1–4. All four pitches begin on beat 1.
>
> Illustrative piano-roll diagram, not a screenshot or importable CSV. Independent durations allow notes to overlap.

For MIDI import, the Pitched conversion uses automatic upper/lower staff allocation around middle C. The resulting visualization is an aid to interpretation, not a fully engraved score or a guarantee of correct fingering. Export MIDI for a notation program, then review the musical notation.

### Example event intent (not literal CSV)

| Onset tick | Pitch | Duration ticks | Velocity | Pan intent |
|------------|-------|----------------|----------|------------|
| 0          | C3    | 1,920          | 76       | native     |
| 0          | C4    | 960            | 84       | −20        |
| 0          | E4    | 960            | 78       | 0          |
| 0          | G4    | 480            | 72       | +20        |
| 960        | G4    | 480            | 81       | +20        |

To make this importable, an author must populate the official 86-column header and required metadata, not save the five-column table above as a SymphonyCSV file.

<a id="tab"></a>

## Chapter 08 — Guitar TAB CSV

Tracks 3–4 describe guitar performance by string and fret, with timing, tuning and expression. This retains information that a generic MIDI note stream cannot uniquely recover: the same sounding pitch can be played at more than one string/fret position.

| Field or family                                   | Purpose                              | Functional meaning                                                                                            |
|---------------------------------------------------|--------------------------------------|---------------------------------------------------------------------------------------------------------------|
| String and fret information                       | Select playable locations            | Use six-string ordering defined by the official guide; muted or omitted strings must be encoded as specified. |
| Capo                                              | Move the open-string reference       | Account for capo when checking sounding pitch.                                                                |
| `_TuneOffset_st` fields                           | Per-string tuning offset             | Whole semitones in LABS V1; microtuning not implied.                                                          |
| Per-string velocity                               | Different attack strengths           | Allows a chord to sound naturally uneven.                                                                     |
| `String_Emphasis`                                 | Balance, bass or treble emphasis     | Documented emphasis can override individual velocities; use the guide’s precedence.                           |
| `Stroke_Direction` / `Stroke_Strings`             | String selection and stroke ordering | Differentiate up/down strokes and participating strings.                                                      |
| `Strum_Spread_ms`                                 | Distribute attacks over time         | A chord can be spread rather than struck simultaneously.                                                      |
| `Let_Ring` / `cc64_sustain`                       | Supported sustain intent             | Use the format-defined behaviour; do not assume all MIDI targets reproduce it.                                |
| `String_1_Pan_Position` … `String_6_Pan_Position` | Spatial position per string          | Same −100 to +100 semantics; blank retains native placement.                                                  |

### Conceptual pitch and stroke algorithm

For each participating string, determine its sounding pitch from the standard open-string reference, tuning offset, capo and fret, according to the schema’s exact capo/fret convention. Then determine attack order, per-string onset and performance intensity. Generate note-on/note-off information with supported articulation and pan. This conceptual algorithm does not assert an internal scheduling formula or rounding method.

> **Figure 6. A downstroke with staggered attacks**
>
> Low E A D G B High E First attack Last attack
>
> Illustrative attack order: low E → A → D → G → B → high E. Spacing is illustrative, not a fixed timing rule.
>
> Conceptual staggered attacks. Actual spread distribution, string inclusion and note durations are determined by valid TAB fields.

Half-step-down tuning is represented by a −1 semitone offset on each affected string, not by globally transposing a composition whose other tracks are already in concert pitch. Ensure the resulting sounding pitches match the other instruments. The TAB language is not an arbitrary extended-string bass format; use only the six-string semantics supported by the schema.

### Interchange boundary

TAB accepts CSV, not direct MIDI import. MIDI export can represent supported sounding musical events, but the original string/fret identity and TAB-specific performance instructions may not be recoverable from that MIDI. Keep the source TAB CSV.

<a id="drums"></a>

## Chapter 09 — Drums CSV

Tracks 5–6 use one percussion strike per row. This enables layered kick, snare, hi-hat and other percussion events at the same tick, each with its own velocity and optional position. The intended kit role is acoustic for Track 5 and electronic for Track 6.

| Field family            | Meaning                                                                   |
|-------------------------|---------------------------------------------------------------------------|
| Shared timing metadata  | Aligns percussion with the rest of the composition.                       |
| Onset / measure         | Positions each strike on the song timeline.                               |
| Drum identity           | Selects a supported percussion sound according to the kit mapping.        |
| Velocity                | Strike strength / sample response.                                        |
| Other strike attributes | Use only the documented supported fields.                                 |
| `Pan_Position`          | Optional per-hit spatial position; blank preserves the SoundFont default. |

### Example rhythm (event intent, not CSV)

| Tick at 480 PPQ | Hits                  | Velocity example |
|-----------------|-----------------------|------------------|
| 0               | Kick + closed hi-hat  | 96 / 65          |
| 240             | Closed hi-hat         | 53               |
| 480             | Snare + closed hi-hat | 105 / 68         |
| 720             | Closed hi-hat         | 51               |
| 960             | Kick + closed hi-hat  | 92 / 66          |
| 1200            | Closed hi-hat         | 54               |
| 1440            | Snare + closed hi-hat | 108 / 71         |
| 1680            | Closed hi-hat         | 56               |

Each listed simultaneous hit becomes a distinct row in a real file. Use the official kit note mapping rather than guessing instrument IDs from the English labels. Different kits may render the same note numbers differently. MIDI percussion often uses the conventional channel 10 (human numbering); receiving instruments and channel-wide controller behaviour can limit independently expressed hits. Do not promise that simultaneous events on one MIDI channel retain independent pan after export. Drum-kit customization in the public LABS interface is not assumed.

<a id="expression"></a>

## Chapter 10 — Expression, spatial placement and precedence

Expressiveness operates at more than one layer. A velocity changes the force of a musical event; track gain changes the track’s overall output. A CSV pan describes a specific event or string; track pan shapes the channel in the mixer. The master EQ shapes the final audio, not the underlying notes.

| Layer       | Control                                  | Scope                                         |
|-------------|------------------------------------------|-----------------------------------------------|
| Event       | Velocity, duration, supported expression | Individual note, string or percussion strike. |
| Event       | CSV pan                                  | Individual note/strike or TAB string.         |
| Track       | Volume, mute, pan                        | Track output and contribution to the mix.     |
| Effect send | Send level and send mute                 | Contribution of one track to a shared effect. |
| Master      | Compressor, EQ, limiter                  | Combined stereo mix.                          |

> **Figure 7. CSV pan semantics**
>
> −100 −50 0 +50 +100 Left Centre Right
>
> Blank is not zero: blank preserves the instrument’s native panning; numeric zero explicitly requests centre.

MIDI controller 10 (CC10) is channel-wide, while SymphonyCSV can describe pan per event. The November 24 production fix maps imported CC10 state at the onset of supported Pitched and Drums events. A sweep occurring while a note is already sustained is not recreated as a continuous per-note sweep. A dedicated Pan_Sweep feature is deferred. Do not invent that column.

Where two independently panned events share a MIDI channel, the receiver may not reproduce the same spatial result as Studio. Use rendered audio when preserving the audible stereo interpretation matters more than editable events. The exact numeric combination of track pan and event pan, and export channel assignment, should be confirmed with the current guide and an actual receiver test.

<a id="midi"></a>

## Chapter 11 — MIDI import and conversion

MIDI import is a bridge into SymphonyCSV, not an alternative musical authority format inside a saved project. It extracts supported musical events into the selected compatible CSV language. It is available for Pitched Tracks 1–2 and Drums Tracks 5–6, not TAB Tracks 3–4.

> **Figure 8. Conversion workflow**
>
> Select supported target → Load MIDI → Inspect preview / end measure → Convert to CSV → Import / audition
>
> The resulting CSV becomes the editable, reusable musical source.

| Rule ID | Functional contract                                                                                                                              |
|---------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| MI-01   | If tempo or meter is missing, documented defaults are 120 BPM and 4/4.                                                                           |
| MI-02   | Review the preview and explicitly choose the intended end measure; do not assume the last note-off is the full song boundary.                    |
| MI-03   | Supported multi-part source events may be combined for one target track; a conversion is not automatic recreation of a multitrack DAW session.   |
| MI-04   | Pitched visualization assigns notes to upper/lower staff around middle C automatically.                                                          |
| MI-05   | Preserve supported pitch, onset, duration and velocity. Interpret supported CC10 at note onset; continuous pan sweeps are not supported as such. |
| MI-06   | No direct MIDI-to-TAB conversion. Guitar fingering is ambiguous and must be authored in TAB CSV.                                                 |

### High-level conversion algorithm

1.  Read MIDI timing division and supported track/tempo/meter information; apply documented fallbacks only where information is absent.
2.  Pair supported note-on/note-off events and collect relevant event state at the note onset. For percussion, map supported drum events.
3.  Preview the result and establish the chosen composition endpoint.
4.  Serialize valid event rows using the exact target header, musical metadata and supported expressions.
5.  Validate the resulting CSV before audition or reuse.

Not every MIDI controller, program change, tempo-map structure or system-exclusive message is necessarily imported. This reference does not claim full Standard MIDI File round-trip fidelity. Verify any specific controller and file-type edge case before promising support.

<a id="soundfonts"></a>

## Chapter 12 — SoundFonts and instrument interpretation

A SoundFont (.sf2) provides sampled instrument sounds and associated presets. It is not a musical composition or a VST plug-in. Studio interprets musical events through a compatible sound source; changing the SoundFont changes the audible performance without necessarily changing the CSV.

The documented default pitched instruments include Upright Piano KW for Track 1 and a Double Bass voice from GeneralUser GS for Track 2. A test synthesizer is available in the pitched workspace when a SoundFont has not been loaded. Treat the actual loaded instrument and preset displayed in the application as authoritative. The public bundled credits list is the authoritative attribution source, not an assumption that every SoundFont used during development is distributed.

> **Figure 9. From data to sound**
>
> CSV event → Pitch / timing / velocity → Selected instrument → Sample playback → Track audio
>
> MIDI exported to a DAW does not automatically carry the Studio instrument’s samples.

### Using an external SoundFont

1.  Select the relevant supported musical track.
2.  Load a compatible local .sf2 file and select a supported preset when available.
3.  Audition a short passage and confirm the actual instrument, range, response and balance.
4.  When saving portable assets, check the SoundFont’s redistribution license before sharing an archive.

Studio is not a host for VST instruments or effects. To reproduce a Studio instrument in another DAW, use the appropriate compatible sampler and legally accessible SoundFont, or export audio if the rendered sound itself is the deliverable.

[Bundled SoundFont credits and licenses](https://symphonycsvstudio.com/help/soundfonts/)

<a id="audio"></a>

## Chapter 13 — Recorded WAV tracks

Tracks 7–8 accept existing WAV recordings and synchronize them with the musical composition. They are not an additional CSV format, nor are they assumed to provide microphone capture, waveform editing, pitch correction or automatic tempo matching.

| Rule ID | Functional contract                                                                                                                                       |
|---------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|
| AU-01   | Use a supported WAV file, not an MP3 renamed as WAV.                                                                                                      |
| AU-02   | Position the clip with an onset in milliseconds relative to the common composition start.                                                                 |
| AU-03   | An onset must be within the established musical duration; a recording extending beyond that boundary is clipped for the song mix.                         |
| AU-04   | Natural decay does not extend the valid musical onset range.                                                                                              |
| AU-05   | Audio-only preview at onset zero is distinct from a valid musical project. At least one musical track is required for Mix All and musical-project saving. |
| AU-06   | Audio tracks participate in track volume/mute/pan and, as described by the live effects panels, all three parallel sends.                                 |

> **Figure 10. Recorded audio placement**
>
> Musical clock Track 7 WAV A Track 8 WAV B · clipped at end 0 ms Authoritative song end
>
> The example places WAV A from 25% to 75% of the musical timeline; WAV B starts at 60% and is clipped at the musical end.
>
> Illustration of offsets, not a waveform screenshot. The end boundary is determined by musical data.

### Functional scheduling model

At a playback position before the clip onset, the track contributes silence. During the overlap between the clip and the musical interval, play the corresponding decoded audio segment. When the musical interval ends, stop admitting new clip content and allow the global audio tail policy to apply. On seek, use the elapsed position relative to clip onset; do not restart a clip at its beginning merely because playback starts mid-song.

Exact seek behaviour and decoder format acceptance should be verified with representative WAV files and playback-range tests.

<a id="playback"></a>

## Chapter 14 — Playback Viewer and performance settings

The Playback Viewer is the primary audition environment. Select a track to inspect its musical events or audio, while the transport operates against a common timeline. The visual display is a view of the source material, not a second editable version of the composition.

| Control / display      | Purpose                                                                                         |
|------------------------|-------------------------------------------------------------------------------------------------|
| Play / pause / stop    | Transport for auditioning the composition.                                                      |
| Timeline seek          | Navigate to an elapsed musical position.                                                        |
| Measure navigation     | Move to the beginning, previous/next measure or a specified measure.                            |
| From / To · Play range | Audition a selected portion; use Play all to return to the full song.                           |
| Pitched view           | Upper and lower staff events, held-note state and shared playhead.                              |
| TAB view               | String/fret events and timing, with CSV-derived tuning/capo.                                    |
| Drum view              | Percussion events aligned to measures.                                                          |
| WAV view               | Waveform/placement information against the composition.                                         |
| Natural Decay Padding  | One global additional audio-tail setting, expressed in ms.                                      |
| Master Drum Volume     | Performance gain for Tracks 5–6, independent of individual track sliders; live UI shows 0–400%. |

### Read-only musical authority

Edit the source CSV outside the viewer and reimport it when changing musical content. Experimental editing text may be present in the delivered page markup, but it is not a supported replacement for the complete native CSV format. Do not advise a musician to rely on a prototype measure editor for lossless authoring.

### Visual state versus audible state

A note can remain visually active until its scheduled note-off even if it began in a previous measure. A sampled sound and reverb can continue decaying after the note-off. Held-note visual indicators are not an exhaustive display of all controller or effects state.

<a id="mixer"></a>

## Chapter 15 — Mixer, parallel effects and master processing

Studio separates individual track controls, shared wet effects and global master processing. The design avoids a serial chorus → delay → reverb chain. The dry signal and independently processed wet returns meet at the master stage.

> **Figure 11. Audio signal flow**
>
> Tracks 1–8 · individual volume / mute / pan ↓ independent routing Dry Chorus Delay Reverb ↓ sum dry + wet Master Compressor ↓ Five-band Graphic EQ ↓ Output Limiter → live audio / offline stereo rendering
>
> Functional routing. Each wet processor receives its own track sends rather than the output of another effect. MIDI serialization is separate.

| Workspace  | Scope                           | Key controls                                                    |
|------------|---------------------------------|-----------------------------------------------------------------|
| Chorus     | One shared modulation processor | Enabled; modulation rate and depth; eight sends.                |
| Delay      | One shared echo processor       | Enabled; echo time, feedback; eight sends.                      |
| Reverb     | One shared ambience processor   | Enabled; eight sends.                                           |
| Compressor | Combined master                 | Enabled; threshold, ratio, attack, release.                     |
| Graphic EQ | After compressor                | Enabled; 80 Hz, 250 Hz, 1 kHz, 4 kHz, 12 kHz; ±12 dB per band.  |
| Limiter    | Final output stage              | Fixed downstream limiter; not a guarantee against all clipping. |

### Default values visible in the live application

| Control               | Initial displayed setting                                |
|-----------------------|----------------------------------------------------------|
| Chorus                | 0.7 Hz rate; 3 ms depth; sends 0%                        |
| Delay                 | 320 ms; 24% feedback; sends 0%                           |
| Reverb                | Track 1 send 25%; other musical track sends 0%           |
| Compressor            | −20 dB threshold, 3:1 ratio, 8 ms attack, 180 ms release |
| Graphic EQ            | Flat 0 dB across all five bands; initially bypassed      |
| Natural Decay Padding | 2,000 ms                                                 |

These are the observed empty-session UI defaults, not promises that a loaded project will use them. Restore saved settings when reproducing a mix. Contextual send mute acts on the selected track’s effective send, preserving its previous stored level for restoration; a global processor bypass affects the entire processor. A zero stored send cannot restore a nonzero level without a new value. Editing a send can restore active routing. The master compressor and EQ are global, not track-specific.

Use low listening levels when testing aggressive effects, increased drum gain or positive EQ boosts. The limiter is an output safeguard, not an assurance of peak-safe mastering. Live audition and master audio export use the same functional processing graph.

<a id="projects"></a>

## Chapter 16 — Portable projects and settings

Project saving addresses a different problem from exporting a song: preserve editable musical source and enough performance state to continue work later. A project must contain at least one valid musical track. The current public page describes a Music Project ZIP and, when recordings are present, an optional paired Audio ZIP.

> **Figure 12. Portable project recovery**
>
> Open Music ZIP → Validate musical composition → Offer paired Audio ZIP → Restore supported state → Audition and verify
>
> The Music ZIP is opened first. Audio can be loaded or skipped. Exact archive pairing validation requires release-level verification.

| Asset                                 | Functional purpose                                                                                     |
|---------------------------------------|--------------------------------------------------------------------------------------------------------|
| `Track_1.csv` … `Track_6.csv`         | Canonical musical source files for occupied tracks.                                                    |
| `Track_7.wav` / `Track_8.wav`         | Original recorded audio assets, historically named this way; consult the current audio archive format. |
| `SymphonyCSV_Project.json`            | Versioned performance/project manifest documented in the project design.                               |
| SoundFont assets / preset information | Restore the selected supported instrument; license governs redistribution.                             |
| Project details / notices             | Human-readable project and licensing information.                                                      |

### State preservation

The documented project model includes track occupancy, selected SoundFonts and presets, gain, pan, mute, shared effect settings and sends, master processing, global decay, and recorded audio onset information where applicable. The archive must not substitute MIDI for musical CSV truth. Older supported projects may rely on defaults for fields introduced later.

### Safe restore contract

Validate archive structure and contained musical assets before replacing the current composition. A malformed or incompatible project should not leave a partially restored musical state; the established design is transactional validation and rollback. Do not assume an optional paired audio load is part of the same transaction as the initial Music ZIP: test its actual behaviour separately.

**Release verification required:** The live page contains a Save Project control labelled “coming soon,” while also describing Music Only and paired Audio ZIP saving. This could reflect conditional or inactive markup. The earlier project save/restore design was implemented and tested, but the precise enabled-state, split archive naming, pair identifiers and current manifest layout have not been independently exercised here. Do not promise successful portable saving in a specific browser without checking the actual control.

<a id="sessions"></a>

## Chapter 17 — Browser session recovery

Browser recovery is separate from portable project archives. It preserves a working snapshot in storage associated with the application’s browser origin and browser profile. It is not cloud synchronization, an account backup or an automatic transfer to a different computer.

| Action               | Expected outcome                                                                               |
|----------------------|------------------------------------------------------------------------------------------------|
| Save to Browser      | Create or replace the supported local recovery snapshot of the current session.                |
| Recover Session      | Restore the saved snapshot, including supported musical/audio assets and performance state.    |
| Clear Saved Session  | Remove the browser recovery copy only; the current open composition is not deleted.            |
| Session size display | Reports saved-session storage usage where available; not a promise of available disk capacity. |

The eight-track recovery design supports original WAV assets and external SoundFont restoration, including deduplication of identical font data by content identity. It stores one working snapshot in the documented design. Browser storage can be lost through clearing site data, profile changes, private browsing behaviour, quota restrictions or eviction. Large samples and recordings consume local storage; a successful prior save is not a guarantee of future recoverability.

> **Figure 13. Working state versus backup**
>
> Open composition → Explicit Save to Browser → Local snapshot → Recover in same browser profile
>
> Save a portable copy and keep source files separately for durable backup. The local snapshot is a convenience, not the sole archive.

### Recovery test

Save a composition with a known external preset, one recorded clip and nondefault mix parameters. Reload the app, recover, and compare track occupancy, clip onset, preset, pan, sends and audible output. Then clear the saved copy and confirm that the current composition remains open.

<a id="exports"></a>

## Chapter 18 — Export and downstream interoperability

| Output             | What it carries                                                         | What it does not carry                                                                              |
|--------------------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| MIDI               | Supported musical events, timing, velocity and representable expression | Rendered SoundFont samples, master effects audio, WAV recordings, or guaranteed TAB reconstruction. |
| Stereo WAV         | Rendered mix, 16-bit PCM at 44.1 kHz                                    | Editable note events or individual track isolation.                                                 |
| Stereo MP3         | Rendered mix, 320 kbps at 44.1 kHz                                      | Lossless waveform or editable musical events.                                                       |
| Music Project ZIP  | Portable editable music and supported associated settings/assets        | A finished audio master; audio assets may use a paired ZIP.                                         |
| Audio ZIP (paired) | Recorded audio companion for the documented project workflow            | Independent composition authority.                                                                  |

Mix All requires a valid musical composition. It includes Tracks 1–8 as loaded, track balance, parallel effects, master compressor, graphic EQ, limiter and natural decay. The MP3 encoder may require a one-time library download; encoding is local and the audio is not uploaded by the documented rendering workflow.

### Which export should I use?

| Goal                                            | Choose                                                                                 |
|-------------------------------------------------|----------------------------------------------------------------------------------------|
| I want to share the way it sounds               | WAV for uncompressed output; MP3 for convenient listening.                             |
| I want to edit notes and choose new instruments | MIDI, plus the original CSV for Studio-specific intent.                                |
| I want to continue the same Studio project      | Keep original CSVs and supported project archive(s).                                   |
| I want notation                                 | MIDI into a notation application; inspect quantization, staff assignment and notation. |
| I want isolated recorded audio                  | Keep the original WAV assets; Mix All is the combined stereo render.                   |

### Interoperability and fidelity

A receiving DAW is responsible for its instrument and supported controller interpretation. A technically valid MIDI file does not guarantee identical articulation, panning or timbre in every receiver. For per-event pan, MIDI channel semantics can constrain simultaneous independent positions. Reopen the exported file in the destination and compare a representative passage, particularly velocity, duration, channel assignment and controller values.

MusicXML and MP4 references may appear in experimental UI wording. They are not included in this reference’s supported LABS export commitment. Likewise, individual per-string or per-drum-surface stems are not represented as launched features.

<a id="interface"></a>

## Chapter 19 — User interface and navigation

The following schematic maps the primary workspaces and controls observed in the live application. It is deliberately not a fabricated screenshot. Exact layout, visibility and enabled state depend on screen size and loaded content.

> **Figure 14. Workspace map · illustrative**
>
> ♫ SymphonyCSV Studio Save to Browser · Recover Session · Announcements · More WORKSPACES Playback Viewer Projects Import MIDI SHARED EFFECTS Chorus Delay Reverb MASTER Compressor Graphic EQ Performance settings Current composition · tempo · meter · instrument 1 2 3 4 5 6 7 8 Track workspace / measure view / project controls ▶  Ⅱ  ■   ━━━━━━━━━   Timeline Status and activity information
>
> Figure: conceptual interface map based on workspace labels, not a capture of the deployed application.

| Workspace                       | When to use it                                                  |
|---------------------------------|-----------------------------------------------------------------|
| Playback Viewer                 | Inspect a selected musical or WAV track; navigate and audition. |
| Projects                        | Open/save supported portable projects; master audio export.     |
| Import MIDI                     | Convert a supported MIDI input into a target CSV.               |
| Shared Effects                  | Adjust global processors and individual sends.                  |
| Performance / master workspaces | Adjust global decay, drum gain, compressor and EQ.              |
| Announcements                   | Read release news; refresh, expand and collapse entries.        |
| More                            | Clear saved session; Credits; voluntary Donate.                 |

### Announcements and feedback

The announcements design initializes bundled fallback messages, then requests the current validated online feed. A successful feed replaces the fallback; if network retrieval or validation fails, the fallback remains available. The public feedback design uses two required questions: a 0–10 recommendation score and a written comment. Do not add inferred demographic questions or treat the comment as optional.

### Screenshot plan for publication

| Capture                          | Annotate                                                       |
|----------------------------------|----------------------------------------------------------------|
| 01 · Empty studio / loaded demo  | Workspace navigation, track selectors and current composition. |
| 02 · Pitched / TAB / Drum viewer | Shared clock, event fields, notation boundaries.               |
| 03 · WAV track                   | Waveform, onset and composition end.                           |
| 04 · MIDI import preview         | Target selector, defaults, end measure and download.           |
| 05 · Effects and master          | Independent sends, bypass and master EQ.                       |
| 06 · Projects and recovery       | Music/Audio archive flow, export controls and local recovery.  |
| 07 · Announcements and feedback  | Online/offline messaging, two-question feedback form.          |

Actual production screenshots were not available to capture through the accessible text-only view during this draft. Use a copyright-safe original demo with no personal paths or recordings; redact local identifiers and add captions and alt text. The schematic above is not a substitute for verifying screenshots.

<a id="privacy"></a>

## Chapter 20 — Privacy, licensing and ownership

Studio’s product design is local-first: composition files, recordings, selected local SoundFonts and audio rendering remain in the browser for the documented workflows. This is a scoped statement about asset processing, not a claim that the website never communicates with servers.

| Activity                           | Boundary                                                                                                               |
|------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| Musical audition / audio rendering | Local computation in the browser.                                                                                      |
| Site delivery / library retrieval  | Network access may be needed to obtain app assets and encoders.                                                        |
| Announcements                      | Requests the current public announcement feed, with a fallback.                                                        |
| Usage measurement / feedback       | Separate from music processing; consult the published privacy notice for the actual fields, purposes and retention.    |
| Donations                          | Voluntary; PayPal handles payment on its own site. Studio does not receive payment details through the described flow. |
| Third-party file sharing           | User must have appropriate rights to distribute included recordings, samples and musical material.                     |

The feedback design calls for privacy-conscious measurement and no raw IP storage in the survey database. This is a design commitment, not an independent audit of infrastructure or retention. Do not enter personal or confidential information in feedback. Consult the current website privacy statement for operative terms.

### Source versus specification

Studio’s application source code remains proprietary. The published SymphonyCSV Piano Roll / Pitched, Guitar TAB and Drums CSV formats are openly documented and freely available for anyone to use and independently implement, including for commercial purposes, without format licensing fees or royalties. The format-use permission is distinct from the software source license and from third-party asset rights. A proposed format-stability approach preserves existing column names and meanings with additive evolution; that approach is not a finalized governance or compatibility guarantee. See the [Open Musical Formats & Format-Use Policy](https://symphonycsvstudio.com/help/specs/format-use-policy.html), effective 24 November 2026.

Original compositions and externally supplied assets remain subject to applicable rights and license terms. Studio’s bundled third-party SoundFonts retain their own licenses. Before sharing a ZIP containing an external SoundFont, confirm that its license permits redistribution. Loading a file locally does not establish redistribution permission. The public credits page should cover actually distributed bundled assets, not every asset used in development.

<a id="ai"></a>

## Chapter 21 — AI collaboration and machine-readable behavioural contracts

AI assistants should act as composition partners and support guides, not as authoritative sources for undocumented fields. A language model can help choose a format, produce musical ideas, populate a supplied template, check alignment and explain a rejected import. It should never pretend to have heard an audio result or tested a file that it has not actually inspected or auditioned.

### Recommended assistant workflow

> **Figure 15. Human–AI composition loop**
>
> Ask musical intent → Get official header / guide → Draft aligned events → Validate actual CSV → User auditions / revises
>
> Human listening and musical judgement close the loop.

| Rule ID | Functional contract                                                                                                                            |
|---------|------------------------------------------------------------------------------------------------------------------------------------------------|
| AI-01   | Obtain the actual current template and field definitions before creating an import-ready file.                                                 |
| AI-02   | Confirm track type, composition title, BPM, meter, PPQ, total measures/end tick and target instrument intent.                                  |
| AI-03   | Preserve existing metadata when generating an additional part. Do not infer a new time base from event count alone.                            |
| AI-04   | Validate exact column count, order, required values, event ranges and compatible shared metadata.                                              |
| AI-05   | Do not use undocumented fields, assume unsupported features or conflate musical CSV with MIDI and audio.                                       |
| AI-06   | Use explicit blank-versus-zero semantics; distinguish velocity, track gain, event pan and master processing.                                   |
| AI-07   | For TAB, check string/fret feasibility, tuning, stroke and per-string precedence; for drums, check the kit mapping.                            |
| AI-08   | Deliver actual files only when created and checked. Label illustrative tables as non-importable. Do not claim audible verification without it. |
| AI-09   | Separate implemented LABS behaviour, planned features and uncertain release details.                                                           |
| AI-10   | For troubleshooting, request a minimal reproducer: relevant CSV header, sanitized metadata, app version, exact error and steps.                |

### Reusable prompt for a musician

> I am composing in SymphonyCSV Studio LABS. Use the official CSV template and its column reference that I provide. Create a \[track type\] part for \[song title\], \[BPM\], \[meter\], \[PPQ\], \[measure count and end tick\]. Preserve these values exactly. Describe the musical intent, then generate the complete CSV using the supplied header. Validate every row, identify assumptions and flag unsupported expression rather than inventing fields. Do not claim to have auditioned the result unless you actually have.

### Example AI validation report

| Check                 | Example result                                                   |
|-----------------------|------------------------------------------------------------------|
| Header                | 86 fields expected; exact official header still required.        |
| Composition alignment | 4/4, 120 BPM, 480 PPQ, 4 measures, end tick 7,680.               |
| Events                | All note onsets and durations checked against endpoint.          |
| Pan                   | Blank native; 0 explicit centre; values restricted to −100…+100. |
| Audition              | Not performed by assistant; user should import and listen.       |

For automated systems, use the dedicated machine-readable schemas where published. The stable rule identifiers in this document make behavioural guidance easier to cite; they are not software API identifiers or executable validation code.

<a id="scenarios"></a>

## Chapter 22 — End-to-end workflows and acceptance examples

### Scenario A · From an idea to a demo

Create a four-measure Pitched piano part at 120 BPM, 4/4, 480 PPQ. Use a matching bass part, a six-string TAB accompaniment and a drum pattern. Import the piano first, confirm the composition end, then import the other matching parts. Add a WAV vocal at 1,000 ms, audition all tracks, adjust sends and export WAV/MP3. Retain the CSVs and original vocal separately. Success: the four musical measures stay aligned, the vocal begins at the selected offset and the rendered tail does not alter the musical end.

### Scenario B · Recover a project safely

Save a working composition with an external SoundFont and one WAV clip. Recover from the supported browser snapshot or portable archives using the appropriate workflow. Compare instrument, note events, clip onset and saved mix state. Success: the same musical source and supported settings are restored; a failed import does not silently replace the existing work.

### Scenario C · Move into a DAW

Export MIDI for an instrumental part and a stereo WAV reference. Import MIDI in the receiving DAW, select a compatible instrument, and check the tempo, note duration, velocity and controllers. Compare against the WAV reference. Success: supported musical instructions arrive, while differences caused by the receiving instrument are recognized as interpretation differences rather than automatic corruption.

### Representative acceptance checks

| ID    | Given / when                                      | Expected                                                                    |
|-------|---------------------------------------------------|-----------------------------------------------------------------------------|
| AT-01 | First valid musical track is imported             | Composition authority established.                                          |
| AT-02 | Second part has incompatible declared timing      | Candidate rejected or clearly diagnosed; no silent time stretching.         |
| AT-03 | Two notes have same onset but different durations | Both sound; each ends independently.                                        |
| AT-04 | TAB uses valid −1 tuning offsets                  | Affected strings sound one semitone lower, subject to capo/fret convention. |
| AT-05 | Kick and hi-hat share onset                       | Both strikes are interpreted as separate events.                            |
| AT-06 | CSV pan blank versus numeric zero                 | Native versus explicit centre behaviour.                                    |
| AT-07 | WAV starts at a valid offset and extends past end | Aligned audio is clipped at musical boundary.                               |
| AT-08 | Mute one track’s reverb send                      | Other sends remain unaffected; saved level retained.                        |
| AT-09 | Increase natural decay                            | Audio tail changes; musical export endpoint unchanged.                      |
| AT-10 | Clear saved session                               | Browser recovery copy removed; current open composition remains.            |
| AT-11 | Import MIDI into TAB                              | Unsupported route; author TAB CSV instead.                                  |
| AT-12 | Import CC10 changes during a held note            | Onset state represented; no claim of continuous sweep reproduction.         |
| AT-13 | Export stereo mix with no musical tracks          | Master export unavailable until musical authority exists.                   |

These are proposed reproducible functional acceptance cases derived from documented behaviour, not a claim that all tests were independently run for this reference.

<a id="troubleshooting"></a>

## Chapter 23 — Troubleshooting and known limitations

| Symptom                      | Likely investigation                                                   | What to do                                                                   |
|------------------------------|------------------------------------------------------------------------|------------------------------------------------------------------------------|
| CSV rejected                 | Wrong format, header, missing required fields or incompatible metadata | Check exact official header, target track and composition timing.            |
| Parts sound out of time      | Different PPQ, tempo, measures or absolute positions                   | Align source files to the authority; verify onset/duration math.             |
| No sound                     | Unloaded instrument, mute, zero gain, browser audio permission         | Inspect actual loaded instrument, track and master state; retry audition.    |
| TAB sounds transposed        | Tuning, capo, fret convention or source pitch                          | Check sounding pitches against companion pitched tracks.                     |
| Drum hit wrong sound         | Kit mapping or MIDI percussion convention                              | Verify supported note map for the intended track.                            |
| Pan differs in DAW           | Receiver/channel-wide CC10 constraints                                 | Compare exported MIDI events and use WAV to preserve audible result.         |
| WAV starts late/ends early   | Onset offset or musical clipping boundary                              | Check milliseconds and the authoritative song duration.                      |
| Effects not heard            | Processor bypass, zero send, contextual send mute                      | Enable processor and inspect the relevant track send.                        |
| Audio clipping / harshness   | Track gain, drum multiplier, EQ boost or combined returns              | Reduce gains and monitor safely; limiter is not a guarantee.                 |
| Cannot save or recover       | No musical track, storage quota, invalid ZIP or unavailable control    | Preserve originals; check project controls, browser storage and exact error. |
| Announcements stale          | Network or validation failure                                          | Refresh; bundled fallback can remain visible offline.                        |
| Export differs from audition | Saved mix settings, receiving app or file format mismatch              | Compare the same range and settings; use stereo WAV as a reference.          |

### Explicit boundaries for LABS

No direct TAB MIDI import, no arbitrary drum-kit swapping in the public interface, no continuous Pan_Sweep field, no guaranteed arbitrary MIDI controller round-trip, no VST hosting, no claim of full musical editing in the viewer, no guarantee of durable browser storage and no assumption of unlimited tracks. Future features should be documented only after release verification. Browser and device compatibility, minimum hardware and exact large-file limits are not independently established here.

<a id="governance"></a>

## Chapter 24 — Reference governance, verification and publication

This is an as-built functional reference, not a speculative pre-development PRD. Its rule identifiers are documentation aids. The intended maintenance practice is to update it with each externally significant release, retain the prior versions and clearly identify changed behaviour.

| Evidence class                      | Interpretation                                                                                                                                                                  |
|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Live interface text                 | Labels and explanatory content visible in the public app on 24 November 2026; does not prove a hidden or disabled control is usable.                                            |
| Recorded design and release history | Product decisions and reported regression/release outcomes through the post-launch MIDI pan fix; not an independent source audit.                                               |
| Functional examples and diagrams    | Original explanations created for this reference; illustrative, not source code or production screenshots.                                                                      |
| Unverified details                  | Exact schema inventory, split archive pairing/manifest details, all controller edge cases, current screenshots, privacy retention specifics and live browser interaction tests. |

### Public reference links

[SymphonyCSV Studio website](https://symphonycsvstudio.com/) · [Studio LABS application](https://symphonycsvstudio.com/app/) · [Help](https://symphonycsvstudio.com/help/) · [CSV format guides](https://symphonycsvstudio.com/help/specs/)

Supporting material used: public application interface text retrieved 24 November 2026; the musician-first Help draft and SoundFont credits Help draft dated 22 November 2026; recorded product architecture, development decisions and release notes from 19–24 November 2026. The Help endpoints could not be independently retrieved during this preparation; the links are the documented routes, not a link-health certification.

### Before public release of this reference

1.  Confirm exact active project workflow, manifest and pairing behaviour in the public app.
2.  Compare all CSV fields and supported expression against the official release headers and current column-level guides; link or embed authoritative machine-readable references.
3.  Run representative acceptance cases and verify MIDI import/export with a real receiving application.
4.  Capture and caption actual production screenshots; remove sensitive user and machine information.
5.  Check privacy and licensing wording against current published notices and actual bundled assets.
6.  Approve document version and publish at a stable URL. Keep LABS release facts separate from planned additions.

Documentation should enable musicians and AI assistants to reason accurately about the product without exposing proprietary implementation details. The reference is suitable for review and professional portfolio evidence of functional analysis; it is not yet a certified release specification.

SymphonyCSV Studio · Product & Functional Reference · Review draft 0.3\
Human-led · AI-assisted · [SymphonyCSVStudio.com](https://symphonycsvstudio.com/)
