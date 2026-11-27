/* SymphonyCSV Studio — portable Projects JSON contract (P003).
 * Pure data validation. No ZIP I/O, SoundFont loading, project commit, or
 * mutations of a loaded song. Missing JSON is an accepted special case.
 * Source filenames/track roles come from P002 inventory, not this JSON.
 */
export const PROJECT_SCHEMA_VERSION=1;
export const PROJECT_MANIFEST_MAX_CHARS=64_000;
export const PROJECT_DEFAULT_PADDING_MS=2000; // SymphonyCSV_Performance_v01.js
export const PROJECT_DEFAULT_DRUM_PERCENT=100;
export const PROJECT_DEFAULT_GLOBAL_EFFECTS=Object.freeze({
  reverb:true, delay:false, chorus:false, compressor:true,
  reverbMix:25, delayMix:18, delayFeedback:24, chorusMix:20,
  chorusRateHz:0.7,chorusDepthMs:3,delayTimeMs:320,
  compressorThreshold:-20,compressorRatio:3,compressorAttackMs:8,compressorReleaseMs:180,
  masterEqEnabled:false,masterEq80Db:0,masterEq250Db:0,masterEq1000Db:0,
  masterEq4000Db:0,masterEq12000Db:0,masterOutputGainDb:0
});
const EFFECT_RANGES={reverbMix:[0,100],delayMix:[0,100],delayFeedback:[0,75],
  chorusMix:[0,100],chorusRateHz:[0.1,3],chorusDepthMs:[0,8],
  delayTimeMs:[80,900],compressorThreshold:[-48,0],
  compressorRatio:[1,12],compressorAttackMs:[0,50],compressorReleaseMs:[20,500],
  masterEq80Db:[-12,12],masterEq250Db:[-12,12],masterEq1000Db:[-12,12],
  masterEq4000Db:[-12,12],masterEq12000Db:[-12,12],masterOutputGainDb:[-12,12]};
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const check=(ok,message)=>{if(!ok)throw Error(message);};
function keysOnly(o,allowed,where){
  check(isObject(o),`Invalid ${where}.`);
  for(const k of Object.keys(o))check(allowed.includes(k),`Unsupported ${where} field: ${k}.`);
}
function numberIn(v,min,max,name,integer=false){
  check(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(!integer||Number.isSafeInteger(v)),
    `Invalid ${name}.`);
  return v;
}
function globalEffects(input){
  if(input===undefined)return {...PROJECT_DEFAULT_GLOBAL_EFFECTS};
  keysOnly(input,Object.keys(PROJECT_DEFAULT_GLOBAL_EFFECTS),'global effects');
  const out={};
  const newOptional=new Set(['compressorRatio','compressorAttackMs','compressorReleaseMs','chorusRateHz','chorusDepthMs','delayTimeMs',
    'masterEqEnabled','masterEq80Db','masterEq250Db','masterEq1000Db','masterEq4000Db','masterEq12000Db','masterOutputGainDb']);
  for(const k of Object.keys(PROJECT_DEFAULT_GLOBAL_EFFECTS)){
    if(!Object.hasOwn(input,k)&&newOptional.has(k)){
      out[k]=PROJECT_DEFAULT_GLOBAL_EFFECTS[k];
      continue;
    }
    check(Object.hasOwn(input,k),`Missing global effect: ${k}.`);
    if(typeof PROJECT_DEFAULT_GLOBAL_EFFECTS[k]==='boolean'){
      check(typeof input[k]==='boolean',`Invalid global effect: ${k}.`);
      out[k]=input[k];
    } else {
      const [min,max]=EFFECT_RANGES[k];
      out[k]=numberIn(input[k],min,max,k);
    }
  }
  return out;
}
function name(v,where,limit=200){
  check(typeof v==='string'&&v.trim().length>0&&v.length<=limit&&
    !/[\x00-\x1f]/.test(v),`Invalid ${where}.`);
  return v;
}
function safeFilename(v,extension){
  check(typeof v==='string'&&v.length<=255&&v.length>extension.length+1&&
    !/[\\/\x00-\x1f]/.test(v)&&v.toLowerCase().endsWith(extension),
    'Invalid SoundFont filename.');
  return v;
}
function soundfont(value){
  if(value===null)return null; // app default; caller must resolve it at import time
  keysOnly(value,['origin','filename','preset','embedded_file','sha256'],'SoundFont');
  check(value.origin==='library'||value.origin==='custom','Unsupported SoundFont origin.');
  const filename=value.filename;
  check(typeof filename==='string'&&/\.(sf2|sfz)$/i.test(filename),'Invalid SoundFont format.');
  safeFilename(filename,filename.slice(filename.lastIndexOf('.')).toLowerCase());
  let preset=null;
  if(value.preset!==null&&value.preset!==undefined){
    keysOnly(value.preset,['bank','program'],'SoundFont preset');
    preset={bank:numberIn(value.preset.bank,0,16383,'SoundFont bank',true),
      program:numberIn(value.preset.program,0,127,'SoundFont program',true)};
  }
  const embedded=value.embedded_file;
  const digest=value.sha256;
  check((embedded===undefined)===(digest===undefined),
    'Embedded SoundFont path and SHA-256 must appear together.');
  if(embedded!==undefined){
    check(typeof digest==='string'&&/^[a-f0-9]{64}$/.test(digest),
      'Invalid embedded SoundFont SHA-256.');
    check(embedded===`SoundFonts/${digest}.sf2`,
      'Embedded SoundFont must use its canonical SHA-256 path.');
  }
  return {...(embedded===undefined?{}:{embedded_file:embedded,sha256:digest}),
    origin:value.origin,filename,preset};
}
function effects(items){
  check(Array.isArray(items)&&items.length<=32,'Invalid track effects chain.');
  const ids=new Set();
  return items.map((fx,i)=>{
    keysOnly(fx,['instance_id','effect_id','enabled','parameters'],`effect ${i}`);
    const instance_id=name(fx.instance_id,'effect instance identifier',80);
    check(/^[A-Za-z0-9_-]+$/.test(instance_id),'Invalid effect instance identifier.');
    check(!ids.has(instance_id),'Duplicate effect instance identifier.');
    ids.add(instance_id);
    const effect_id=name(fx.effect_id,'effect identifier',32);
    check(/^FX(?:00[1-9]|01[0-9]|020)$/.test(effect_id),'Unsupported effect identifier.');
    check(typeof fx.enabled==='boolean','Invalid effect enabled state.');
    check(isObject(fx.parameters),'Invalid effect parameters.');
    check(Object.keys(fx.parameters).length<=32,'Too many effect parameters.');
    const parameters={};
    for(const [k,v] of Object.entries(fx.parameters)){
      check(/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(k)&&!['constructor','prototype','__proto__'].includes(k),
        'Invalid effect parameter name.');
      check(typeof v==='boolean'||(typeof v==='string'&&v.length<=256)||
        (typeof v==='number'&&Number.isFinite(v)),'Invalid effect parameter value.');
      parameters[k]=v;
    }
    return {instance_id,effect_id,enabled:fx.enabled,parameters};
  });
}
function validatedSources(inventory){
  check(inventory&&Array.isArray(inventory.sources)&&inventory.sources.length>=1&&
    inventory.sources.length<=12,'Missing authoritative track inventory.');
  const slots=new Set();
  for(const s of inventory.sources){
    check(Number.isInteger(s?.slot)&&s.slot>=1&&s.slot<=12&&
      typeof s.filename==='string'&&
      new RegExp(`^Track_0*${s.slot}\\.${s.slot<=6?'csv':'wav'}$`,'i').test(s.filename),
      'Invalid authoritative track inventory.');
    check(!slots.has(s.slot),'Duplicate authoritative track slot.');
    slots.add(s.slot);
  }
  return inventory.sources;
}
function defaultTrack(s){
  const musical=s.slot<=6;
  const base={slot:s.slot,type:musical?(s.slot<=2?'pitched':s.slot<=4?'tab':'drums'):'audio',
    source_file:s.filename,volume_percent:100,muted:false};
  if(musical){base.soundfont=null;base.effects=[];}
  else{base.onset_ms=0;base.pan_position=0;base.effects=[];}
  return base;
}
export function defaultProjectManifest(inventory,projectName='Untitled Project'){
  const sources=validatedSources(inventory);
  const hasWav=sources.some(s=>s.slot>=7);
  return {schema_version:PROJECT_SCHEMA_VERSION,project:{name:name(projectName,'project name')},
    playback:{natural_decay_padding_ms:PROJECT_DEFAULT_PADDING_MS,
      master_drum_volume_percent:PROJECT_DEFAULT_DRUM_PERCENT,
      global_effects:globalEffects(),reverb_sends_percent:[25,0,0,0,0,0],
      chorus_sends_percent:[0,0,0,0,0,0],delay_sends_percent:[0,0,0,0,0,0],
      parallel_send_mutes:{chorus:Array(6).fill(false),delay:Array(6).fill(false),reverb:Array(6).fill(false)},
      ...(hasWav?{audio_sends_percent:{chorus:[0,0],delay:[0,0],reverb:[0,0]},
        audio_send_mutes:{chorus:[false,false],delay:[false,false],reverb:[false,false]}}:{})},
    tracks:sources.map(defaultTrack).sort((a,b)=>a.slot-b.slot)};
}
/** Pass null ONLY if the manifest file is absent, not if it is unreadable. */
export function readProjectManifest(jsonTextOrNull,inventory,defaultName='Untitled Project'){
  const sources=validatedSources(inventory);
  if(jsonTextOrNull===null)return {manifest:defaultProjectManifest(inventory,defaultName),usedDefaults:true};
  check(typeof jsonTextOrNull==='string'&&jsonTextOrNull.length>0&&
    jsonTextOrNull.length<=PROJECT_MANIFEST_MAX_CHARS,'Invalid or oversized project JSON.');
  let input;
  try{input=JSON.parse(jsonTextOrNull);}catch{throw Error('Malformed project JSON.');}
  keysOnly(input,['schema_version','project','playback','tracks'],'project manifest');
  check(input.schema_version===PROJECT_SCHEMA_VERSION,'Unsupported project schema version.');
  keysOnly(input.project,['name','companion_audio'],'project identity');
  const project={name:name(input.project.name,'project name')};
  if(input.project.companion_audio!==undefined){
    const c=input.project.companion_audio;
    keysOnly(c,['package_id','filename','sha256','slots'],'companion audio declaration');
    check(typeof c.package_id==='string'&&/^[a-f0-9-]{36}$/i.test(c.package_id),
      'Invalid companion package identifier.');
    check(typeof c.filename==='string'&&c.filename.length>4&&c.filename.length<=180&&
      /\.zip$/i.test(c.filename)&&!/[\\/\x00-\x1f]/.test(c.filename),
      'Invalid companion filename.');
    check(typeof c.sha256==='string'&&/^[a-f0-9]{64}$/.test(c.sha256),
      'Invalid companion ZIP checksum.');
    check(Array.isArray(c.slots)&&c.slots.length>=1&&c.slots.length<=2&&
      c.slots.every(x=>x===7||x===8)&&new Set(c.slots).size===c.slots.length&&
      c.slots.every((x,i)=>i===0||x>c.slots[i-1]),
      'Invalid companion WAV slots.');
    project.companion_audio={package_id:c.package_id,filename:c.filename,
      sha256:c.sha256,slots:[...c.slots]};
  }
  keysOnly(input.playback,['natural_decay_padding_ms','master_drum_volume_percent','global_effects','reverb_sends_percent',
    'chorus_sends_percent','delay_sends_percent','parallel_send_mutes',
    'audio_sends_percent','audio_send_mutes'],'playback');
  const loadedGlobal=globalEffects(input.playback.global_effects);
  const rawSends=input.playback.reverb_sends_percent;
  check(rawSends===undefined||(Array.isArray(rawSends)&&rawSends.length===6&&
    rawSends.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=100)),
    'Invalid six-track reverb sends.');
  const sends=rawSends?[...rawSends]:[loadedGlobal.reverbMix,0,0,0,0,0];
  check(sends[0]===loadedGlobal.reverbMix,'Track 1 reverb send mismatch.');
  const validatedSends=(key)=>{
    const values=input.playback[key];
    check(values===undefined||(Array.isArray(values)&&values.length===6&&
      values.every(v=>Number.isSafeInteger(v)&&v>=0&&v<=100)),
      `Invalid six-track ${key.replace('_sends_percent','')} sends.`);
    return values===undefined?[0,0,0,0,0,0]:[...values];
  };
  const chorusSends=validatedSends('chorus_sends_percent');
  const delaySends=validatedSends('delay_sends_percent');
  const muteFields=['chorus','delay','reverb'];
  const mutes=input.playback.parallel_send_mutes;
  if(mutes!==undefined){
    keysOnly(mutes,muteFields,'parallel send mutes');
    check(muteFields.every(name=>Array.isArray(mutes[name])&&mutes[name].length===6&&
      mutes[name].every(flag=>typeof flag==='boolean')),'Invalid parallel send mutes.');
  }
  const parallelSendMutes=Object.fromEntries(muteFields.map(name=>
    [name,mutes===undefined?Array(6).fill(false):[...mutes[name]]]));
  const hasWav=sources.some(s=>s.slot>=7);
  function audioEffectFields(field,validator,defaultValue){
    const raw=input.playback[field];
    if(!hasWav){check(raw===undefined,'Unexpected WAV settings without an audio track.');return undefined;}
    if(raw===undefined)return Object.fromEntries(muteFields.map(k=>[k,[defaultValue,defaultValue]]));
    keysOnly(raw,muteFields,field);
    const result={};
    for(const key of muteFields){
      check(Array.isArray(raw[key])&&raw[key].length===2&&raw[key].every(validator),
        'Invalid '+field+' '+key+'.');
      result[key]=[...raw[key]];
    }
    return result;
  }
  const audioSends=audioEffectFields('audio_sends_percent',v=>Number.isSafeInteger(v)&&v>=0&&v<=100,0);
  const audioMutes=audioEffectFields('audio_send_mutes',v=>typeof v==='boolean',false);
  const playback={
    natural_decay_padding_ms:numberIn(input.playback.natural_decay_padding_ms,0,60000,'natural decay padding',true),
    master_drum_volume_percent:numberIn(input.playback.master_drum_volume_percent??100,0,400,'master drum volume',true),
    global_effects:loadedGlobal,
    reverb_sends_percent:sends,
    chorus_sends_percent:chorusSends,
    delay_sends_percent:delaySends,
    parallel_send_mutes:parallelSendMutes,
    ...(hasWav?{audio_sends_percent:audioSends,audio_send_mutes:audioMutes}:{})
  };
  check(Array.isArray(input.tracks)&&input.tracks.length===sources.length,
    'Project manifest must list every authoritative track exactly once.');
  const sourceBySlot=new Map(sources.map(s=>[s.slot,s.filename]));
  const seen=new Set();
  const tracks=input.tracks.map(t=>{
    check(isObject(t)&&Number.isInteger(t.slot)&&sourceBySlot.has(t.slot),'Invalid project track slot.');
    check(!seen.has(t.slot),'Duplicate project track slot.');seen.add(t.slot);
    const musical=t.slot<=6;
    const expected=defaultTrack({slot:t.slot,filename:sourceBySlot.get(t.slot)});
    keysOnly(t,musical?['slot','type','source_file','volume_percent','muted','soundfont','effects',
      ...(t.slot<=2?['staff_mutes']:[] )]:
      ['slot','type','source_file','original_filename','volume_percent','muted','onset_ms','pan_position','effects'],`track ${t.slot}`);
    check(t.type===expected.type,`Wrong type for Track ${t.slot}.`);
    check(t.source_file===expected.source_file,`Track ${t.slot} source filename mismatch.`);
    const result={slot:t.slot,type:t.type,source_file:t.source_file,
      volume_percent:numberIn(t.volume_percent,0,100,`Track ${t.slot} volume`,true),
      muted:t.muted};
    check(typeof result.muted==='boolean',`Invalid Track ${t.slot} mute state.`);
    if(musical){
      check(Object.hasOwn(t,'soundfont'),`Missing Track ${t.slot} SoundFont setting.`);
      result.soundfont=soundfont(t.soundfont);
      result.effects=effects(t.effects);
      if(t.slot<=2&&t.staff_mutes!==undefined){
        // Old ZIPs held a single whole-track mute flag. New ZIPs preserve
        // independent upper/lower staff stompboxes without losing either.
        const flags=t.staff_mutes??{upper:t.muted,lower:t.muted};
        keysOnly(flags,['upper','lower'],`Track ${t.slot} staff mutes`);
        check(typeof flags.upper==='boolean'&&typeof flags.lower==='boolean',
          `Invalid Track ${t.slot} staff mute state.`);
        check(t.muted===(flags.upper&&flags.lower),
          `Track ${t.slot} mute conflicts with its staff mute states.`);
        result.staff_mutes={upper:flags.upper,lower:flags.lower};
      }
    }else{
      result.onset_ms=numberIn(t.onset_ms,0,2147483647,`Track ${t.slot} audio onset`,true);
      result.pan_position=numberIn(t.pan_position??0,-100,100,`Track ${t.slot} pan`,true);
      if(t.original_filename!==undefined){
        check(typeof t.original_filename==='string'&&t.original_filename.length>4&&
          t.original_filename.length<=255&&/\.wav$/i.test(t.original_filename)&&
          !/[\\/\x00-\x1f]/.test(t.original_filename),
          `Invalid Track ${t.slot} original WAV filename.`);
        result.original_filename=t.original_filename;
      }
      result.effects=effects(t.effects);
    }
    return result;
  }).sort((a,b)=>a.slot-b.slot);
  check(tracks.length===sourceBySlot.size&&tracks.every(t=>sourceBySlot.has(t.slot)),
    'Project track coverage mismatch.');
  return {manifest:{schema_version:PROJECT_SCHEMA_VERSION,project,playback,tracks},usedDefaults:false};
}
