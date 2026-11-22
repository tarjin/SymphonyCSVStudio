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
  for (const [index, note] of notes.entries()) {
    const midi = requireInt(note.midi, 0, 127, `note ${index} MIDI pitch`);
    const velocity = requireInt(note.velocity, 1, 127, `note ${index} velocity`);
    const onset = requireInt(note.onsetTick, 0, endTick - 1, `note ${index} onsetTick`);
    const duration = requireInt(note.durationTicks, 1, endTick, `note ${index} durationTicks`);
    if (onset + duration > endTick)
      throw Error(`note ${index} extends beyond the musical endpoint.`);
    events.push(
      {tick:onset, order:5, index, data:[0x90 | channel, midi, velocity]},
      {tick:onset + duration, order:4, index, data:[0x80 | channel, midi, 0]}
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
