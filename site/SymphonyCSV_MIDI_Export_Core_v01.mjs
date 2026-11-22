/* Adapts already-validated Studio session slots into SMF note events.
 * Does not parse CSV, synthesize instruments or use performance tail padding.
 */
import { encodeSymphonyCSVTrackMidi } from './SymphonyCSV_MIDI_SMF_v02.mjs';
function safeInt(x, label) {
  if (!Number.isSafeInteger(x)) throw Error(`Invalid ${label}.`);
  return x;
}
function songSettings(song, track) {
  if (!song) throw Error('Load a validated musical composition first.');
  const ticksPerQuarter = safeInt(Number(song.ticksPerQuarter), 'ticksPerQuarter');
  const endTick = safeInt(Number(song.endTick), 'endTick');
  const totalMeasures = safeInt(Number(song.totalMeasures), 'totalMeasures');
  const match = /^([1-9]\d*)\/(1|2|4|8|16|32|64)$/.exec(String(song.timeSignature));
  if (!match) throw Error('Unsupported time signature.');
  if (ticksPerQuarter <= 0 || totalMeasures <= 0 || endTick <= 0 ||
      (totalMeasures * Number(match[1]) * ticksPerQuarter * 4 / Number(match[2])) !== endTick)
    throw Error('CSV-authored musical endpoint must be the full final barline.');
  const tempoUsPerQuarter = Number(song.tempoUsPerQuarter);
  // All verified sample CSVs supply this exact integer tempo. Do not reconstruct
  // from a rounded BPM field; doing so would silently alter musical timing.
  if (!Number.isSafeInteger(tempoUsPerQuarter) || tempoUsPerQuarter < 1 || tempoUsPerQuarter > 0xffffff)
    throw Error('Exact tempoUsPerQuarter is missing. Reimport the CSV before export.');
  if (track?.song) {
    for (const field of ['title','totalMeasures','endTick','ticksPerQuarter','timeSignature']) {
      if (track.song[field] !== song[field]) throw Error(`Track differs from composition in ${field}.`);
    }
    if (track.song.tempoUsPerQuarter != null &&
        Number(track.song.tempoUsPerQuarter) !== tempoUsPerQuarter)
      throw Error('Track tempo differs from composition.');
  }
  return { ticksPerQuarter, endTick, totalMeasures, tempoUsPerQuarter, timeSignature:song.timeSignature };
}
function readKeySignature(track) {
  // Parsed pitched track records come from WASM; TAB records from WASM CSV rows.
  let record = track?.rows?.[0];
  if (!record && Array.isArray(track?.records) && Array.isArray(track?.headers)) {
    const i = track.headers.indexOf('key_signature_fifths');
    const j = track.headers.indexOf('key_signature_mode');
    if (i >= 0 && j >= 0 && track.records.length) {
      record = { key_signature_fifths: track.records[0][i], key_signature_mode: track.records[0][j] };
    }
  }
  if (!record) return {};
  const fifths = String(record.key_signature_fifths ?? '').trim();
  const mode = String(record.key_signature_mode ?? '').trim().toLowerCase();
  if (!fifths && !mode) return {};
  const value = Number(fifths);
  if (!Number.isInteger(value) || value < -7 || value > 7 || !['major','minor'].includes(mode))
    throw Error('Invalid CSV-authored key signature metadata.');
  return { keySignatureFifths:value, keySignatureMode:mode === 'minor' ? 1 : 0 };
}
function project(slot, track, settings) {
  let records, timingErrorMs = 0;
  if (slot <= 2) {
    if (!Array.isArray(track.notes)) throw Error('Pitched track lacks validated WASM notes.');
    records = track.notes.map(n => ({midi:n.midi, velocity:n.velocity, onsetTick:n.onsetTick, durationTicks:n.durationTicks}));
  } else if (slot <= 4) {
    if (!Array.isArray(track.schedule?.events)) throw Error('TAB track lacks WASM note schedule.');
    if (track.schedule.ticksPerQuarter !== settings.ticksPerQuarter ||
        track.schedule.microsecondsPerQuarter !== settings.tempoUsPerQuarter)
      throw Error('TAB schedule differs from authoritative CSV timing.');
    records = track.schedule.events.map(e => ({
      midi:e.midi, velocity:e.velocity,
      onsetTick:e.attackTick, durationTicks:e.durationTicks
    }));
    for (const [i,e] of track.schedule.events.entries())
      if (e.noteOffTick !== e.attackTick + e.durationTicks)
        throw Error(`TAB note ${i} release differs from duration.`);
  } else {
    if (!Array.isArray(track.studioEvents)) throw Error('Drum track lacks validated WASM kit-mapped events.');
    const msPerTick = settings.tempoUsPerQuarter / settings.ticksPerQuarter / 1000;
    records = track.studioEvents.map((e,index) => {
      // The validated Studio events already carry the actual sample-kit MIDI key.
      // Convert the playback timing (including timing_offset_ms) to nearest
      // possible SMF tick: fractional ticks are not representable in MIDI.
      if (!Number.isFinite(e.at) || !Number.isSafeInteger(e.attack_tick) ||
          !Number.isSafeInteger(e.duration_ticks) || !Number.isInteger(e.midi))
        throw Error(`Invalid mapped drum event ${index}.`);
      const onsetTick = Math.round(e.at / msPerTick);
      const error = Math.abs(onsetTick * msPerTick - e.at);
      timingErrorMs = Math.max(timingErrorMs, error);
      return {midi:e.midi, velocity:e.velocity, onsetTick, durationTicks:e.duration_ticks};
    });
  }
  return {records, timingErrorMs};
}
export function prepareSymphonyCSVTrackExport(session, slot) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 6) throw Error('Choose a musical track from 1 to 6.');
  const track = session?.tracks?.[slot-1];
  if (!track) throw Error(`Track ${slot} has no validated SymphonyCSV import.`);
  const settings = songSettings(session.song, track);
  const {records, timingErrorMs} = project(slot, track, settings);
  const type = slot <= 2 ? 'Pitched' : slot <= 4 ? 'Guitar or Bass TAB' : 'Percussion';
  const channel = slot >= 5 ? 9 : 0;  // channel 10 is percussion in General MIDI convention
  const title = `Track ${String(slot).padStart(2,'0')} - ${type}`;
  const keys = slot <= 4 ? readKeySignature(track) : {};
  const bytes = encodeSymphonyCSVTrackMidi({
    ...settings, notes:records, channel, trackName:title, ...keys
  });
  return Object.freeze({
    slot, title, bytes, channel, settings, noteCount:records.length,
    sourceFilename: session.filenames?.[slot-1] || track.filename || '(unknown)',
    kind:type, drumKit:slot >= 5 ? (track.kitName || '(unknown kit)') : null,
    timingErrorMs
  });
}
// Receipt labels reflect the Studio track and its selected drum-kit description.
// Keep prepareSymphonyCSVTrackExport().kind and MIDI trackName unchanged:
// altering them would change otherwise-identical MIDI binary exports.
function receiptTrackType(exported) {
  if (exported.slot === 3 || exported.slot === 4) return 'Guitar TAB';
  if (exported.slot === 5 || exported.slot === 6) {
    const kit = String(exported.drumKit ?? '');
    if (/\bacoustic\s+drums?\b/i.test(kit)) return 'Acoustic Drums';
    if (/\belectronic\s+drums?\b/i.test(kit)) return 'Electronic Drums';
    // The Studio's bundled/default slots have these fixed functions.
    return exported.slot === 5 ? 'Acoustic Drums' : 'Electronic Drums';
  }
  return exported.kind;
}
export function makeMidiSidecar(exported, hash, timestamp) {
  if (!/^[a-f0-9]{64}$/i.test(hash)) throw Error('Valid SHA-256 digest required.');
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw Error('Valid export time required.');
  const {settings:s} = exported;
  const lines = [
    'SYMPHONYCSV STUDIO - MIDI EXPORT RECEIPT',
    `Generated UTC: ${date.toISOString()}`,
    `Track slot: ${exported.slot}`,
    `Track type: ${receiptTrackType(exported)}`,
    `Source CSV: ${exported.sourceFilename}`,
    `Exported events: ${exported.noteCount}`,
    `MIDI channel (1-based): ${exported.channel+1}`,
    `Tempo: ${s.tempoUsPerQuarter} microseconds per quarter note`,
    `Time signature: ${s.timeSignature}`,
    `Ticks per quarter: ${s.ticksPerQuarter}`,
    `Total measures: ${s.totalMeasures}`,
    `Musical end tick: ${s.endTick}`,
    'MIDI format: Standard MIDI File 0 (single track)',
    'Timing: CSV musical ticks; Natural Decay Padding is not applied.',
    `MIDI file SHA-256: ${hash.toUpperCase()}`,
    ''
  ];
  if (exported.drumKit) lines.push(
    `Drum kit: ${exported.drumKit}`,
    'Drum pitches: native bundled-SoundFont mapping (not standard GM drum keys).',
    'MIDI channel 10 is used. MuseScore may show or sound different percussion.',
    `Max timing-offset quantization error: ${exported.timingErrorMs.toFixed(3)} ms`,
    ''
  );
  lines.push(
    'REVIEW',
    'Import the MIDI into MuseScore or a DAW to inspect its measures and notes.',
    'MIDI does not encode Studio SoundFont samples, FX, master drum gain,',
    'or Natural Decay Padding used for WAV/MP3/MP4 audio/video renders.',
    'Tracks 1-6 export independently as MIDI musical-event data.',
    'Align these MIDI files at musical tick zero.',
    'Tracks 7-8 contain recorded WAV audio and are excluded from MIDI exports.',
    'Preserve the source WAV recordings with the Project Audio ZIP;',
    'rendered audio exports contain their audible contribution instead.',
    '',
    'Powered by SymphonyCSV Studio.',
    'Visit SymphonyCSVStudio.com'
  );
  return lines.join('\n');
}
