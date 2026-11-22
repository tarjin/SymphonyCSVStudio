/*
 * SymphonyCSV Studio - TAB Transport Adapter v0.1
 *
 * Converts verified Rust/WASM TAB note schedules
 * to the shared Studio transport event format.
 *
 * Does not schedule audio, change a session,
 * or depend on the selected editor view.
 */

import './SymphonyCSV_Studio_Timing_v01.js';

const STRINGS = new Set([
  'LowE', 'A', 'D', 'G', 'B', 'HighE'
]);

export function tabImportToStudioEvents(
  tabImport,
  studioTrack = 3
) {
  // SCVS_STEP264_DUAL_TAB_ADAPTER
  // Guitar and Bass use the same authoritative TAB event format.
  // Their destination tracks remain independent.
  if (studioTrack !== 3 && studioTrack !== 4) {
    throw new Error(
      'Only TAB Tracks 3 and 4 are supported by this adapter.'
    );
  }

  if (tabImport?.kind !== 'tab' ||
      !Number.isSafeInteger(tabImport.noteCount) ||
      !Array.isArray(tabImport.schedule?.events) ||
      tabImport.noteCount !==
        tabImport.schedule.events.length) {
    throw new Error('Invalid TAB import result.');
  }

  const timing = globalThis.SymphonyCSVTiming.create(tabImport.song);

  return tabImport.schedule.events.map((event, index) => {
    if (!STRINGS.has(event.string)) {
      throw new Error(`Note ${index}: invalid TAB string.`);
    }

    if (!Number.isInteger(event.midi) ||
        event.midi < 0 || event.midi > 127 ||
        !Number.isInteger(event.velocity) ||
        event.velocity < 1 || event.velocity > 127) {
      throw new Error(`Note ${index}: invalid MIDI note.`);
    }

    // SCVS_STEP228_STUDIO_FRETS
    // Preserve only authoritative, validated Rust/WASM frets.
    if (!Number.isSafeInteger(event.fret) ||
        event.fret < 0) {
      throw new Error(`Note ${index}: invalid TAB fret.`);
    }

    // SCVS_STEP237_STUDIO_EVENT_IDENTITY
    // Preserve authoritative CSV event membership.
    if (!Number.isSafeInteger(event.sourceRecord) ||
        event.sourceRecord < 2) {
      throw new Error(
        `Note ${index}: invalid TAB source record.`
      );
    }

    const panPosition = event.panPosition ?? null;
    if (panPosition !== null &&
        (!Number.isInteger(panPosition) ||
         panPosition < -100 || panPosition > 100)) {
      throw new Error(`Note ${index}: invalid TAB panPosition.`);
    }

    const attackTick=event.attackTick;
    const noteOffTick=event.noteOffTick;
    if (!Number.isSafeInteger(attackTick) ||
        !Number.isSafeInteger(noteOffTick) ||
        noteOffTick <= attackTick ||
        noteOffTick > timing.endTick ||
        event.durationTicks !== noteOffTick - attackTick) {
      throw new Error(`Note ${index}: invalid authoritative TAB ticks.`);
    }

    const at = timing.tickToMs(attackTick);
    const noteOffMs = timing.tickToMs(noteOffTick);
    const duration = noteOffMs - at;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Note ${index}: invalid Studio timing.`);
    }

    return {
      studioTrack,
      string: event.string,
      sourceRecord: event.sourceRecord,
      fret: event.fret,
      midi: event.midi,
      velocity: event.velocity,
      panPosition,
      at,
      duration,
      noteOffMs,
      source: 'rust-wasm-tab'
    };
  });
}