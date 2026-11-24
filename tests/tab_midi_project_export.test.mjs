import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { prepareSymphonyCSVTrackExport } from '../site/SymphonyCSV_MIDI_Export_Core_v01.mjs';
import { prepareMusicalProjectZIP } from '../site/SymphonyCSV_Project_Save_UI_v01.mjs';
import { readProjectZip } from '../site/SymphonyCSV_Project_ZIP_Reader_v01.mjs';
import { writeSymphonyCSVProjectZip } from '../site/SymphonyCSV_Project_ZIP_Writer_v01.mjs';
import { defaultProjectManifest } from '../site/SymphonyCSV_Project_Manifest_v01.mjs';

const decoder = new TextDecoder();
const song = Object.freeze({
  title: 'TAB MIDI Export QA',
  ticksPerQuarter: 480,
  tempoUsPerQuarter: 500000,
  timeSignature: '4/4',
  totalMeasures: 2,
  endTick: 3840,
  tempoBpm: 120
});
const notes3 = [
  { midi: 64, velocity: 89, attackTick: 0, durationTicks: 240, noteOffTick: 240 },
  { midi: 67, velocity: 72, attackTick: 120, durationTicks: 720, noteOffTick: 840 }
];
const notes4 = [
  { midi: 40, velocity: 101, attackTick: 480, durationTicks: 480, noteOffTick: 960 }
];
function tabTrack(events) {
  return { song, schedule: { events, ticksPerQuarter: 480, microsecondsPerQuarter: 500000 } };
}
function session() {
  return {
    song,
    tracks: [null, null, tabTrack(notes3), tabTrack(notes4), null, null],
    filenames: [null, null, 'guitar.csv', 'bass.csv', null, null]
  };
}
function readVlq(bytes, state) {
  let value = 0;
  for (let i = 0; i < 4; i++) {
    assert.ok(state.at < bytes.length, 'truncated MIDI VLQ');
    const b = bytes[state.at++];
    value = value * 128 + (b & 0x7f);
    if (!(b & 0x80)) return value;
  }
  throw Error('invalid MIDI VLQ');
}
function midiEvents(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(decoder.decode(bytes.subarray(0, 4)), 'MThd');
  assert.equal(view.getUint32(4, false), 6);
  assert.equal(view.getUint16(8, false), 0);
  assert.equal(view.getUint16(10, false), 1);
  assert.equal(view.getUint16(12, false), 480);
  assert.equal(decoder.decode(bytes.subarray(14, 18)), 'MTrk');
  const end = 22 + view.getUint32(18, false);
  assert.equal(end, bytes.length);
  const state = { at: 22 }, events = [];
  let tick = 0;
  while (state.at < end) {
    tick += readVlq(bytes, state);
    const status = bytes[state.at++];
    if (status === 0xff) {
      const type = bytes[state.at++];
      const length = readVlq(bytes, state);
      state.at += length;
      assert.ok(state.at <= end);
      events.push({ tick, status, type });
    } else {
      assert.ok(status >= 0x80 && status <= 0xef, 'explicit channel status required');
      const type = status & 0xf0;
      const count = type === 0xc0 || type === 0xd0 ? 1 : 2;
      const payload = [...bytes.subarray(state.at, state.at + count)];
      state.at += count;
      events.push({ tick, status, payload });
    }
  }
  assert.equal(state.at, end);
  assert.deepEqual(events.at(-1), { tick: 3840, status: 0xff, type: 0x2f });
  return events;
}
function storedZipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result = new Map();
  let p = 0;
  while (p + 4 <= bytes.byteLength && view.getUint32(p, true) === 0x04034b50) {
    assert.equal(view.getUint16(p + 8, true), 0, 'Project ZIP is STORE format');
    const size = view.getUint32(p + 18, true);
    const nameLength = view.getUint16(p + 26, true);
    const extraLength = view.getUint16(p + 28, true);
    const name = decoder.decode(bytes.subarray(p + 30, p + 30 + nameLength));
    const start = p + 30 + nameLength + extraLength;
    const end = start + size;
    assert.ok(end <= bytes.length, 'ZIP entry bounds');
    assert.ok(!result.has(name), 'duplicate ZIP entry');
    result.set(name, bytes.subarray(start, end));
    p = end;
  }
  assert.ok(result.size > 0);
  return result;
}

test('TAB Tracks 3 and 4 produce normal musical MIDI notes with authoritative timing', () => {
  const s = session();
  const a = prepareSymphonyCSVTrackExport(s, 3);
  const b = prepareSymphonyCSVTrackExport(s, 4);
  assert.equal(a.noteCount, 2);
  assert.equal(b.noteCount, 1);
  assert.deepEqual(
    midiEvents(a.bytes).filter(e => e.status === 0x90).map(e => [e.tick, ...e.payload]),
    [[0, 64, 89], [120, 67, 72]]
  );
  assert.deepEqual(
    midiEvents(a.bytes).filter(e => e.status === 0x80).map(e => [e.tick, ...e.payload]),
    [[240, 64, 0], [840, 67, 0]]
  );
  assert.deepEqual(
    midiEvents(b.bytes).filter(e => e.status === 0x90).map(e => [e.tick, ...e.payload]),
    [[480, 40, 101]]
  );
  assert.deepEqual(
    midiEvents(b.bytes).filter(e => e.status === 0x80).map(e => [e.tick, ...e.payload]),
    [[960, 40, 0]]
  );
});

test('Project ZIP exports include TAB MIDI companions while import reads CSV as the source', async () => {
  const s = session();
  const csv3 = 'authoritative,track\nTAB,3\n';
  const csv4 = 'authoritative,track\nTAB,4\n';
  const archive = prepareMusicalProjectZIP({
    session: s,
    sources: [
      { slot: 3, filename: 'guitar.csv', csvText: csv3 },
      { slot: 4, filename: 'bass.csv', csvText: csv4 }
    ],
    runtime: {}
  });
  const entries = storedZipEntries(archive.bytes);
  for (const name of [
    'Track_3.csv', 'Track_3.mid', 'Track_4.csv', 'Track_4.mid',
    'SymphonyCSV_Project.json', 'SymphonyCSV_Project_Details.txt'
  ]) assert.ok(entries.has(name), 'missing ' + name);
  assert.equal(decoder.decode(entries.get('Track_3.csv')), csv3);
  assert.equal(decoder.decode(entries.get('Track_4.csv')), csv4);
  assert.deepEqual(entries.get('Track_3.mid'), prepareSymphonyCSVTrackExport(s, 3).bytes);
  assert.deepEqual(entries.get('Track_4.mid'), prepareSymphonyCSVTrackExport(s, 4).bytes);
  midiEvents(entries.get('Track_3.mid'));
  midiEvents(entries.get('Track_4.mid'));

  const opened = await readProjectZip(archive.bytes);
  assert.deepEqual(opened.sources.map(source => source.slot), [3, 4]);
  assert.equal(decoder.decode(opened.sources[0].bytes), csv3);
  assert.equal(decoder.decode(opened.sources[1].bytes), csv4);
  assert.deepEqual(opened.inventory.exports.map(source => source.slot), [3, 4]);
  assert.deepEqual(opened.manifest.tracks.map(track => track.source_file),
    ['Track_3.csv', 'Track_4.csv']);
});

test('Legacy Project ZIP without TAB MIDI companions remains readable', async () => {
  const inventory = {
    sources: [{ slot: 3, filename: 'Track_3.csv', type: 'musical' }]
  };
  const manifest = defaultProjectManifest(inventory, 'Legacy Guitar');
  const archive = writeSymphonyCSVProjectZip([
    { name: 'Track_3.csv', data: 'legacy-tab-csv\n' },
    { name: 'SymphonyCSV_Project.json', data: JSON.stringify(manifest) }
  ]);
  const opened = await readProjectZip(archive);
  assert.equal(decoder.decode(opened.sources[0].bytes), 'legacy-tab-csv\n');
  assert.deepEqual(opened.inventory.exports, []);
  assert.equal(opened.manifest.tracks[0].source_file, 'Track_3.csv');
});

test('Standalone MIDI import still disallows TAB Tracks 3 and 4', () => {
  const bridge = readFileSync('site/SymphonyCSV_Studio_MIDI_Import_Bridge_v01.js', 'utf8');
  assert.match(bridge, /MIDI import supports Piano Roll Tracks 1.2 or Drum Tracks 5.6\. TAB remains CSV-only\./);
  assert.match(bridge, /Import MIDI into Piano Roll Track 1\/2 or Drum Track 5\/6/);
});


test('Contextual MIDI import is disabled on TAB Tracks 3 and 4 with a usable explanation', () => {
  const script = readFileSync('site/SymphonyCSV_Studio_MIDI_Import_Bridge_v01.js', 'utf8');
  function element(tag = 'div') {
    const handlers = new Map();
    return {
      tag, id: '', dataset: {}, attributes: {}, children: [], hidden: false,
      disabled: false, title: '', tabIndex: -1,
      append(...items) { this.children.push(...items); },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      removeAttribute(name) { delete this.attributes[name]; },
      addEventListener(name, fn) {
        const callbacks = handlers.get(name) || [];
        callbacks.push(fn); handlers.set(name, callbacks);
      },
      dispatch(name) { for (const fn of handlers.get(name) || []) fn({ type: name }); },
      getAttribute(name) { return this.attributes[name] ?? null; }
    };
  }
  const header = element('div');
  const status = element('p');
  status.parentElement = header;
  const frame = element('iframe');
  frame.contentWindow = { postMessage() {} };
  const nav = element('nav');
  const sidebar = element('button');
  sidebar.disabled = true;
  const tabs = Array.from({ length: 6 }, (_, i) => {
    const tab = element('button');
    tab.dataset.track = String(i + 1);
    return tab;
  });
  let selected = 1;
  const views = [];
  const doc = {
    readyState: 'complete',
    head: element('head'),
    createElement: element,
    getElementById(id) {
      return ({
        'scsv-import-status': status,
        'scsv-midi-frame': frame,
        sixTrackNav: nav
      })[id] ?? null;
    },
    querySelector(selector) {
      if (selector === '#sixTrackNav .track-tab.selected[data-track]')
        return tabs[selected - 1];
      if (selector === '.view-nav .nav-item[data-view="import-midi"]')
        return sidebar;
      return null;
    },
    querySelectorAll(selector) {
      return selector === '#sixTrackNav .track-tab[data-track]' ? tabs : [];
    }
  };
  const host = {
    location: { origin: 'https://symphonycsvstudio.com' },
    SymphonyCSVSetView(view) { views.push(view); },
    addEventListener() {}
  };
  runInNewContext(script, {
    document: doc, window: host, location: { hash: '' },
    queueMicrotask(fn) { fn(); }, console
  });
  const wrapper = header.children.find(node => node.id === 'scsv-midi-open-wrap');
  assert.ok(wrapper, 'accessible wrapper must exist');
  const button = wrapper.children.find(node => node.id === 'scsv-midi-open');
  const note = wrapper.children.find(node => node.id === 'scsv-midi-import-note');
  assert.ok(button && note);
  assert.equal(sidebar.disabled, false, 'existing MIDI workspace navigation unchanged');
  function select(slot) {
    selected = slot;
    tabs[slot - 1].dispatch('click');
  }
  for (const slot of [3, 4]) {
    select(slot);
    assert.equal(button.disabled, true, 'TAB import should be disabled');
    assert.equal(note.hidden, false, 'TAB explanation should be visible');
    assert.match(note.textContent, /standard MIDI cannot reliably/i);
    assert.match(note.textContent, /MIDI export is supported/);
    assert.match(wrapper.title, /string\/fret positions/);
    assert.equal(wrapper.tabIndex, 0, 'tooltip remains keyboard focusable');
    assert.equal(wrapper.attributes['aria-describedby'], note.id);
    const before = views.length;
    button.dispatch('click');
    assert.equal(views.length, before, 'disabled action must never navigate');
    host.SymphonyCSVOpenMidiWorkspace(slot);
    assert.equal(views.length, before, 'programmatic TAB import must still reject');
  }
  for (const slot of [1, 2, 5, 6]) {
    select(slot);
    assert.equal(button.disabled, false, 'existing MIDI targets remain enabled');
    assert.equal(note.hidden, true);
    assert.equal(wrapper.tabIndex, -1);
    assert.equal(wrapper.attributes['aria-describedby'], undefined);
    const before = views.length;
    button.dispatch('click');
    assert.deepEqual(views.slice(before), ['import-midi']);
  }
});
