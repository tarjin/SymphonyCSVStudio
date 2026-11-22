/* SymphonyCSV Studio — Drum event mapping and shared-timeline projection.
 * The universal 20-column musical CSV defines every drum hit and its timing.
 * Only the bundled kit profile maps a semantic surface to an SF2 MIDI key.
 */
import { mapDrumEventsToKit } from './SymphonyCSV_Drum_Kit_Mapper_v01.mjs';

export const BUNDLED_DRUM_KITS = Object.freeze({
  5: Object.freeze({
    name:'MuldjordKit Acoustic Drums',
    profileUrl:'/docs/drum-mappings/Step104_MuldjordKit_LABS_Profile_v01.csv'
  }),
  6: Object.freeze({
    name:'Synthesizer Percussion Electronic Drums',
    profileUrl:'/docs/drum-mappings/Step104_SynthesizerPercussion_LABS_Profile_v01.csv'
  })
});

export function parseDrumKitProfile(csvText, parseCSV) {
  if (typeof parseCSV !== 'function') throw Error('CSV parser unavailable.');
  const parsed = parseCSV(csvText);
  const columns = ['SurfaceId','Articulation','VariantId','MidiNote','Bank','Program','IsDefault'];
  if (parsed.headers.join('|') !== columns.join('|'))
    throw Error('Invalid bundled drum-kit profile columns.');
  if (!parsed.records.length) throw Error('Drum-kit profile contains no mappings.');
  return parsed.records;
}

export function projectDrumTrack(imported, slot, mappings, timing) {
  if (![5,6].includes(slot)) throw Error('Only Track 5/6 accept Drums CSV.');
  if (!Array.isArray(imported?.drumEvents) || !imported.song || !timing)
    throw Error('Missing validated drum events or shared composition clock.');
  if (imported.song.endTick !== timing.endTick ||
      imported.song.totalMeasures !== timing.totalMeasures ||
      imported.song.ticksPerQuarter !== timing.tpq)
    throw Error('Drum track does not match shared composition timing.');

  // All mappings and musical-event checks happen BEFORE mutation of the Studio
  // import session: an invalid replacement must leave playback untouched.
  const mapped = mapDrumEventsToKit(imported.drumEvents, mappings);
  const events = mapped.map((ev, index) => {
    const attack = Number(ev.attack_tick), duration = Number(ev.duration_ticks);
    const offset = Number(ev.timing_offset_ms ?? 0);
    const velocity = Number(ev.velocity);
    const panPosition = ev.pan_position ?? null;
    if (panPosition !== null &&
        (!Number.isInteger(panPosition) ||
         panPosition < -100 || panPosition > 100)) {
      throw Error(`Invalid drum pan_position at record ${ev.source_record ?? index+2}.`);
    }
    if (!Number.isSafeInteger(attack) || attack < 0 || attack >= timing.endTick ||
        !Number.isSafeInteger(duration) || duration < 1 ||
        attack + duration > timing.endTick ||
        !Number.isFinite(offset) || !Number.isSafeInteger(velocity) ||
        velocity < 1 || velocity > 127)
      throw Error(`Invalid drum hit at record ${ev.source_record ?? index+2}.`);
    if ((ev.note_off_method || '').trim() || (ev.choke_group || '').trim())
      throw Error('Advanced drum note-off/choke semantics are not yet supported by LABS playback.');
    const at = timing.tickToMs(attack) + offset;
    const lasting = timing.noteDurationMs(attack, duration);
    if (at < 0 || at >= timing.endMs || at + lasting > timing.endMs + 0.001)
      throw Error(`Drum timing offset moves hit outside the composition (record ${ev.source_record ?? index+2}).`);
    return Object.freeze({
      studioTrack:slot, id:ev.event_id, measure:Number(ev.measure),
      surface_id:ev.surface_id, articulation:ev.articulation,
      midi:ev.midi_note, velocity, panPosition, attack_tick:attack,
      note_off_tick:Number(ev.note_off_tick), duration_ticks:duration,
      at, duration:lasting
    });
  });
  return Object.freeze(events.sort((a,b)=>a.at-b.at || a.midi-b.midi || a.id.localeCompare(b.id)));
}

export function verifySoundFontRegions(events, soundFont) {
  if (!soundFont || typeof soundFont.regionsFor !== 'function')
    throw Error('Bundled drum SoundFont is not loaded.');
  const pairs = new Map(events.map(e=>[`${e.midi}:${e.velocity}`,e]));
  for (const e of pairs.values()) {
    if (!soundFont.regionsFor(e.midi,e.velocity).length) {
      throw Error(`Bundled drum SoundFont has no sample for ${e.surface_id} `+
        `(MIDI ${e.midi}, velocity ${e.velocity}).`);
    }
  }
  return true;
}
