function integer(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

function vlq(value) {
  integer(value, 0, 0x0fffffff, 'MIDI delta');
  const bytes = [value & 127];

  while (value > 127) {
    value = Math.floor(value / 128);
    bytes.unshift((value & 127) | 128);
  }

  return bytes;
}

export function encodeSymphonyCSVTrackMidi({
  ticksPerQuarter,
  tempoUsPerQuarter,
  timeSignature,
  endTick,
  notes,
  trackName = 'SymphonyCSV Track',
  channel = 0
}) {
  integer(ticksPerQuarter, 1, 32767, 'ticks per quarter');
  integer(tempoUsPerQuarter, 1, 0xffffff, 'tempo');
  integer(endTick, 0, 0x0fffffff, 'composition endpoint');
  integer(channel, 0, 15, 'MIDI channel');

  if (!Array.isArray(notes)) {
    throw new Error('Notes must be an array.');
  }

  const match = /^(\d+)\/(\d+)$/.exec(timeSignature);
  if (!match) throw new Error('Invalid time signature.');

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  const denominatorPower = Math.log2(denominator);

  integer(numerator, 1, 255, 'meter numerator');
  integer(denominatorPower, 0, 7, 'meter denominator');

  const name = Array.from(new TextEncoder().encode(trackName));

  const events = [
    {
      tick: 0,
      order: 0,
      data: [0xff, 0x03, ...vlq(name.length), ...name]
    },
    {
      tick: 0,
      order: 0,
      data: [
        0xff, 0x51, 0x03,
        (tempoUsPerQuarter >>> 16) & 255,
        (tempoUsPerQuarter >>> 8) & 255,
        tempoUsPerQuarter & 255
      ]
    },
    {
      tick: 0,
      order: 0,
      data: [
        0xff, 0x58, 0x04,
        numerator, denominatorPower, 24, 8
      ]
    }
  ];

  for (const note of notes) {
    const { midi, velocity, onsetTick, durationTicks } = note;

    integer(midi, 0, 127, 'pitch');
    integer(velocity, 1, 127, 'velocity');
    integer(onsetTick, 0, endTick, 'note onset');
    integer(durationTicks, 1, 0x0fffffff, 'duration');

    const release = onsetTick + durationTicks;

    if (release > endTick) {
      throw new Error('Note extends beyond composition endpoint.');
    }

    events.push({
      tick: onsetTick,
      order: 2,
      data: [0x90 | channel, midi, velocity]
    });

    events.push({
      tick: release,
      order: 1,
      data: [0x80 | channel, midi, 0]
    });
  }

  events.push({
    tick: endTick,
    order: 3,
    data: [0xff, 0x2f, 0x00]
  });

  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const body = [];
  let previousTick = 0;

  for (const event of events) {
    body.push(...vlq(event.tick - previousTick), ...event.data);
    previousTick = event.tick;
  }

  const size = body.length;

  const header = [
    0x4d, 0x54, 0x68, 0x64,
    0, 0, 0, 6,
    0, 0,
    0, 1,
    (ticksPerQuarter >>> 8) & 255,
    ticksPerQuarter & 255
  ];

  const trackHeader = [
    0x4d, 0x54, 0x72, 0x6b,
    (size >>> 24) & 255,
    (size >>> 16) & 255,
    (size >>> 8) & 255,
    size & 255
  ];

  return Uint8Array.from([...header, ...trackHeader, ...body]);
}
