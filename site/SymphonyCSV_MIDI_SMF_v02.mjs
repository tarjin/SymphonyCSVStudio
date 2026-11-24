/* SymphonyCSV Studio - deterministic single-track SMF Format 0 encoder.
 * Takes validated note events. Does not read/interpret CSV or audio preferences.
 */
function requireInt(value, low, high, label) {
  if (!Number.isSafeInteger(value) || value < low || value > high)
    throw Error(`${label} must be an integer from ${low} to ${high}.`);
  return value;
}
function be16(value) { return [(value >>> 8) & 255, value & 255]; }
function be32(value) { return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]; }
function vlq(value) {
  requireInt(value, 0, 0x0fffffff, 'MIDI variable-length integer');
  const out = [value & 0x7f];
  while ((value = Math.floor(value / 128)) > 0) out.unshift((value & 0x7f) | 0x80);
  return out;
}
function meta(type, payload) { return [0xff, type, ...vlq(payload.length), ...payload]; }
// MIDI CC10 is channel-wide, not per-note. Overlapping independently panned
// pitched/TAB/drum notes use separate channels to avoid moving sounding notes.
// GM percussion is only guaranteed on channel 10: other channels require a
// multichannel drum sampler/DAW routing. Unpanned exports remain byte-identical.
function routeNotePans(notes, channel) {
  const wantsPan = notes.some(n => n.panPosition !== null && n.panPosition !== undefined);
  if (!wantsPan) return null;
  const channels = [channel, ...Array.from({length:16}, (_,i)=>i)
    .filter(c => c !== channel && (channel === 9 || c !== 9))];
  const state = new Map(); // channel => last MIDI CC10 pan and active note pitches/end ticks
  const assigned = Array(notes.length);
  const panEvents = [];
  const sorted = notes.map((note,index) => ({note,index}))
    .sort((a,b) => a.note.onsetTick - b.note.onsetTick || a.index - b.index);
  for (const {note,index} of sorted) {
    const raw = note.panPosition;
    if (raw !== null && raw !== undefined)
      requireInt(raw, -100, 100, `note ${index} panPosition`);
    // Center is the portable MIDI approximation for blank/native SoundFont pan.
    const pan = raw == null ? 64 : Math.round((raw + 100) * 127 / 200);
    const onset = note.onsetTick;
    for (const info of state.values())
      info.active = info.active.filter(n => n.release > onset);
    // Reuse a sounding channel only if the pan matches; a duplicate pitch on
    // that same channel could otherwise be cut short by an earlier note-off.
    const matchingActive = channels.find(c => {
      const x=state.get(c);
      return x && x.pan===pan && x.active.length &&
        !x.active.some(n=>n.pitch===note.midi);
    });
    const idleMatching = channels.find(c => {
      const x=state.get(c);
      return x && !x.active.length && x.pan===pan;
    });
    // Prefer an already used, now-idle channel before consuming another one.
    // This keeps sequential strums on as few channels as possible.
    const idleUsed = channels.find(c => state.get(c) && !state.get(c).active.length);
    const unused = channels.find(c => !state.has(c));
    const chosen = matchingActive ?? idleMatching ?? idleUsed ?? unused;
    if (chosen === undefined)
      throw Error(`MIDI pan exceeds ${channels.length} simultaneously independent channels at tick ${onset}.`);
    const old=state.get(chosen);
    const info=old ?? {pan:64,active:[]};
    // Emit an explicit 0/center CC10 on a newly used channel too.
    if (info.pan !== pan || (!old && raw != null)) {
      panEvents.push({tick:onset, order:5, index, data:[0xb0|chosen, 10, pan]});
      info.pan=pan;
    }
    info.active.push({pitch:note.midi,release:onset+note.durationTicks});
    state.set(chosen,info);
    assigned[index]=chosen;
  }
  return {assigned,panEvents};
}

export function encodeSymphonyCSVTrackMidi({
  ticksPerQuarter, tempoUsPerQuarter, timeSignature, endTick,
  notes, trackName = 'SymphonyCSV Track', channel = 0,
  keySignatureFifths = null, keySignatureMode = null
}) {
  requireInt(ticksPerQuarter, 1, 0x7fff, 'ticksPerQuarter');
  requireInt(tempoUsPerQuarter, 1, 0xffffff, 'tempoUsPerQuarter');
  requireInt(endTick, 1, 0x0fffffff, 'endTick');
  requireInt(channel, 0, 15, 'channel');
  if (!Array.isArray(notes)) throw Error('notes must be an array.');
  const meter = /^([1-9]\d*)\/(1|2|4|8|16|32|64)$/.exec(String(timeSignature));
  if (!meter) throw Error('Unsupported timeSignature.');
  const numerator = Number(meter[1]);
  requireInt(numerator, 1, 255, 'time signature numerator');
  const denomPower = Math.log2(Number(meter[2]));
  const title = new TextEncoder().encode(String(trackName));
  if (title.length > 4096) throw Error('trackName is too long.');
  const events = [
    { tick:0, order:0, index:0, data:meta(0x03, [...title]) },
    { tick:0, order:1, index:1, data:meta(0x51, [
      (tempoUsPerQuarter >>> 16) & 255,
      (tempoUsPerQuarter >>> 8) & 255, tempoUsPerQuarter & 255
    ]) },
    { tick:0, order:2, index:2, data:meta(0x58, [numerator, denomPower, 24, 8]) }
  ];
  if (keySignatureFifths !== null || keySignatureMode !== null) {
    requireInt(keySignatureFifths, -7, 7, 'key signature fifths');
    requireInt(keySignatureMode, 0, 1, 'key signature mode');
    events.push({tick:0, order:3, index:3, data:meta(0x59, [keySignatureFifths & 255, keySignatureMode])});
  }
  // Validate all notes before allocating their overlapping pan voices.
  for (const [index, note] of notes.entries()) {
    requireInt(note.midi, 0, 127, `note ${index} MIDI pitch`);
    requireInt(note.velocity, 1, 127, `note ${index} velocity`);
    const onset = requireInt(note.onsetTick, 0, endTick - 1, `note ${index} onsetTick`);
    const duration = requireInt(note.durationTicks, 1, endTick, `note ${index} durationTicks`);
    if (onset + duration > endTick)
      throw Error(`note ${index} extends beyond the musical endpoint.`);
  }
  const panRouting = routeNotePans(notes, channel);
  if (panRouting) events.push(...panRouting.panEvents);
  for (const [index, note] of notes.entries()) {
    const noteChannel = panRouting ? panRouting.assigned[index] : channel;
    events.push(
      {tick:note.onsetTick, order:panRouting ? 6 : 5, index, data:[0x90 | noteChannel, note.midi, note.velocity]},
      {tick:note.onsetTick + note.durationTicks, order:4, index, data:[0x80 | noteChannel, note.midi, 0]}
    );
  }
  events.push({tick:endTick, order:6, index:0, data:meta(0x2f, [])});
  events.sort((a,b) => a.tick - b.tick || a.order - b.order || a.index - b.index);
  const body = [];
  let previous = 0;
  for (const event of events) {
    body.push(...vlq(event.tick - previous), ...event.data);
    previous = event.tick;
  }
  if (body.length > 0xffffffff) throw Error('MIDI track exceeds size limit.');
  return Uint8Array.from([
    0x4d,0x54,0x68,0x64, ...be32(6), ...be16(0), ...be16(1), ...be16(ticksPerQuarter),
    0x4d,0x54,0x72,0x6b, ...be32(body.length), ...body
  ]);
}
