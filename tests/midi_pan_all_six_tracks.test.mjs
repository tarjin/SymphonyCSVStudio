import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSymphonyCSVTrackMidi} from '../site/SymphonyCSV_MIDI_SMF_v02.mjs';
import {prepareSymphonyCSVTrackExport,makeMidiSidecar} from '../site/SymphonyCSV_MIDI_Export_Core_v01.mjs';

const song={title:'Six track pan QA',ticksPerQuarter:480,tempoUsPerQuarter:600000,
  timeSignature:'4/4',totalMeasures:2,endTick:3840};
const session=(slot,track)=>({song,tracks:Array.from({length:6},(_,i)=>i===slot-1?track:null),filenames:Array.from({length:6},(_,i)=>i===slot-1?`t${slot}.csv`:null)});
const n=(midi,onsetTick,durationTicks,panPosition)=>({midi,velocity:91,onsetTick,durationTicks,panPosition});
const dt=(midi,attack_tick,duration_ticks,panPosition,offset=0)=>({
  midi,velocity:96,attack_tick,duration_ticks,panPosition,at:attack_tick*1.25+offset
});
function decode(bytes){
  assert.equal(new TextDecoder().decode(bytes.subarray(0,4)),'MThd');
  const out=[];let pos=22,tick=0;
  function vlq(){let v=0,b;do{b=bytes[pos++];v=v*128+(b&127);}while(b&128);return v;}
  while(pos<bytes.length){
    tick+=vlq();const status=bytes[pos++];
    if(status===255){const meta=bytes[pos++],len=vlq();pos+=len;out.push({tick,meta});continue;}
    assert.ok([128,144,176].includes(status&240));
    out.push({tick,type:status&240,ch:status&15,a:bytes[pos++],b:bytes[pos++]});
  }
  assert.equal(pos,bytes.length);
  return out;
}
const ons=e=>e.filter(x=>x.type===144),offs=e=>e.filter(x=>x.type===128),pans=e=>e.filter(x=>x.type===176);
const receipt=exp=>makeMidiSidecar(exp,'b'.repeat(64),'2026-11-24T01:00:00Z');

test('Track 1 & 2 preserve per-note pan with separate channels for simultaneous pitched notes',()=>{
  for(const slot of [1,2]){
    const track={song,notes:[n(60,0,480,-100),n(64,0,480,100),n(67,0,480,0)]};
    const exported=prepareSymphonyCSVTrackExport(session(slot,track),slot);
    assert.equal(exported.panEncoded,true);
    const ev=decode(exported.bytes);
    assert.deepEqual(ons(ev).map(x=>x.tick),[0,0,0]);
    assert.equal(new Set(ons(ev).map(x=>x.ch)).size,3);
    assert.ok(ons(ev).every(x=>x.ch!==9));
    assert.deepEqual(pans(ev).map(x=>x.b),[0,127,64]);
    assert.deepEqual(offs(ev).map(x=>x.tick),[480,480,480]);
    assert.match(receipt(exported),/Pitched stereo: per-note CSV pan/);
  }
});

test('Tracks 1–2 with blank pan retain their original MIDI bytes',()=>{
  for(const slot of [1,2]){
    const pitched={song,notes:[n(60,0,480,null),n(67,240,240,undefined)]};
    const exp=prepareSymphonyCSVTrackExport(session(slot,pitched),slot);
    const old=encodeSymphonyCSVTrackMidi({...exp.settings,
      trackName:exp.title,channel:0,notes:pitched.notes.map(({panPosition,...rest})=>rest)});
    assert.deepEqual(exp.bytes,old);
    assert.equal(exp.panEncoded,false);
    assert.deepEqual(pans(decode(exp.bytes)),[]);
  }
});

test('Tracks 5 & 6 simultaneously panned drum hits retain sample keys, note times and CC10',()=>{
  for(const slot of [5,6]){
    const drum={song,kitName:slot===5?'Acoustic Drums':'Electronic Drums',studioEvents:[
      dt(36,0,240,-100),dt(42,0,240,100),dt(38,0,240,0),dt(49,240,120,-40)
    ]};
    const exp=prepareSymphonyCSVTrackExport(session(slot,drum),slot);
    assert.equal(exp.panEncoded,true);
    const ev=decode(exp.bytes),noteOns=ons(ev),noteOffs=offs(ev),cc=pans(ev);
    assert.deepEqual(noteOns.map(x=>x.a),[36,42,38,49]);
    assert.deepEqual(noteOns.map(x=>x.tick),[0,0,0,240]);
    assert.deepEqual(noteOffs.map(x=>x.tick),[240,240,240,360]);
    assert.equal(new Set(noteOns.slice(0,3).map(x=>x.ch)).size,3);
    assert.ok(noteOns.some(x=>x.ch===9),'GM channel 10 must be preferred');
    assert.ok(noteOns.some(x=>x.ch!==9),'overlaps require extra channels');
    assert.deepEqual(cc.map(x=>x.b),[0,127,64,38]);
    for(const on of noteOns){
      assert.ok(noteOffs.some(off=>off.a===on.a&&off.ch===on.ch));
      assert.ok(ev.slice(0,ev.indexOf(on)).some(e=>e.type===176&&e.tick<=on.tick&&e.ch===on.ch));
    }
    const text=receipt(exp);
    assert.match(text,/Drums stereo: per-hit CSV pan/);
    assert.match(text,/General MIDI only guarantees percussion sounds on channel 10/);
    assert.match(text,/multichannel drum sampler/);
  }
});

test('Tracks 5 & 6 with blank pan retain channel 10 without any CC10',()=>{
  for(const slot of [5,6]){
    const drum={song,studioEvents:[dt(36,0,240,null),dt(42,0,240,undefined)]};
    const exp=prepareSymphonyCSVTrackExport(session(slot,drum),slot);
    assert.equal(exp.panEncoded,false);
    assert.deepEqual(ons(decode(exp.bytes)).map(x=>x.ch),[9,9]);
    assert.deepEqual(pans(decode(exp.bytes)),[]);
    assert.match(receipt(exp),/MIDI channel 10 is used/);
    assert.doesNotMatch(receipt(exp),/Drums stereo: per-hit/);
  }
});

test('Sequential drum hit panning reuses channel 10 and preserves per-event direction',()=>{
  const drum={song,studioEvents:[dt(42,0,120,-100),dt(42,120,120,100),dt(42,240,120,-100)]};
  const ev=decode(prepareSymphonyCSVTrackExport(session(5,drum),5).bytes);
  assert.deepEqual(ons(ev).map(x=>x.tick),[0,120,240]);
  assert.deepEqual(ons(ev).map(x=>x.ch),[9,9,9]);
  assert.deepEqual(pans(ev).map(x=>[x.tick,x.b]),[[0,0],[120,127],[240,0]]);
});

test('Drum events mixing explicit and blank pans keep blank hits centered',()=>{
  const drum={song,studioEvents:[dt(36,0,240,-100),dt(42,0,240,null)]};
  const ev=decode(prepareSymphonyCSVTrackExport(session(5,drum),5).bytes);
  assert.deepEqual(ons(ev).map(x=>x.ch),[9,0]);
  assert.deepEqual(pans(ev).map(x=>x.b),[0]);
});

test('Drum pan rejects invalid values and independent-channel overflow',()=>{
  assert.throws(()=>prepareSymphonyCSVTrackExport(session(5,{song,studioEvents:[dt(36,0,240,100.5)]}),5),/panPosition/);
  const tooMany={song,studioEvents:Array.from({length:17},(_,i)=>dt(35+i,0,240,-100+i*12))};
  assert.throws(()=>prepareSymphonyCSVTrackExport(session(6,tooMany),6),/exceeds 16 simultaneously independent channels/);
});
