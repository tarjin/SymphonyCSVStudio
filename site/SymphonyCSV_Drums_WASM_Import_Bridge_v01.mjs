/*
 * SymphonyCSV Drums WASM Import Bridge v0.1
 * Shared by musical Tracks 5 and 6.
 *
 * Musical Drums CSV remains independent of SoundFonts
 * and drum-kit mapping profiles.
 */

import init, {
  build_drum_events_json,
  parse_csv_rows_json
} from "./crates/symphonycsv_core/pkg/symphonycsv_core.js";

let wasmReady = null;

async function ensureWasm() {
  if (!wasmReady) {
    wasmReady = (async () => {
      const response = await fetch(
        "/crates/symphonycsv_core/pkg/symphonycsv_core_bg.wasm"
      );

      if (!response.ok) {
        throw new Error(
          `Drums WASM unavailable: HTTP ${response.status}`
        );
      }

      await init({ module_or_path: response });
    })().catch(error => {
      wasmReady = null;
      throw error;
    });
  }

  await wasmReady;
}

function songFromCsv(parsed) {
  if (!Array.isArray(parsed.headers) ||
      !Array.isArray(parsed.records) ||
      parsed.records.length === 0) {
    throw new Error("Drums CSV has no composition data.");
  }

  const first = Object.fromEntries(
    parsed.headers.map(
      (name, index) => [name, parsed.records[0][index]]
    )
  );

  const song = {
    title: first.composition_title,
    totalMeasures: Number(first.composition_total_measures),
    endTick: Number(first.composition_end_tick),
    ticksPerQuarter: Number(first.ticks_per_quarter),
    tempoBpm: Number(first.tempo_bpm),
    timeSignature: first.time_signature
  };

  if (typeof song.title !== "string" ||
      !song.title.trim() ||
      typeof song.timeSignature !== "string" ||
      !song.timeSignature.trim() ||
      !Number.isSafeInteger(song.totalMeasures) ||
      song.totalMeasures < 1 ||
      !Number.isSafeInteger(song.endTick) ||
      song.endTick < 1 ||
      !Number.isSafeInteger(song.ticksPerQuarter) ||
      song.ticksPerQuarter < 1 ||
      !Number.isFinite(song.tempoBpm) ||
      song.tempoBpm <= 0) {
    throw new Error("Invalid Drums composition metadata.");
  }

  return song;
}

export async function importDrumText(csvText, filename = "") {
  if (typeof csvText !== "string" || !csvText.trim()) {
    throw new Error("Drums CSV is empty.");
  }

  await ensureWasm();

  // Rust validates the universal Drums CSV and
  // extracts musical hit events. Rests produce no hits.
  const drumEvents = JSON.parse(
    build_drum_events_json(csvText)
  );

  if (!Array.isArray(drumEvents)) {
    throw new Error("Invalid WASM Drums event result.");
  }

  const parsed = JSON.parse(
    parse_csv_rows_json(csvText)
  );

  const song = songFromCsv(parsed);

  return {
    format: "drums",
    filename,
    song,
    drumEvents,
    columnCount: parsed.headers.length,
    rowCount: parsed.records.length,
    summary: {
      noteEvents: drumEvents.length,
      csvColumns: parsed.headers.length,
      dataRows: parsed.records.length
    }
  };
}