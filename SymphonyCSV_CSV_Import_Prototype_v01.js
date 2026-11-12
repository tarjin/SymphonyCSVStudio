/* SymphonyCSV Studio — CSV Import Core, JavaScript prototype v0.1
   Browser: window.SymphonyCSVImport
   Node test harness: require('./SymphonyCSV_CSV_Import_Prototype_v01.js')
   Does not change the DOM, audio engine, or any source file.
   This is a deliberately scoped prototype: variable tempo or meter maps
   are not accepted until a complete shared timeline representation is defined.
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SymphonyCSVImport = api;
})(typeof window !== 'undefined' ? window : undefined, function () {
  'use strict';

  class SymphonyCSVError extends Error {
    constructor(message) {
      super(message);
      this.name = 'SymphonyCSVError';
    }
  }

  // Correctly handles UTF-8 BOM, CRLF/LF, quoted commas, escaped quotes,
  // and embedded newlines in quoted CSV values.
  function parseCSV(text) {
    if (typeof text !== 'string') throw new SymphonyCSVError('CSV content must be text.');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], cell = '', quoted = false, afterQuote = false;
    function emitCell() { row.push(cell); cell = ''; afterQuote = false; }
    function emitRow() { emitCell(); rows.push(row); row = []; }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
        else if (c === '"') { quoted = false; afterQuote = true; }
        else { cell += c; }
        continue;
      }
      if (afterQuote && c !== ',' && c !== '\n' && c !== '\r') {
        throw new SymphonyCSVError('Unexpected characters after a quoted field near record ' + (rows.length + 1) + '.');
      }
      if (c === '"') {
        if (cell !== '' || afterQuote) throw new SymphonyCSVError('Unexpected quote near record ' + (rows.length + 1) + '.');
        quoted = true;
      } else if (c === ',') emitCell();
      else if (c === '\n') emitRow();
      else if (c === '\r') { if (text[i+1] === '\n') i++; emitRow(); }
      else cell += c;
    }
    if (quoted) throw new SymphonyCSVError('Unclosed quoted CSV field.');
    if (row.length || cell.length || afterQuote) emitRow();
    if (!rows.length || !rows[0].length) throw new SymphonyCSVError('CSV is empty.');
    const headers = rows.shift();
    if (headers.some(h => !h)) throw new SymphonyCSVError('Blank CSV column name.');
    if (new Set(headers).size !== headers.length) throw new SymphonyCSVError('Duplicate CSV column name.');
    const records = rows.map((values, i) => {
      if (values.length !== headers.length) {
        throw new SymphonyCSVError('CSV record ' + (i + 2) + ' has ' + values.length + ' fields; expected ' + headers.length + '.');
      }
      const record = Object.create(null);
      for (let j = 0; j < headers.length; j++) record[headers[j]] = values[j];
      return record;
    });
    return { headers, records };
  }

  const REQUIRED = [
    'composition_title','composition_total_measures','composition_end_tick',
    'tempo_bpm','time_signature','ticks_per_quarter',
    'event_type','measure','onset_ms','duration_ms',
    'pitch_label','midi_pitch','velocity','staff',
    'absolute_tick','duration_ticks'
  ];
  const integer = (value, label, min = 0) => {
    if (!/^[0-9]+$/.test(String(value).trim())) throw new SymphonyCSVError(label + ' must be an integer.');
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min) throw new SymphonyCSVError(label + ' must be >= ' + min + '.');
    return n;
  };
  const positive = (value, label) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new SymphonyCSVError(label + ' must be positive.');
    return n;
  };
  const signature = (value) => {
    const match = /^([1-9][0-9]*)\s*\/\s*(1|2|4|8|16|32|64)$/.exec(value.trim());
    if (!match) throw new SymphonyCSVError('Invalid time signature: ' + value);
    return Number(match[1]) + '/' + Number(match[2]);
  };

  function importText(text, filename = 'unnamed.csv') {
    const { headers, records } = parseCSV(text);
    const absent = REQUIRED.filter(h => !headers.includes(h));
    if (absent.length) throw new SymphonyCSVError('Missing required SymphonyCSV columns: ' + absent.join(', '));
    if (!records.length) throw new SymphonyCSVError('This prototype needs at least one event row to establish song metadata.');

    const first = records[0];
    const title = first.composition_title.trim();
    if (!title) throw new SymphonyCSVError('composition_title is blank.');
    const totalMeasures = integer(first.composition_total_measures, 'composition_total_measures', 1);
    const endTick = integer(first.composition_end_tick, 'composition_end_tick', 1);
    const ticksPerQuarter = integer(first.ticks_per_quarter, 'ticks_per_quarter', 1);
    const tempoBpm = positive(first.tempo_bpm, 'tempo_bpm');
    const timeSignature = signature(first.time_signature);
    const notes = [];
    const tempoVariants = new Set();
    const meterVariants = new Set();
    for (let i = 0; i < records.length; i++) {
      const row = records[i], where = 'Record ' + (i + 2);
      if (row.composition_title.trim() !== title) throw new SymphonyCSVError(where + ': song title differs within the file.');
      if (integer(row.composition_total_measures, where + ' total measures', 1) !== totalMeasures) throw new SymphonyCSVError(where + ': measure count differs within the file.');
      if (integer(row.composition_end_tick, where + ' composition end tick', 1) !== endTick) throw new SymphonyCSVError(where + ': composition end tick differs within the file.');
      if (integer(row.ticks_per_quarter, where + ' ticks per quarter', 1) !== ticksPerQuarter) throw new SymphonyCSVError(where + ': tick resolution differs within the file.');
      tempoVariants.add(positive(row.tempo_bpm, where + ' tempo'));
      meterVariants.add(signature(row.time_signature));
      const measure = integer(row.measure, where + ' measure', 1);
      if (measure > totalMeasures) throw new SymphonyCSVError(where + ': event occurs beyond the declared song.');
      if (row.event_type.trim().toLowerCase() === 'note') {
        const onsetTick = integer(row.absolute_tick, where + ' absolute_tick');
        const durationTicks = integer(row.duration_ticks, where + ' duration_ticks', 1);
        if (onsetTick + durationTicks > endTick + 1) throw new SymphonyCSVError(where + ': note extends beyond the declared composition.');
        const onsetMs = integer(row.onset_ms, where + ' onset_ms');
        const durationMs = integer(row.duration_ms, where + ' duration_ms', 1);
        const midiPitch = integer(row.midi_pitch, where + ' midi_pitch');
        if (midiPitch > 127) throw new SymphonyCSVError(where + ': MIDI pitch is outside 0–127.');
        const velocity = integer(row.velocity, where + ' velocity');
        if (velocity > 127) throw new SymphonyCSVError(where + ': velocity is outside 0–127.');
        if (!row.pitch_label.trim()) throw new SymphonyCSVError(where + ': note pitch_label is blank.');
        notes.push({ rowIndex: i, measure, staff: row.staff, pitch: row.pitch_label,
          midi: midiPitch, velocity, onsetMs, durationMs, onsetTick, durationTicks,
          midiSourceTrack: row.midi_track || null });
      }
    }
    // Metadata in sparse note rows is not a sufficient representation of a full
    // changing tempo/meter schedule. Never claim compatibility for such files yet.
    if (tempoVariants.size !== 1 || meterVariants.size !== 1) {
      throw new SymphonyCSVError('Tempo or meter changes detected. Import is deferred until explicit full-song change maps are supported; no data was loaded.');
    }
    return {
      filename, headers, rows: records, notes,
      song: { title, totalMeasures, endTick, ticksPerQuarter, tempoBpm, timeSignature },
      summary: { csvColumns: headers.length, dataRows: records.length, noteEvents: notes.length,
        upperStaff: notes.filter(n => n.staff === 'Upper staff').length,
        lowerStaff: notes.filter(n => n.staff === 'Lower staff').length }
    };
  }

  function compareSong(current, candidate) {
    if (!current) return { ok: true, mismatches: [] };
    const mismatches = [];
    for (const [field, label] of [
      ['title','composition_title'],['totalMeasures','composition_total_measures'],
      ['endTick','composition_end_tick'],['ticksPerQuarter','ticks_per_quarter'],
      ['tempoBpm','tempo_bpm'],['timeSignature','time_signature']
    ]) {
      if (current[field] !== candidate[field]) mismatches.push(label + ': expected ' + current[field] + ', received ' + candidate[field]);
    }
    return { ok: mismatches.length === 0, mismatches };
  }

  return { parseCSV, importText, compareSong, SymphonyCSVError, version: '0.1' };
});
