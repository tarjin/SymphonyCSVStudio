/*
 * SymphonyCSV Guitar TAB - WASM Audio Schedule v0.1
 *
 * Converts authoritative tick events into seconds
 * for the existing LocalSF2 Web Audio player.
 *
 * LABS v0.1 supports constant-tempo compositions.
 * Tempo changes must not be interpreted silently.
 */

const GUITAR_STRINGS = new Set([
  'LowE', 'A', 'D', 'G', 'B', 'HighE'
]);

function positiveInteger(value, name) {
  const text = String(value ?? '').trim();

  if (!/^\d+$/.test(text)) {
    throw new Error(`${name} must be a positive integer.`);
  }

  const number = Number(text);

  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${name} is outside the supported range.`);
  }

  return number;
}

function tick(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a safe nonnegative tick.`);
  }

  return value;
}

export function makeTabAudioSchedule(wasmData, csvData) {
  const headers = csvData?.headers;
  const records = csvData?.records;

  if (!Array.isArray(headers) ||
      !Array.isArray(records) ||
      records.length === 0) {
    throw new Error('Missing parsed TAB CSV records.');
  }

  const tpqColumn = headers.indexOf('ticks_per_quarter');
  const tempoColumn = headers.indexOf('tempo_us_per_quarter');

  if (tpqColumn < 0 || tempoColumn < 0) {
    throw new Error('Missing TAB tempo metadata.');
  }

  let tpq = null;
  let tempo = null;

  for (const row of records) {
    if (!Array.isArray(row) || row.length !== headers.length) {
      throw new Error('Invalid parsed TAB record width.');
    }

    const rowTPQ = positiveInteger(
      row[tpqColumn], 'ticks_per_quarter'
    );

    const rowTempo = positiveInteger(
      row[tempoColumn], 'tempo_us_per_quarter'
    );

    if (tpq === null) {
      tpq = rowTPQ;
      tempo = rowTempo;
    } else if (rowTPQ !== tpq || rowTempo !== tempo) {
      throw new Error(
        'Tempo or tick-resolution changes require a tempo-map adapter.'
      );
    }
  }

  const events = wasmData?.events;

  if (!Array.isArray(events) ||
      !Number.isSafeInteger(wasmData.noteCount) ||
      wasmData.noteCount !== events.length) {
    throw new Error('Invalid WASM TAB event collection.');
  }

  const secondsPerTick = tempo / (tpq * 1_000_000);

  if (!Number.isFinite(secondsPerTick) ||
      secondsPerTick <= 0) {
    throw new Error('Invalid seconds-per-tick conversion.');
  }

  const audioEvents = events.map((event, index) => {
    if (!GUITAR_STRINGS.has(event.string)) {
      throw new Error(`Note ${index}: unknown TAB string.`);
    }

    if (!Number.isInteger(event.midi) ||
        event.midi < 0 || event.midi > 127 ||
        !Number.isInteger(event.velocity) ||
        event.velocity < 1 || event.velocity > 127) {
      throw new Error(`Note ${index}: invalid MIDI data.`);
    }

    // SCVS_STEP226_FRET_SCHEDULE
    // Fret comes from authoritative Rust/WASM TAB events.
    if (!Number.isSafeInteger(event.fret) ||
        event.fret < 0) {
      throw new Error(`Note ${index}: invalid TAB fret.`);
    }

    // SCVS_STEP236_EVENT_IDENTITY
    // Physical CSV record supplied by authoritative Rust/WASM.
    if (!Number.isSafeInteger(event.source_record) ||
        event.source_record < 2) {
      throw new Error(`Note ${index}: invalid TAB source record.`);
    }

    const panPosition = event.pan_position ?? null;
    if (panPosition !== null &&
        (!Number.isInteger(panPosition) ||
         panPosition < -100 || panPosition > 100)) {
      throw new Error(`Note ${index}: invalid TAB pan_position.`);
    }

    const attack = tick(event.attack_tick, 'attack_tick');
    const release = tick(event.note_off_tick, 'note_off_tick');
    const duration = tick(event.duration_ticks, 'duration_ticks');

    if (release <= attack || duration !== release - attack) {
      throw new Error(`Note ${index}: invalid release timing.`);
    }

    const attackSeconds = attack * secondsPerTick;
    const durationSeconds = duration * secondsPerTick;
    const releaseSeconds = release * secondsPerTick;

    if (![attackSeconds, durationSeconds, releaseSeconds]
        .every(Number.isFinite)) {
      throw new Error(`Note ${index}: unsafe audio timing.`);
    }

    return {
      string: event.string,
      sourceRecord: event.source_record,
      fret: event.fret,
      midi: event.midi,
      velocity: event.velocity,
      panPosition,
      // Keep original WASM ticks for exact shared Studio time conversion.
      attackTick: attack,
      noteOffTick: release,
      durationTicks: duration,
      attackSeconds,
      durationSeconds,
      releaseSeconds
    };
  });

  return {
    noteCount: audioEvents.length,
    ticksPerQuarter: tpq,
    microsecondsPerQuarter: tempo,
    secondsPerTick,
    events: audioEvents
  };
}