import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSymphonyCSVTrackMidi} from '../site/SymphonyCSV_MIDI_SMF_v02.mjs';
import {prepareSymphonyCSVTrackExport,makeMidiSidecar} from '../site/SymphonyCSV_MIDI_Export_Core_v01.mjs';

const song={title:'TAB pan QA',totalMeasures:2,endTick:3840,ticksPerQuarter:480,
  tempoUsPerQuarter:600000,timeSignature:'4/4'};
const settings={ticksPerQuarter:480,tempoUsPerQuarter:600000,timeSignature:'4/4',endTick:3840};
const note=(midi,onsetTick,durationTicks,panPosition)=>({midi,velocity:90,onsetTick,durationTicks,panPosition});
const encode=notes=>encodeSymphonyCSVTrackMidi({...settings,notes});
function events(bytes) {
  assert.equal(Buffer.from(bytes.subarray(0,4)).toString('ascii'),'MThd');
  const result=[];let p=22,tick=0;
  function vlq(){let v=0,b;do{b=bytes[p++];v=v*128+(b&127)}while(b&128);return v;}
  while(p<bytes.length){
    tick+=vlq();const status=bytes[p++];
    if(status===255){const meta=bytes[p++],length=vlq();p+=length;result.push({tick,meta});continue;}
    assert.ok([0x80,0x90,0xb0].includes(status&0xf0));
    result.push({tick,kind:status&0xf0,ch:status&15,a:bytes[p++],b:bytes[p++]});
  }
  assert.equal(p,bytes.length);
  return result;
}

test('blank pan preserves legacy single-channel MIDI bytes',()=>{
  const src=[note(60,0,480,null),note(64,240,480,undefined)];
  const legacy=src.map(({midi,velocity,onsetTick,durationTicks})=>({midi,velocity,onsetTick,durationTicks}));
  assert.deepEqual(encode(src),encode(legacy));
  assert.equal(events(encode(src)).filter(e=>e.kind===0xb0).length,0);
});
test('successive explicit pans are CC10 before note-on at original ticks',()=>{
  const ev=events(encode([note(60,0,120,-100),note(62,120,120,100),note(64,240,120,0)]));
  assert.deepEqual(ev.filter(e=>e.kind===0xb0).map(e=>[e.tick,e.ch,e.a,e.b]),
    [[0,0,10,0],[120,0,10,127],[240,0,10,64]]);
  assert.deepEqual(ev.filter(e=>e.kind===0x90).map(e=>[e.tick,e.ch]),[[0,0],[120,0],[240,0]]);
  for(const cc of ev.filter(e=>e.kind===0xb0)){
    const on=ev.findIndex(e=>e.tick===cc.tick&&e.kind===0x90&&e.ch===cc.ch);
    assert.ok(on>ev.indexOf(cc),'CC10 must precede note-on');
  }
});
test('overlapping strum notes keep separate stereo channels and correct releases',()=>{
  const ev=events(encode([note(52,0,480,-100),note(59,40,480,100),note(64,80,480,0)]));
  const on=ev.filter(e=>e.kind===0x90),off=ev.filter(e=>e.kind===0x80);
  assert.deepEqual(on.map(e=>e.tick),[0,40,80]);
  assert.deepEqual(off.map(e=>e.tick),[480,520,560]);
  assert.equal(new Set(on.map(e=>e.ch)).size,3);
  assert.ok(on.every(e=>e.ch!==9),'GM drum channel remains unused');
  for(const e of on)assert.equal(off.find(x=>x.a===e.a).ch,e.ch);
  assert.deepEqual(ev.filter(e=>e.kind===0xb0).map(e=>e.b),[0,127,64]);
});
test('reuse channel for same pan, isolate overlapping duplicate pitches',()=>{
  const ev=events(encode([note(60,0,400,-70),note(62,30,400,-70),note(60,60,400,-70)]));
  const on=ev.filter(e=>e.kind===0x90);
  assert.equal(on[0].ch,on[1].ch);
  assert.notEqual(on[0].ch,on[2].ch);
});
test('six string panning, capacity limit, invalid pan and endpoint',()=>{
  const six=[-100,-60,-20,20,60,100].map((pan,i)=>note(40+5*i,15*i,500,pan));
  const ev=events(encode(six));
  assert.equal(new Set(ev.filter(e=>e.kind===0x90).map(e=>e.ch)).size,6);
  assert.equal(ev.filter(e=>e.kind===0xb0).length,6);
  const sixteen=Array.from({length:16},(_,i)=>note(40+i,0,480,-100+12*i));
  assert.throws(()=>encode(sixteen),/exceeds 15 simultaneously independent melodic channels/);
  for(const bad of [101,-101,'10'])assert.throws(()=>encode([note(60,0,120,bad)]),/panPosition/);
  assert.equal(events(encode([note(60,0,120,0)])).at(-1).tick,3840);
});
test('Studio TAB schedule pan is exported and documented without affecting unpanned exports',()=>{
  const tab={song,schedule:{ticksPerQuarter:480,microsecondsPerQuarter:600000,events:[
    {midi:52,velocity:85,attackTick:0,durationTicks:480,noteOffTick:480,panPosition:-100},
    {midi:59,velocity:88,attackTick:20,durationTicks:480,noteOffTick:500,panPosition:100}
  ]}};
  const session={song,tracks:[null,null,tab],filenames:[null,null,'tab.csv']};
  const exported=prepareSymphonyCSVTrackExport(session,3);
  assert.equal(exported.panEncoded,true);
  assert.equal(events(exported.bytes).filter(e=>e.kind===0xb0).length,2);
  assert.match(makeMidiSidecar(exported,'a'.repeat(64),'2026-11-23T12:00:00Z'),/TAB stereo: per-event\/per-string pan/);
  const noPan={...tab,schedule:{...tab.schedule,events:tab.schedule.events.map(({panPosition,...n})=>n)}};
  const plain=prepareSymphonyCSVTrackExport({...session,tracks:[null,null,noPan]},3);
  assert.equal(plain.panEncoded,false);
  assert.equal(events(plain.bytes).filter(e=>e.kind===0xb0).length,0);
});
