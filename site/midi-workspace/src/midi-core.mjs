// MIDI Import Stage D. Pure deterministic code, no network access or dependencies.
// Inspect SMF 0/1, prepare one source track/channel OR a whole-file single-instrument piano reduction.
import { PITCHED_COLUMNS, REFERENCE_FIELDS } from './pitched-schema.mjs';

const need = (ok, reason) => { if (!ok) throw new Error(reason); };
// MIDI CC10 has 64 as centre and asymmetric 0..64 / 64..127 intervals.
// SymphonyCSV pan is a whole integer in [-100, 100]; blank means no CC10.
export const midiCc10ToPanPosition = value => {
  need(Number.isInteger(value) && value >= 0 && value <= 127, 'Invalid MIDI CC10 pan value.');
  return value <= 64 ? Math.round((value - 64) * 100 / 64)
    : Math.round((value - 64) * 100 / 63);
};
const u16 = (data, p) => data[p] * 256 + data[p+1];
const u32 = (data, p) => ((data[p] * 0x1000000) + (data[p+1] << 16) + (data[p+2] << 8) + data[p+3]) >>> 0;
const ascii = (data, p, n) => Array.from(data.subarray(p,p+n), x=>String.fromCharCode(x)).join('');
const textDecode = data => new TextDecoder('utf-8',{fatal:false}).decode(data);
const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const pitchName = pitch => names[pitch%12]+(Math.floor(pitch/12)-1);
// LABS default: deterministic staff placement, no user-facing setting.
// Middle C belongs to the upper staff by convention; this does NOT infer piano hands.
export function automaticPianoStaff(midiPitch){
  need(Number.isInteger(midiPitch) && midiPitch>=0 && midiPitch<=127,'Invalid MIDI pitch for staff placement.');
  return midiPitch>=60
    ? {staff:'Upper staff',clef:'Treble',clef_sign:'G',clef_line:'2'}
    : {staff:'Lower staff',clef:'Bass',clef_sign:'F',clef_line:'4'};
}
export const gmDrumName = Object.freeze({35:'Acoustic Bass Drum',36:'Bass Drum',37:'Side Stick',38:'Acoustic Snare',39:'Hand Clap',40:'Electric Snare',41:'Low Floor Tom',42:'Closed Hi-Hat',43:'High Floor Tom',44:'Pedal Hi-Hat',45:'Low Tom',46:'Open Hi-Hat',47:'Low-Mid Tom',48:'Hi-Mid Tom',49:'Crash Cymbal 1',50:'High Tom',51:'Ride Cymbal 1',52:'Chinese Cymbal',53:'Ride Bell',54:'Tambourine',55:'Splash Cymbal',56:'Cowbell',57:'Crash Cymbal 2',58:'Vibraslap',59:'Ride Cymbal 2',60:'High Bongo',61:'Low Bongo',62:'Mute High Conga',63:'Open High Conga',64:'Low Conga',65:'High Timbale',66:'Low Timbale'});

export function readMidi(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  need(data.length >= 14 && ascii(data,0,4)==='MThd','Not a Standard MIDI File (MThd header missing).');
  const headerSize=u32(data,4);
  need(headerSize >= 6 && 8+headerSize<=data.length,'Invalid MIDI header length.');
  const format=u16(data,8), trackCount=u16(data,10), division=u16(data,12);
  need(format===0 || format===1,'LABS Stage A supports MIDI Format 0 and 1 only.');
  need(trackCount>=1 && trackCount<=256,'Invalid MIDI track count.');
  need(format!==0 || trackCount===1,'Format 0 must contain exactly one track.');
  need(!(division&0x8000) && division>0,'SMPTE time division is not yet supported.');
  const ppq=division,tracks=[],notes=[],tempos=[],meters=[],keys=[],warnings=[],pairErrors=[],panEvents=[];
  let cursor=8+headerSize;
  for(let track=0;track<trackCount;track++){
    need(cursor+8<=data.length && ascii(data,cursor,4)==='MTrk',`MIDI track ${track} header missing.`);
    const size=u32(data,cursor+4),end=cursor+8+size;
    need(end<=data.length,`MIDI track ${track} extends past end of file.`);
    let pos=cursor+8,tick=0,running=0,trackName='',endTrackTick=null,eventOrder=0;
    const pending=new Map(), programs=Array(16).fill(0), channels=new Set(), trackNotes=[];
    const readV=()=>{let n=0;for(let i=0;i<4;i++){
      need(pos<end,'Truncated MIDI variable-length quantity.');const c=data[pos++];n=n*128+(c&127);
      if(!(c&128))return n;}
      throw new Error('MIDI variable-length quantity exceeds four bytes.');};
    const consume=n=>{need(n>=0 && pos+n<=end,'Truncated MIDI event.');const part=data.subarray(pos,pos+n);pos+=n;return part;};
    while(pos<end){
      tick+=readV();need(Number.isSafeInteger(tick),'MIDI tick exceeds safe integer range.');
      const order=eventOrder++;
      need(pos<end,'Missing MIDI status/event.');
      let status=data[pos],firstData=null;
      if(status&0x80){pos++;}else{need(running>=0x80 && running<0xF0,'Invalid MIDI running status.');status=running;firstData=data[pos++];}
      if(status===0xFF){
        running=0;const kind=consume(1)[0],len=readV(),payload=consume(len);
        if(kind===0x03)trackName=textDecode(payload).slice(0,120);
        else if(kind===0x2F){endTrackTick=tick;need(pos===end,'Trailing data after MIDI end-of-track event.');}
        else if(kind===0x51){need(len===3,'Malformed MIDI tempo event.');const us=payload[0]*65536+payload[1]*256+payload[2];need(us>0,'Invalid tempo event.');tempos.push({track,tick,microsecondsPerQuarter:us,bpm:60000000/us});}
        else if(kind===0x58){need(len===4,'Malformed MIDI time signature event.');const denominator=2**payload[1];need(payload[0]>0 && denominator<=128,'Invalid time signature.');meters.push({track,tick,numerator:payload[0],denominator});}
        else if(kind===0x59 && len===2)keys.push({track,tick,fifths:(payload[0]<<24)>>24,mode:payload[1]===0?'major':'minor'});
        continue;
      }
      if(status===0xF0||status===0xF7){running=0;consume(readV());warnings.push(`Track ${track}: SysEx event is not converted.`);continue;}
      need(status>=0x80 && status<=0xEF,'Unsupported system MIDI event.');
      running=status;
      const type=status&0xF0, channel=status&0x0F;
      channels.add(channel);
      const length=(type===0xC0||type===0xD0)?1:2;
      const args=firstData===null?consume(length):[firstData,...consume(length-1)];
      need(args.every(n=>n>=0 && n<=127),'Invalid MIDI channel event data byte.');
      const [a,b]=args;
      if(type===0xC0)programs[channel]=a;
      if(type===0x90 && b>0){
        const key=channel+':'+a,queue=pending.get(key)||[];
        queue.push({track,channel,pitch:a,velocity:b,startTick:tick,startOrder:order,program:programs[channel]});pending.set(key,queue);
      }else if(type===0x80 || (type===0x90 && b===0)){
        const key=channel+':'+a,queue=pending.get(key);
        if(!queue?.length){const e=`Track ${track}, channel ${channel+1}, tick ${tick}: unmatched note-off ${a}.`;warnings.push(e);pairErrors.push(e);continue;}
        // FIFO for overlapping same-note MIDI pairs. The source MIDI is ambiguous in that case.
        const begin=queue.shift();
        if(queue.length) warnings.push(`Track ${track}, channel ${channel+1}: overlapping same-pitch note ${a}; paired FIFO.`);
        if(tick<=begin.startTick){const e=`Track ${track}, tick ${tick}: zero-length note ${a} excluded.`;warnings.push(e);pairErrors.push(e);continue;}
        trackNotes.push({...begin,endTick:tick,durationTicks:tick-begin.startTick,noteOffMethod:type===0x80?'note_off':'note_on_velocity_zero',noteOffVelocity:b});
      }else if(type===0xB0 || type===0xE0 || type===0xA0 || type===0xD0){
        // Channel CC10 is sampled at each note-on, not copied as continuous automation.
        // CC121 (Reset All Controllers) restores the MIDI centre position.
        if(type===0xB0 && (a===10 || a===121))
          panEvents.push({track,tick,order,channel,value:a===121?64:b});
        else if(type===0xB0 || type===0xE0)
          warnings.push(`Track ${track}: unsupported MIDI controller or pitch-bend is not converted.`);
      }
    }
    for(const queue of pending.values())for(const n of queue){const e=`Track ${track}, channel ${n.channel+1}: unterminated note ${n.pitch} at tick ${n.startTick}.`;warnings.push(e);pairErrors.push(e);}
    need(pos===end,`MIDI track ${track} boundary mismatch.`);
    notes.push(...trackNotes.map(n=>({...n,trackName})));
    tracks.push({index:track,name:trackName||`MIDI Track ${track+1}`,channelNumbers:[...channels].sort((a,b)=>a-b),endTick:endTrackTick??tick,noteCount:trackNotes.length});
    cursor=end;
  }
  need(cursor===data.length,'Extra bytes after MIDI tracks.');
  // MIDI channel controllers are shared across tracks. Resolve their state in
  // chronological order, not in the order the file's MTrk chunks were parsed.
  // When simultaneous events occur on different tracks, use source track order
  // as a deterministic tie-breaker; within each track, preserve event order.
  const timeline=[...panEvents.map(e=>({...e,kind:'pan'})),
    ...notes.map(note=>({kind:'note',tick:note.startTick,track:note.track,
      order:note.startOrder,channel:note.channel,note}))]
    .sort((a,b)=>a.tick-b.tick||a.track-b.track||a.order-b.order);
  const channelPan=Array(16).fill(null);
  const priorNoteEnd=Array(16).fill(-Infinity), thisTickNoteEnd=Array(16).fill(-Infinity);
  let previousTick=-1, panChangedDuringNote=false;
  for(const event of timeline){
    if(event.tick!==previousTick){
      for(let c=0;c<16;c++)priorNoteEnd[c]=Math.max(priorNoteEnd[c],thisTickNoteEnd[c]);
      thisTickNoteEnd.fill(-Infinity);
      previousTick=event.tick;
    }
    if(event.kind==='pan'){
      if(priorNoteEnd[event.channel]>event.tick)panChangedDuringNote=true;
      channelPan[event.channel]=event.value;
    }else{
      event.note.panCc10=channelPan[event.channel];
      thisTickNoteEnd[event.channel]=Math.max(thisTickNoteEnd[event.channel],event.note.endTick);
    }
  }
  if(panChangedDuringNote)
    warnings.push('MIDI pan changes during sustained notes cannot be reproduced: CC10 is sampled at each note onset.');
  const unique=(items,cb)=>items.reduce((a,x)=>a.some(y=>cb(x)===cb(y))?a:[...a,x],[]);
  const uniqueTempos=unique(tempos,t=>Math.round(t.microsecondsPerQuarter));
  const uniqueMeters=unique(meters,t=>t.numerator+'/'+t.denominator);
  const tempoChanges=uniqueTempos.length>1 || tempos.some(t=>t.tick!==0);
  const meterChanges=uniqueMeters.length>1 || meters.some(t=>t.tick!==0);
  if(tempoChanges)warnings.push('Tempo changes or nonzero-tick tempo metadata: Stage A conversion blocked.');
  if(meterChanges)warnings.push('Time signature changes or nonzero-tick meter metadata: Stage A conversion blocked.');
  const tempo=tempos.find(t=>t.tick===0)??null,meter=meters.find(t=>t.tick===0)??null;
  const numerator=meter?.numerator??4,denominator=meter?.denominator??4;
  const ticksPerMeasure=ppq*numerator*4/denominator;
  need(Number.isSafeInteger(ticksPerMeasure) && ticksPerMeasure>0,'Noninteger MIDI ticks per full measure are not supported in Stage A.');
  const lastNoteEndTick=notes.reduce((m,n)=>Math.max(m,n.endTick),0);
  const lastTrackEndTick=tracks.reduce((m,t)=>Math.max(m,t.endTick),0);
  const noteMeasures=Math.max(1,Math.ceil(lastNoteEndTick/ticksPerMeasure));
  const trackMeasures=Math.max(1,Math.ceil(lastTrackEndTick/ticksPerMeasure));
  const suggestedMeasures=Math.max(noteMeasures,trackMeasures);
  if(lastTrackEndTick>lastNoteEndTick)
    warnings.push('MIDI end-of-track extends beyond the final note. Review whether the trailing silence is intentional.');
  const parts=tracks.flatMap(t=>t.channelNumbers.map(channel=>{
    const events=notes.filter(n=>n.track===t.index&&n.channel===channel);
    return {key:`${t.index}:${channel}`,track:t.index,channel,displayName:`${t.name} · Ch ${channel+1}${channel===9?' (GM percussion)':''}`,noteCount:events.length,
      likelyDrums:channel===9,lowestPitch:events.length?Math.min(...events.map(n=>n.pitch)):null,highestPitch:events.length?Math.max(...events.map(n=>n.pitch)):null};
  })).filter(p=>p.noteCount>0);
  return {format,ppq,trackCount,tracks,parts,notes,warnings:[...new Set(warnings)],tempoBpm:tempo?.bpm??120,tempoSource:tempo?'MIDI':'Assumed default',tempoChanges,meterChanges,
    timeSignature:`${numerator}/${denominator}`,meterSource:meter?'MIDI':'Assumed default',numerator,denominator,ticksPerMeasure,lastNoteEndTick,lastTrackEndTick,suggestedMeasures,
    keySignature:keys.find(k=>k.tick===0)??null,noteMeasures,trackMeasures,notePairErrors:pairErrors.length};
}

export function prepareMidi(midi,{partKey,tempoBpm=midi.tempoBpm,totalMeasures=midi.suggestedMeasures,title='Untitled MIDI Import',target=1}={}){
  need(!midi.tempoChanges && !midi.meterChanges,'Variable tempo/meter MIDI requires a later import engine; conversion blocked.');
  need(!midi.notePairErrors,'MIDI note-on/off mismatches require repair before conversion.');
  need(midi.denominator===4,'Stage A pitched CSV counts currently support quarter-note beat signatures only; preserve non-quarter meter MIDI for the Rust/WASM importer.');
  const allParts = partKey === '__ALL_NOTES__';
  const percussionOnly = partKey === '__ALL_PERCUSSION__';
  const part = allParts
    ? {key:partKey,track:null,channel:null,displayName:'All MIDI notes (single-instrument reduction)',noteCount:midi.notes.length,likelyDrums:false}
    : percussionOnly
      ? {key:partKey,track:null,channel:9,displayName:'All GM percussion channel 10 notes',noteCount:midi.notes.filter(n=>n.channel===9).length,likelyDrums:true}
      : midi.parts.find(p=>p.key===partKey);
  need(part,'Select a MIDI part containing notes.');
  need(!(allParts && [5,6].includes(target)),'All-channel Piano Roll pitched reduction is not suitable for drums. Select the percussion channel or an explicit source part.');
  need(!(percussionOnly && [1,2].includes(target)),'Percussion-only selection is for Drum Track 5/6.');
  const bpm=Number(tempoBpm),count=Number(totalMeasures);
  need(Number.isFinite(bpm)&&bpm>=1&&bpm<=1000,'Tempo must be between 1 and 1000 BPM.');
  need(Number.isInteger(count)&&count>=1&&count<=100000,'Total composition measures must be a positive whole number.');
  need(Number.isInteger(target) && [1,2,5,6].includes(target),'Select Pitched 1/2 or Drum 5/6.');
  need(([1,2].includes(target)) !== ([5,6].includes(target)),'Invalid destination.');
  const source=(allParts ? [...midi.notes] : percussionOnly ? midi.notes.filter(n=>n.channel===9) : midi.notes.filter(n=>n.track===part.track&&n.channel===part.channel))
    .sort((a,b)=>a.startTick-b.startTick||a.track-b.track||a.channel-b.channel||a.pitch-b.pitch||a.endTick-b.endTick);
  need(source.length>0,'The selected MIDI source contains no notes.');
  const endTick=count*midi.ticksPerMeasure;
  need(Number.isSafeInteger(endTick),'Composition tick boundary exceeds safe integer range.');
  need(source.every(n=>n.endTick<=endTick),`Source MIDI contains a note ending after the declared measure ${count} barline.`);
  const exactDurationSec=count*midi.numerator*4/midi.denominator*60/bpm;
  return {midi,part,source,tempoBpm:bpm,totalMeasures:count,title:String(title).trim()||'Untitled MIDI Import',target,endTick,durationSeconds:exactDurationSec,kind:[5,6].includes(target)?'drum':'pitched',
    sourceEndTick:source.reduce((m,n)=>Math.max(m,n.endTick),0)};
}
const number = v=> Number.isInteger(v)?String(v):Number(v.toFixed(6)).toString();
const fmt = seconds=> {const m=Math.floor(seconds/60), s=Math.floor(seconds%60);return `${m}m ${String(s).padStart(2,'0')}s`;};
export const durationText = seconds => `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
export const preciseDurationText = seconds => `${durationText(seconds)}.${String(Math.round((seconds%1)*1000)).padStart(3,'0')}`;
const quoted=v=> {const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
const ordinal=['One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve'];
function countAloud(n,ppq){const beat=Math.floor(n/ppq);const step=(n%ppq)/ppq;const name=ordinal[beat]||String(beat+1);
 if(Math.abs(step)<1e-6)return name;
 if(Math.abs(step-.25)<1e-6)return `${name} e`;
 if(Math.abs(step-.5)<1e-6)return `${name} and`;
 if(Math.abs(step-.75)<1e-6)return `${name} a`;
 return `${name} + ${number(step)}`;}
export function convertPitchedToCsv(prepared){
  need(prepared.kind==='pitched','Drum conversion requires the approved drum event schema; it is not a pitched CSV.');
  const {midi,part,source,tempoBpm,totalMeasures,title,endTick,durationSeconds}=prepared;
  const rows=source.map((n,index)=>{
    const offset=n.startTick % midi.ticksPerMeasure,measure=Math.floor(n.startTick/midi.ticksPerMeasure)+1;
    const startMs=Math.round(n.startTick*60000/(tempoBpm*midi.ppq));
    const endMs=Math.round(n.endTick*60000/(tempoBpm*midi.ppq));
    const row=Object.fromEntries(PITCHED_COLUMNS.map(k=>[k,'']));
    const staffFields=automaticPianoStaff(n.pitch);
    Object.assign(row,REFERENCE_FIELDS,{
      ...staffFields,measure,count_aloud:countAloud(offset,midi.ppq),running_time:fmt(startMs/1000),pitch_label:pitchName(n.pitch),
      duration_beats:number(n.durationTicks/midi.ppq),duration_ms:endMs-startMs,velocity:n.velocity,tempo_bpm:number(tempoBpm),time_signature:midi.timeSignature,
      instrument:prepared.target===1?'Piano':'Strings',event_type:'note',event_id:`N${String(index+1).padStart(5,'0')}`,onset_beat_in_measure:number(1+offset/midi.ppq),onset_ms:startMs,end_ms:endMs,midi_pitch:n.pitch,
      pitch_spelling_source:'MIDI pitch (enharmonic spelling unavailable)',
      Pan_Position:n.panCc10 == null ? '' : midiCc10ToPanPosition(n.panCc10),
      // A Piano Roll reduction is a NEW single-voice performance, not an orchestration-preserving MIDI import.
      // Studio owns SoundFont choice. Do not carry source channel / instrument program through to playback or export.
      midi_file_format:midi.format,ticks_per_quarter:midi.ppq,midi_track:0,
      midi_track_name:`Studio Track ${prepared.target} Piano Roll`,midi_channel:0,midi_program:0,
      program_change_emit:'No',program_source:'Studio Piano Roll default; source programs discarded',
      note_off_method:n.noteOffMethod,note_off_velocity:n.noteOffVelocity,
      absolute_tick:n.startTick,onset_tick_in_measure:offset,duration_ticks:n.durationTicks,end_tick:n.endTick,
      tempo_us_per_quarter:Math.round(60000000/tempoBpm),tempo_beat_unit:'quarter',pitch_octave_convention:'C4=60',
      tick_rounding_policy:'retain source MIDI ticks; milliseconds rounded to nearest',same_tick_event_order:'note_off_before_note_on',
      time_signature_num:midi.numerator,time_signature_den:midi.denominator,controller_event_policy:'MIDI CC10/CC121 sampled at note onset into Pan_Position; other controllers not imported',
      composition_title:title,composition_total_measures:totalMeasures,composition_end_tick:endTick,composition_duration:fmt(durationSeconds),
      source_note_data:part.key==='__ALL_NOTES__'
        ? 'All MIDI note events merged into one Piano Roll part, with original instrument/channel/program assignments discarded. Includes MIDI percussion as pitched notes. Original tempo/meter can be reviewed or overridden. Unsupported controllers are not converted.'
        : 'Selected MIDI note events revoiced to one Studio Piano Roll instrument; original MIDI instrument, channel and program assignments discarded. Review warnings for unsupported events.',
      source_instrument:'Studio track default SoundFont; original MIDI instrument assignments discarded'
    });
    if(midi.keySignature){row.key_signature_fifths=midi.keySignature.fifths;row.key_signature_mode=midi.keySignature.mode;}
    return row;
  });
  return '\uFEFF'+PITCHED_COLUMNS.join(',')+'\r\n'+rows.map(row=>PITCHED_COLUMNS.map(c=>quoted(row[c])).join(',')).join('\r\n')+(rows.length?'\r\n':'');
}
export function drumEventPreview(prepared){
  need(prepared.kind==='drum','Select a drum track destination.');
  return prepared.source.map(n=>({tick:n.startTick,endTick:n.endTick,measure:Math.floor(n.startTick/prepared.midi.ticksPerMeasure)+1,
    midiPitch:n.pitch,gmSurface:gmDrumName[n.pitch]||'Unmapped percussion note',velocity:n.velocity,channel:n.channel+1,panPosition:n.panCc10 == null?'':midiCc10ToPanPosition(n.panCc10)}));
}
