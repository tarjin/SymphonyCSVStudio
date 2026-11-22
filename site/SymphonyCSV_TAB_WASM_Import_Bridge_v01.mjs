/*
 * SymphonyCSV Studio - TAB Rust/WASM Import Bridge v0.1
 *
 * Shared by Guitar TAB and Bass TAB.
 *
 * No session mutation, no file upload,
 * and no dependence on active editor mode.
 */

import init, {
  validate_tab_structure_json,
  parse_csv_rows_json,
  build_tab_events_json
} from './crates/symphonycsv_core/pkg/symphonycsv_core.js';

import { makeTabAudioSchedule } from
  './SymphonyCSV_Track3_WASM_Audio_Schedule_v01.mjs';

export function tabSongFromParsed(parsed) {
  const fields = [
    ['title', 'composition_title', 'text'],
    ['totalMeasures', 'composition_total_measures', 'integer'],
    ['endTick', 'composition_end_tick', 'integer'],
    ['ticksPerQuarter', 'ticks_per_quarter', 'integer'],
    ['tempoBpm', 'tempo_bpm', 'decimal'],
    ['timeSignature', 'time_signature', 'text']
  ];

  if (!Array.isArray(parsed?.headers) ||
      !Array.isArray(parsed?.records) ||
      parsed.records.length === 0) {
    throw new Error('TAB composition metadata is missing.');
  }

  const indices = fields.map(([, column]) => {
    const index = parsed.headers.indexOf(column);
    if (index < 0) {
      throw new Error(`Missing TAB metadata column: ${column}`);
    }
    return index;
  });

  function extract(row, recordNumber) {
    const song = {};

    for (let i = 0; i < fields.length; i++) {
      const [property, column, type] = fields[i];
      const value = String(row[indices[i]] ?? '').trim();

      if (!value) {
        throw new Error(`Record ${recordNumber}: missing ${column}.`);
      }

      if (type === 'integer') {
        const number = Number(value);
        if (!/^\d+$/.test(value) ||
            !Number.isSafeInteger(number) || number <= 0) {
          throw new Error(`Record ${recordNumber}: invalid ${column}.`);
        }
        song[property] = number;
      } else if (type === 'decimal') {
        const number = Number(value);
        if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(value) ||
            !Number.isFinite(number) || number <= 0) {
          throw new Error(`Record ${recordNumber}: invalid ${column}.`);
        }
        song[property] = number;
      } else {
        song[property] = value;
      }
    }

    return song;
  }

  const authority = extract(parsed.records[0], 2);
  const meter = /^(\d+)\/(1|2|4|8|16|32|64)$/.exec(authority.timeSignature);
  if (!meter) throw new Error('Unsupported TAB time_signature.');
  const measureTicks = Number(meter[1]) * authority.ticksPerQuarter * 4 / Number(meter[2]);
  const expectedEndTick = authority.totalMeasures * measureTicks;
  if (!Number.isSafeInteger(measureTicks) || measureTicks < 1 ||
      !Number.isSafeInteger(expectedEndTick) || authority.endTick !== expectedEndTick) {
    throw new Error(`TAB composition_end_tick must equal the final complete-measure barline (${expectedEndTick}).`);
  }

  for (let i = 1; i < parsed.records.length; i++) {
    const candidate = extract(parsed.records[i], i + 2);

    for (const [property, column] of fields) {
      if (candidate[property] !== authority[property]) {
        throw new Error(
          `Record ${i + 2}: ${column} differs from composition metadata.`
        );
      }
    }
  }

  return authority;
}

let initialization = null;

function ensureReady() {
  if (!initialization) {
    initialization = init().catch(error => {
      initialization = null;
      throw error;
    });
  }

  return initialization;
}

/**
 * Parse a TAB CSV and return a complete, independently
 * validated audio schedule.
 *
 * The caller decides which Studio track receives
 * the result. No global session state is changed.
 */
export async function importTabText(
  text,
  filename = 'unnamed.csv'
) {
  if (typeof filename !== 'string' ||
      !/\.csv$/i.test(filename)) {
    throw new Error('TAB import requires a .csv filename.');
  }

  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('TAB CSV content is empty.');
  }

  await ensureReady();

  const validation = JSON.parse(
    validate_tab_structure_json(text)
  );

  const parsed = JSON.parse(
    parse_csv_rows_json(text)
  );

  const notes = JSON.parse(
    build_tab_events_json(text)
  );

  if (validation.dataRows !== parsed.records.length ||
      validation.headers.length !== parsed.headers.length) {
    throw new Error(
      'TAB validation and parsed CSV disagree.'
    );
  }

  const song = tabSongFromParsed(parsed);

  const schedule = makeTabAudioSchedule(
    notes,
    parsed
  );

  if (schedule.noteCount !== notes.noteCount) {
    throw new Error(
      'TAB note counts disagree after scheduling.'
    );
  }

  return {
    kind: 'tab',
    song,
    filename,
    columnCount: parsed.headers.length,
    rowCount: parsed.records.length,
    noteCount: schedule.noteCount,
    headers: parsed.headers,
    records: parsed.records,
    schedule
  };
}

export async function tabWasmReady() {
  await ensureReady();
  return true;
}