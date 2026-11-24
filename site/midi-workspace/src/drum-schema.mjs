import { midiCc10ToPanPosition } from './midi-core.mjs';

// SymphonyCSV LABS Drum MIDI converter. Authoritative 21-column RC1 schema.
// GM-to-musical-surface mapping is intentionally conservative: unsupported note
// numbers are errors, never discarded or silently mapped to the wrong sound.
export const DRUM_COLUMNS = Object.freeze([
  'composition_title','composition_total_measures','composition_end_tick',
  'tempo_bpm','time_signature','ticks_per_quarter','event_id','event_type',
  'measure','absolute_tick','onset_tick_in_measure','timing_offset_ms',
  'duration_ticks','surface_id','articulation','variant_id','velocity',
  'note_off_velocity','note_off_method','choke_group','Pan_Position'
]);

// [surface ID, articulation]. Exact target-kit mapping is checked at runtime
// against the bundled profiles; these MIDI numbers are GM conventions only.
export const GM_SURFACES = Object.freeze({
  35:['kick_1',''], 36:['kick_1',''],
  38:['snare_1',''], 40:['snare_1',''], 39:['clap_1',''],
  41:['tom_3',''], 43:['tom_3',''], 45:['tom_2',''], 47:['tom_2',''],
  48:['tom_1',''], 50:['tom_1',''],
  42:['hihat_1','closed'],44:['hihat_1','closed'],46:['hihat_1','open'],
  49:['crash_1',''],57:['crash_1',''],51:['ride_1',''],59:['ride_1','']
});

const ensure = (value,message)=>{if(!value)throw Error(message);};
const esc = value=>{const s=String(value??'');return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};

// Small RFC-4180 compatible CSV parser for bundled mapping profiles (and only
// the fields we need); supports quoted commas, CRLF, and quoted newlines.
export function readProfile(csvText) {
  ensure(typeof csvText==='string' && csvText.trim(),'Empty bundled drum profile.');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<csvText.length;i++){
    const c=csvText[i];
    if(quoted){if(c==='"'){if(csvText[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;}
    else if(c==='"'){ensure(cell.length===0,'Malformed drum-kit CSV quote.');quoted=true;}
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\r'||c==='\n'){if(c==='\r'&&csvText[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  ensure(!quoted,'Unclosed drum-kit CSV quote.');
  if(row.length || cell){row.push(cell);rows.push(row);}
  const fields=['SurfaceId','Articulation','VariantId','MidiNote','Bank','Program','IsDefault'];
  ensure(rows[0]?.join('|')===fields.join('|'),'Bundled drum-kit profile columns do not match Studio.');
  ensure(rows.length>1,'Bundled drum-kit profile has no rows.');
  const out=rows.slice(1).filter(r=>r.some(x=>x!=='')).map(r=>{
    ensure(r.length===fields.length,'Invalid bundled drum-kit profile row.');
    return Object.fromEntries(fields.map((name,i)=>[name,r[i]]));
  });
  ensure(out.length>0,'Empty bundled drum-kit mapping.');
  return out;
}

export function mapDrumNote(pitch,profile) {
  const surface=GM_SURFACES[pitch];
  ensure(surface,`GM percussion note ${pitch} is not mapped to a SymphonyCSV drum surface. Conversion blocked; no notes were dropped.`);
  const [id,articulation]=surface;
  const candidates=profile.filter(p=>p.SurfaceId===id && p.Articulation===articulation);
  // The existing Studio mapper resolves a blank variant_id against exactly
  // one IsDefault row, even when that default has a nonempty VariantId.
  const defaults=candidates.filter(p=>['true','1','yes'].includes(String(p.IsDefault).trim().toLowerCase()));
  const chosen=defaults.length===1?defaults[0]:
    (candidates.length===1&&candidates[0].VariantId===''?candidates[0]:null);
  ensure(chosen,`The selected drum kit cannot uniquely play MIDI note ${pitch} (${id}${articulation?'/'+articulation:''}). Conversion blocked.`);
  const midiNumber=Number(chosen.MidiNote);
  ensure(Number.isInteger(midiNumber)&&midiNumber>=0&&midiNumber<=127,
    `Invalid MIDI mapping for ${id}.`);
  return {surface_id:id,articulation,variant_id:''};
}

export function convertDrumsToCsv(prepared, profile) {
  ensure(prepared?.kind==='drum','Expected a Track 5 or Track 6 drum conversion.');
  ensure(Array.isArray(profile)&&profile.length>0,'Bundled drum-kit profile is required.');
  const {midi,source,title,totalMeasures,endTick,tempoBpm,target}=prepared;
  ensure(source.length>0,'No drum hits selected.');
  const byMeasure=new Map();
  const rows=[];
  let next=0;
  const meta={composition_title:title,composition_total_measures:totalMeasures,
    composition_end_tick:endTick,tempo_bpm:Number(tempoBpm.toFixed(6)).toString(),
    time_signature:midi.timeSignature,ticks_per_quarter:midi.ppq};
  for(const n of source){
    const part=mapDrumNote(n.pitch,profile);
    const measure=Math.floor(n.startTick/midi.ticksPerMeasure)+1;
    ensure(measure>=1&&measure<=totalMeasures,'Drum event lies outside composition.');
    // Preserve source tick position and note attack velocity, but intentionally
    // leave advanced note-off and choke semantics blank for LABS compatibility.
    const duration=n.durationTicks;
    ensure(Number.isSafeInteger(duration)&&duration>0&&n.endTick<=endTick,'Drum note duration exceeds final barline.');
    const record={...meta,event_id:`T${target}H${String(++next).padStart(6,'0')}`,
      event_type:'hit',measure,absolute_tick:n.startTick,
      onset_tick_in_measure:n.startTick%midi.ticksPerMeasure,
      duration_ticks:duration,...part,velocity:n.velocity,
      Pan_Position:n.panCc10===null?'':midiCc10ToPanPosition(n.panCc10)};
    rows.push(record);byMeasure.set(measure,true);
  }
  for(let measure=1;measure<=totalMeasures;measure++){
    if(byMeasure.has(measure))continue;
    rows.push({...meta,event_id:`T${target}R${String(measure).padStart(6,'0')}`,
      event_type:'rest',measure,absolute_tick:(measure-1)*midi.ticksPerMeasure,
      onset_tick_in_measure:0,duration_ticks:midi.ticksPerMeasure});
  }
  rows.sort((a,b)=>a.absolute_tick-b.absolute_tick || (a.event_type==='rest'?-1:1) || a.event_id.localeCompare(b.event_id));
  ensure(rows.length===source.length+totalMeasures-byMeasure.size,'Drum row count mismatch.');
  return '\uFEFF'+DRUM_COLUMNS.join(',')+'\r\n'+rows.map(r=>DRUM_COLUMNS.map(k=>esc(r[k])).join(',')).join('\r\n')+'\r\n';
}
