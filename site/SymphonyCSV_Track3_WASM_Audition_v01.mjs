import init, {
  build_tab_events_json,
  parse_csv_rows_json
} from './crates/symphonycsv_core/pkg_tab_events_lab/symphonycsv_core.js';

import { LocalSF2 } from
  './SymphonyCSV_Track3_LocalSF2_v01.mjs';

import { makeTabAudioSchedule } from
  './SymphonyCSV_Track3_WASM_Audio_Schedule_v01.mjs';

const $ = id => document.getElementById(id);

let schedule = null;
let sf = null;
let audio = null;
let output = null;
let activeVoices = [];

const ready = init();

function refresh() {
  $('play').disabled = !(schedule && sf);
  $('stop').disabled = activeVoices.length === 0;
}

function stopVoices() {
  for (const voice of activeVoices) {
    try { voice.source.stop(); } catch {}
    try { voice.gain.disconnect(); } catch {}
  }
  activeVoices = [];
  refresh();
}

function report(error) {
  const message = error instanceof Error
    ? error.message : String(error);
  $('status').textContent = 'ERROR: ' + message;
  console.error(error);
}

$('csv').addEventListener('change', async event => {
  stopVoices();
  schedule = null;
  $('events').textContent = 'No CSV loaded.';
  refresh();

  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      throw Error('Select a .csv file.');
    }

    await ready;

    const csv = await file.text();
    const wasmData = JSON.parse(build_tab_events_json(csv));
    const csvData = JSON.parse(parse_csv_rows_json(csv));

    schedule = makeTabAudioSchedule(wasmData, csvData);

    $('events').textContent = JSON.stringify(
      schedule.events.map(e => ({
        string: e.string,
        midi: e.midi,
        velocity: e.velocity,
        attack_s: Number(e.attackSeconds.toFixed(4)),
        release_s: Number(e.releaseSeconds.toFixed(4))
      })),
      null,
      2
    );

    $('status').textContent =
      `${schedule.noteCount} Rust/WASM notes validated.`;
  } catch (error) {
    schedule = null;
    report(error);
  }

  refresh();
});

$('sf2').addEventListener('change', async event => {
  stopVoices();
  sf = null;
  refresh();

  const file = event.target.files?.[0];
  if (!file) return;

  try {
    if (!file.name.toLowerCase().endsWith('.sf2')) {
      throw Error('Select a local .sf2 SoundFont.');
    }

    sf = new LocalSF2(await file.arrayBuffer(), file.name);

    $('instrument').textContent =
      `Loaded: ${sf.presetName} (${file.name})`;

    $('status').textContent =
      'SoundFont loaded. Ready when CSV is validated.';
  } catch (error) {
    sf = null;
    $('instrument').textContent = 'SoundFont load failed.';
    report(error);
  }

  refresh();
});

$('play').addEventListener('click', async () => {
  if (!schedule || !sf) return;

  try {
    await ready;

    if (!audio) {
      const Ctx = window.AudioContext ||
        window.webkitAudioContext;

      if (!Ctx) throw Error('Web Audio unavailable.');

      audio = new Ctx();
      output = audio.createGain();
      output.gain.value = 0.55;
      output.connect(audio.destination);
    }

    await audio.resume();
    stopVoices();

    // Do not silently skip missing instrument samples.
    const uncovered = schedule.events.filter(e =>
      sf.regionsFor(e.midi, e.velocity).length === 0
    );

    if (uncovered.length) {
      throw Error(
        `SoundFont has no samples for ${uncovered.length} notes.`
      );
    }

    const warmed = sf.prewarm(audio, schedule.events);
    const start = audio.currentTime + 0.15;

    for (const e of schedule.events) {
      const voices = sf.note(
        audio,
        output,
        e.midi,
        e.velocity,
        start + e.attackSeconds,
        e.durationSeconds
      );

      activeVoices.push(...voices);
    }

    $('status').textContent =
      `Playing ${schedule.noteCount} Rust/WASM TAB notes. ` +
      `${warmed} samples prepared.`;

    refresh();
  } catch (error) {
    stopVoices();
    report(error);
  }
});

$('stop').addEventListener('click', () => {
  stopVoices();
  $('status').textContent = 'Playback stopped.';
});

ready.catch(report);
refresh();