import test from 'node:test';
import assert from 'node:assert/strict';
import { readMidi, prepareMidi, convertPitchedToCsv, midiCc10ToPanPosition } from '../site/midi-workspace/src/midi-core.mjs';
import { convertDrumsToCsv, DRUM_COLUMNS } from '../site/midi-workspace/src/drum-schema.mjs';
import { PITCHED_COLUMNS } from '../site/midi-workspace/src/pitched-schema.mjs';

// Build minimal Format 0/1 MIDI files using absolute-tick event arrays.
const vlq = n => {const bytes=[n&127];for(n>>=7;n;n>>=7)bytes.unshift((n&127)|128);return bytes;};
const be16 = n => [(n>>8)&255,n&255];
const be32 = n => [(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
function makeMidi(tracks) {
  const out=[...'MThd'].map(x=>x.charCodeAt(0)).concat(be32(6),be16(tracks.length===1?0:1),be16(tracks.length),be16(480));
  for(const events of tracks) {
    let prev=0;const bytes=[];
    for(const [tick,...ev] of events){assert.ok(tick>=prev);bytes.push(...vlq(tick-prev),...ev);prev=tick;}
    bytes.push(...vlq(1920-prev),255,47,0);
    out.push(...[...'MTrk'].map(x=>x.charCodeAt(0)),...be32(bytes.length),...bytes);
  }
  return Uint8Array.from(out);
}
const prepared=(m,target,partKey)=>prepareMidi(m,{target,partKey,totalMeasures:1,tempoBpm:120,title:'Pan QA'});
const parseRow=line=>{const cells=[];let cell='',quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i];
    if(ch==='"'){if(quoted&&line[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){cells.push(cell);cell='';}else cell+=ch;
  }cells.push(cell);return cells;
};
const records=text=>{
  const rows=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(parseRow);
  return rows.slice(1).map(row=>Object.fromEntries(rows[0].map((head,i)=>[head,row[i]])));
};
const drumProfile=[{SurfaceId:'kick_1',Articulation:'',VariantId:'',MidiNote:'36',IsDefault:'true'},
  {SurfaceId:'hihat_1',Articulation:'closed',VariantId:'',MidiNote:'42',IsDefault:'true'}];

test('CC10 values map to -100..100 with MIDI centre 64 exactly zero',()=>{
  assert.deepEqual([0,32,64,127].map(midiCc10ToPanPosition),[-100,-50,0,100]);
  assert.throws(()=>midiCc10ToPanPosition(128),/Invalid MIDI CC10/);
});

test('Piano Roll converts CC10 and controller reset CC121 into 86-column Pan_Position',()=>{
 const m=readMidi(makeMidi([[[0,0xB0,10,0],[0,0x90,60,95],[120,0x80,60,0],
  [120,0xB0,10,127],[120,0x90,64,90],[240,0x80,64,0],
  [240,0xB0,121,0],[240,0x90,67,80],[360,0x80,67,0]]]));
 const s=convertPitchedToCsv(prepared(m,1,'__ALL_NOTES__'));
 assert.equal(PITCHED_COLUMNS.length,86);
 assert.deepEqual(records(s).map(x=>x.Pan_Position),['-100','100','0']);
 assert.deepEqual(records(s).map(x=>x.velocity),['95','90','80']);
 assert.deepEqual(records(s).map(x=>x.cc10_pan),['','','']);
 assert.ok(!m.warnings.some(x=>x.includes('unsupported MIDI controller')));
});

test('Absent CC10 remains blank but explicit centre is zero',()=>{
 const m=readMidi(makeMidi([[[0,0x90,60,80],[120,0x80,60,0],
  [120,0xB0,10,64],[120,0x90,62,85],[240,0x80,62,0]]]));
 assert.deepEqual(records(convertPitchedToCsv(prepared(m,2,'__ALL_NOTES__'))).map(x=>x.Pan_Position),['','0']);
});

test('Format 1 CC10 on a different control-only track applies by channel and tick',()=>{
 const m=readMidi(makeMidi([
  [[0,0xB0,10,30],[240,0xB0,10,96]],
  [[0,0x90,60,100],[120,0x80,60,0],[240,0x90,65,80],[360,0x80,65,0]]
 ]));
 assert.deepEqual(records(convertPitchedToCsv(prepared(m,1,'__ALL_NOTES__'))).map(x=>x.Pan_Position),
  [String(midiCc10ToPanPosition(30)),String(midiCc10ToPanPosition(96))]);
});

test('Piano Roll channel reduction does not cross-contaminate pan channels',()=>{
 const m=readMidi(makeMidi([[[0,0xB0,10,0],[0,0xB1,10,127],
  [0,0x90,60,80],[0,0x91,72,80],[120,0x80,60,0],[120,0x81,72,0]]]));
 assert.deepEqual(records(convertPitchedToCsv(prepared(m,1,'__ALL_NOTES__'))).map(x=>x.Pan_Position),['-100','100']);
});

test('CC10 following an attack at the same tick is not retroactive',()=>{
 const m=readMidi(makeMidi([[[0,0x90,60,90],[0,0xB0,10,127],
  [0,0x90,62,90],[120,0x80,60,0],[120,0x80,62,0]]]));
 assert.deepEqual(records(convertPitchedToCsv(prepared(m,1,'__ALL_NOTES__'))).map(x=>x.Pan_Position),['','100']);
});

test('Mid-note CC10 sweeps are warned and onset pan is unchanged',()=>{
 const m=readMidi(makeMidi([[[0,0xB0,10,0],[0,0x90,60,90],
  [60,0xB0,10,127],[120,0x80,60,0]]]));
 assert.equal(records(convertPitchedToCsv(prepared(m,1,'__ALL_NOTES__')))[0].Pan_Position,'-100');
 assert.ok(m.warnings.some(x=>x.includes('sustained notes')));
});

test('Drums 5/6 preserve per-hit CC10 and blank native pan in 21-column CSV',()=>{
 const m=readMidi(makeMidi([[[0,0x99,36,100],[60,0x89,36,0],
  [60,0xB9,10,0],[60,0x99,42,78],[120,0x89,42,0],
  [120,0xB9,10,127],[120,0x99,36,89],[180,0x89,36,0]]]));
 for(const target of [5,6]){
  const s=convertDrumsToCsv(prepared(m,target,'__ALL_PERCUSSION__'),drumProfile);
  assert.equal(DRUM_COLUMNS.length,21);
  assert.deepEqual(records(s).filter(x=>x.event_type==='hit').map(x=>x.Pan_Position),['','-100','100']);
  assert.deepEqual(records(s).filter(x=>x.event_type==='hit').map(x=>x.velocity),['100','78','89']);
 }
});
