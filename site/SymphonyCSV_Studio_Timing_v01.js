/* SymphonyCSV Studio shared composition clock — Tracks 1–4.
 * CSV ticks and their validated tempo/meter metadata are the sole musical
 * authority. The existing Web Audio clock remains the playback wall clock.
 * Changing tempo/meter rows are deliberately rejected: the current CSV
 * importer has no complete tempo/meter change-event map.
 */
(function (root) {
  'use strict';

  function positiveInt(value, label) {
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 1)
      throw Error(`${label} must be a positive safe integer.`);
    return number;
  }

  function prepareSong(song, rows, headers = null) {
    if (!song || !Array.isArray(rows) || rows.length === 0)
      throw Error('Missing validated SymphonyCSV composition or rows.');
    const get = headers
      ? (row, field) => row[headers.indexOf(field)]
      : (row, field) => row[field];
    const hasColumn = headers
      ? headers.includes('tempo_us_per_quarter')
      : Object.hasOwn(rows[0], 'tempo_us_per_quarter');
    const prepared = { ...song };
    if (hasColumn) {
      let microseconds = null;
      for (const [index, row] of rows.entries()) {
        const raw = String(get(row, 'tempo_us_per_quarter') ?? '').trim();
        if (!/^\d+$/.test(raw))
          throw Error(`Record ${index + 2}: invalid tempo_us_per_quarter.`);
        const value = positiveInt(raw, `Record ${index + 2} tempo_us_per_quarter`);
        if (microseconds !== null && value !== microseconds)
          throw Error('Tempo changes require an explicit complete tempo map; import unchanged.');
        microseconds = value;
      }
      const bpmFromMicroseconds = 60_000_000 / microseconds;
      if (Math.abs(bpmFromMicroseconds - Number(song.tempoBpm)) > 0.01)
        throw Error('tempo_bpm and tempo_us_per_quarter disagree.');
      prepared.tempoUsPerQuarter = microseconds;
    } else {
      // This is still CSV-derived timing when the microsecond column is absent.
      prepared.tempoUsPerQuarter = 60_000_000 / Number(song.tempoBpm);
    }
    create(prepared); // Validate everything before session/transport mutation.
    return prepared;
  }

  function create(song) {
    if (!song || !Number.isFinite(Number(song.tempoBpm)) || Number(song.tempoBpm) <= 0)
      throw Error('Invalid composition tempo.');
    const totalMeasures = positiveInt(song.totalMeasures, 'composition_total_measures');
    const endTick = positiveInt(song.endTick, 'composition_end_tick');
    const tpq = positiveInt(song.ticksPerQuarter, 'ticks_per_quarter');
    const match = /^([1-9]\d*)\/(1|2|4|8|16|32|64)$/.exec(String(song.timeSignature));
    if (!match) throw Error('Unsupported composition time signature.');
    const measureTicks = Number(match[1]) * tpq * 4 / Number(match[2]);
    if (!Number.isSafeInteger(measureTicks) || measureTicks < 1)
      throw Error('Measure length must be an integer number of MIDI ticks.');
    const microseconds = Number(song.tempoUsPerQuarter ?? 60_000_000 / song.tempoBpm);
    if (!Number.isFinite(microseconds) || microseconds <= 0)
      throw Error('Invalid tempo_us_per_quarter.');
    const fullEndTick = totalMeasures * measureTicks;
    if (!Number.isSafeInteger(fullEndTick) || endTick !== fullEndTick)
      throw Error(`composition_end_tick must equal the final complete-measure barline (${fullEndTick}); got ${endTick}. Partial-measure songs are not supported.`);
    const msPerTick = microseconds / (tpq * 1000);
    const endMs = endTick * msPerTick;
    if (!Number.isFinite(endMs)) throw Error('Composition duration is invalid.');
    const tickToMs = tick => {
      if (!Number.isSafeInteger(tick) || tick < 0 || tick > endTick)
        throw Error('Event tick is outside the composition.');
      return tick * msPerTick;
    };
    const measureStartMs = m =>
      tickToMs((positiveInt(m, 'measure') - 1) * measureTicks);
    const measureEndMs = m =>
      tickToMs(Math.min(positiveInt(m, 'measure') * measureTicks, endTick));
    const positionToMeasure = ms => {
      const bounded = Math.min(endMs, Math.max(0, Number(ms) || 0));
      return Math.max(1, Math.min(totalMeasures,
        Math.floor(bounded / (measureTicks * msPerTick)) + 1));
    };
    return Object.freeze({
      totalMeasures, endTick, tpq, measureTicks, msPerTick, endMs,
      tickToMs, measureStartMs, measureEndMs, positionToMeasure,
      noteDurationMs: (startTick, durationTicks) => {
        if (!Number.isSafeInteger(durationTicks) || durationTicks <= 0)
          throw Error('Invalid note duration in ticks.');
        // Rust's pitched importer tolerates a final one-tick MIDI note-off;
        // the shared player never sounds past the CSV composition end.
        if (startTick >= endTick) throw Error('Note starts at or after composition end.');
        return tickToMs(Math.min(endTick,startTick + durationTicks)) -
          tickToMs(startTick);
      }
    });
  }

  const api = Object.freeze({ prepareSong, create });
  root.SymphonyCSVTiming = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
