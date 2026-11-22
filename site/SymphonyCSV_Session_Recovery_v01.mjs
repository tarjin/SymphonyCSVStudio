/* P069 — read-only browser-session staging, guarded one-handoff recovery.
 * The WAV mixer, musical player, Projects ZIP and IndexedDB schema remain owned
 * by their existing modules. No live composition changes during async staging.
 */
import {verifySession} from './SymphonyCSV_Session_Store_v02.mjs';
import {soundFontAssignmentsWithBytes} from './SymphonyCSV_SoundFont_Assets_v01.mjs';
import {prepareProjectTrackWithBrowserWasm} from './SymphonyCSV_Project_Browser_Stage_v01.mjs';
import {defaultProjectManifest,PROJECT_DEFAULT_GLOBAL_EFFECTS} from './SymphonyCSV_Project_Manifest_v01.mjs';

const KEYS=['chorus','delay','reverb'];
const requireValue=(ok,message)=>{if(!ok)throw Error(message);};

// A complete capture cannot silently skip either loaded WAV track. These are
// the original in-memory bytes, never decoded/re-encoded AudioBuffer samples.
export function captureWavSessionClips(runtime){
  requireValue(typeof runtime?.captureForZIP==='function'&&typeof runtime?.getTracks==='function',
    'WAV session bridge unavailable. Session not replaced.');
  const state=runtime.getTracks();
  const original=runtime.captureForZIP();
  requireValue(Array.isArray(state)&&state.length===2&&Array.isArray(original),
    'WAV session inventory is unavailable. Session not replaced.');
  const loaded=state.filter(t=>t?.buffer||t?.bytes);
  requireValue(loaded.length===original.length,'A loaded WAV track is missing from the session capture.');
  const seen=new Set();
  return original.map(item=>{
    const t=state.find(x=>x.slot===item.slot);
    requireValue([7,8].includes(item.slot)&&!seen.has(item.slot)&&t?.bytes&&t?.buffer,
      'Saved WAV track is incomplete or duplicated.');
    seen.add(item.slot);
    requireValue(item.bytes instanceof Uint8Array&&item.bytes.byteLength>0&&
      item.bytes.byteLength===t.bytes.byteLength&&item.bytes===t.bytes,
      `Track ${item.slot} original WAV bytes are unavailable.`);
    requireValue(typeof item.filename==='string'&&/\.wav$/i.test(item.filename),
      `Track ${item.slot} original WAV filename is invalid.`);
    requireValue(Number.isSafeInteger(item.onset_ms)&&item.onset_ms>=0,
      `Track ${item.slot} WAV onset is invalid.`);
    for(const name of KEYS){
      requireValue(Number.isSafeInteger(item.sends?.[name])&&
        item.sends[name]>=0&&item.sends[name]<=100&&
        typeof item.sendMutes?.[name]==='boolean',
      `Track ${item.slot} ${name} send is missing.`);
    }
    requireValue(Number.isSafeInteger(item.volume_percent)&&item.volume_percent>=0&&
      item.volume_percent<=100&&typeof item.muted==='boolean'&&
      Number.isSafeInteger(item.pan_position)&&item.pan_position>=-100&&item.pan_position<=100,
      `Track ${item.slot} mixer settings are missing.`);
    return {slot:item.slot,filename:item.filename,blob:new Blob([item.bytes],{type:'audio/wav'}),
      onsetMs:item.onset_ms,volume_percent:item.volume_percent,muted:item.muted,
      pan_position:item.pan_position,sends:{...item.sends},sendMutes:{...item.sendMutes}};
  });
}

function manifestFromSaved(session){
  const s=session.settings;
  const sourceNames=session.tracks.map(t=>({slot:t.slot,filename:`Track_${t.slot}.csv`}));
  const manifest=defaultProjectManifest({sources:sourceNames},
    session.song.title.slice(0,200));
  const playback=manifest.playback;
  playback.global_effects={...PROJECT_DEFAULT_GLOBAL_EFFECTS,...s.effects};
  if(s.reverbSends!==undefined)playback.reverb_sends_percent=[...s.reverbSends];
  else playback.reverb_sends_percent=[playback.global_effects.reverbMix,0,0,0,0,0];
  if(s.chorusSends!==undefined)playback.chorus_sends_percent=[...s.chorusSends];
  if(s.delaySends!==undefined)playback.delay_sends_percent=[...s.delaySends];
  if(s.parallelSendMutes!==undefined)playback.parallel_send_mutes=s.parallelSendMutes;
  if(s.performance){
    if(s.performance.natural_decay_padding_ms!==undefined)
      playback.natural_decay_padding_ms=s.performance.natural_decay_padding_ms;
    if(s.performance.master_drum_volume_percent!==undefined)
      playback.master_drum_volume_percent=s.performance.master_drum_volume_percent;
  }
  for(const t of manifest.tracks){
    const level=s.trackVolumes?.[t.slot-1];
    requireValue(Number.isFinite(level)&&level>=0&&level<=1,
      `Saved Track ${t.slot} volume is invalid.`);
    t.volume_percent=Math.max(0,Math.min(100,Math.round(level*100)));
    if(t.slot<=2){
      const flags=t.slot===1?s.staffMuted:s.stringsStaffMuted;
      requireValue(typeof flags?.['Upper staff']==='boolean'&&
        typeof flags?.['Lower staff']==='boolean',
        `Saved Track ${t.slot} staff mute settings are invalid.`);
      t.staff_mutes={upper:flags['Upper staff'],lower:flags['Lower staff']};
      t.muted=t.staff_mutes.upper&&t.staff_mutes.lower;
    }
  }
  return manifest;
}

function wavManifest(session){
  const audio=session.audioClips;
  const pair=(key,field,defaultValue)=>Object.fromEntries(KEYS.map(name=>[
    name,[7,8].map(slot=>audio.find(a=>a.slot===slot)?.[field]?.[name]??defaultValue)
  ]));
  return {tracks:audio.map(c=>({slot:c.slot,source_file:c.filename,
    original_filename:c.filename,onset_ms:c.onsetMs,
    volume_percent:c.volume_percent,muted:c.muted,pan_position:c.pan_position})),
    playback:{audio_sends_percent:pair('sends','sends',0),
      audio_send_mutes:pair('sendMutes','sendMutes',false)}};
}

export async function stageBrowserSessionRecovery(raw,{host=globalThis,prepareTrack=prepareProjectTrackWithBrowserWasm,
  preflightCSV=host.SymphonyCSVPreflightRecoveryFromCSV}={}){
  const session=await verifySession(raw);
  requireValue(typeof preflightCSV==='function','Rust/WASM recovery preflight unavailable.');
  const bridge=host.SymphonyCSVImport;
  requireValue(typeof bridge?.compareSong==='function',
    'Composition compatibility bridge unavailable.');
  const preflightSong=await preflightCSV(session.tracks);
  requireValue(preflightSong&&['title','totalMeasures','tempoBpm','timeSignature','ticksPerQuarter']
    .every(k=>preflightSong[k]===session.song[k]),
  'Saved musical metadata does not match the validated CSV composition.');
  const tracks=Array(6).fill(null),filenames=Array(6).fill(null);
  const originals=[];
  let referenceSong=null;
  for(const item of session.tracks){
    // The Projects staging API uses canonical ZIP filenames. The browser
    // session retains the original user CSV names in the final live snapshot.
    const canonical={slot:item.slot,filename:`Track_${item.slot}.csv`,csvText:item.csvText};
    const result=await prepareTrack(canonical,referenceSong,{host});
    requireValue(result?.song&&result?.imported,
      `Track ${item.slot} did not produce validated musical staging data.`);
    requireValue(bridge.compareSong(referenceSong,result.song)?.ok===true&&
      bridge.compareSong(preflightSong,result.song)?.ok===true,
      `Staged Track ${item.slot} differs from the validated composition.`);
    if(!referenceSong)referenceSong=result.song;
    tracks[item.slot-1]=result.imported;
    filenames[item.slot-1]=item.filename;
    originals.push({slot:item.slot,filename:item.filename,csvText:item.csvText});
  }
  const manifest=manifestFromSaved(session);
  const playerSnapshot={song:referenceSong,tracks,filenames,sources:originals,manifest};
  const fonts=host.SymphonyCSVSoundFontRuntime;
  if(session.soundFonts){
    requireValue(typeof fonts?.stage==='function'&&typeof fonts?.commit==='function',
      'SoundFont recovery bridge unavailable.');
    playerSnapshot.stagedSoundFonts=fonts.stage(
      await soundFontAssignmentsWithBytes(session.soundFonts));
  }
  const wav=host.SymphonyCSVWAVRuntime;
  requireValue(typeof wav?.prepareRestore==='function'&&
    typeof wav?.commitRestore==='function'&&typeof wav?.captureRestorable==='function',
    'WAV recovery bridge unavailable. Current composition unchanged.');
  requireValue(session.audioClips.every(c=>[7,8].includes(c.slot)&&/\.wav$/i.test(c.filename)),
    'Saved audio contains an unsupported track or format for this Studio.');
  const wavSources=await Promise.all(session.audioClips.map(async c=>({
    slot:c.slot,filename:c.filename,bytes:new Uint8Array(await c.blob.arrayBuffer())
  })));
  playerSnapshot.stagedWAV=await wav.prepareRestore(wavSources,wavManifest(session),referenceSong);
  return {session,snapshot:playerSnapshot};
}

export function commitStagedBrowserSession(staged,{host=globalThis}={}){
  const {session:record,snapshot}=staged??{};
  const live=host.SymphonyCSVImportSession;
  const player=host.SymphonyCSVProjectPlayerRuntime;
  const sources=host.SymphonyCSVProjectSourcesRuntime;
  const settings=host.SymphonyCSVSessionRuntime;
  const fonts=host.SymphonyCSVSoundFontRuntime;
  const wav=host.SymphonyCSVWAVRuntime;
  requireValue(record&&snapshot?.stagedWAV&&live&&Array.isArray(live.tracks)&&
    typeof player?.prepare==='function'&&typeof player?.commit==='function'&&
    typeof player?.rollback==='function'&&typeof player?.capture==='function'&&
    typeof sources?.capture==='function'&&typeof sources?.replace==='function'&&
    typeof settings?.apply==='function'&&typeof wav?.commitRestore==='function'&&
    typeof wav?.captureRestorable==='function',
    'Atomic browser recovery bridge unavailable. Current composition unchanged.');
  if(snapshot.stagedSoundFonts)requireValue(typeof fonts?.commit==='function',
    'SoundFont recovery commit unavailable.');
  // The player pre-validates its entire replacement while the live song still
  // belongs to the user. No asynchronous work occurs beyond this boundary.
  const prepared=player.prepare(snapshot);
  const old={song:live.song,tracks:live.tracks,filenames:live.filenames,
    sources:sources.capture(),player:player.capture(),wav:wav.captureRestorable()};
  try{
    live.song=snapshot.song;live.tracks=snapshot.tracks;live.filenames=snapshot.filenames;
    sources.replace(snapshot.sources,snapshot.filenames);
    player.commit(prepared);
    settings.apply(record.settings);
    wav.commitRestore(snapshot.stagedWAV);
    // Commit SoundFonts last: this existing bridge already rolls back its own
    // changes if a preset or instrument presentation fails.
    if(snapshot.stagedSoundFonts)fonts.commit(snapshot.stagedSoundFonts);
  }catch(error){
    const problems=[];
    live.song=old.song;live.tracks=old.tracks;live.filenames=old.filenames;
    try{sources.replace(old.sources.filter(Boolean),old.filenames);}catch(e){problems.push(e);}
    try{player.rollback(old.player);}catch(e){problems.push(e);}
    try{wav.commitRestore(old.wav);}catch(e){problems.push(e);}
    if(problems.length)throw Error('Browser recovery rollback encountered an error: '+
      problems.map(e=>e.message).join('; ')+'; original error: '+error.message);
    throw Error('Browser recovery rolled back: '+(error?.message||String(error)));
  }
  try{host.dispatchEvent?.(new CustomEvent('symphonycsv:session-changed',
    {detail:{browserRecovered:true,appliedToPlayer:true}}));}
  catch(error){host.console?.warn?.('Session recovered; UI event failed',error);}
  return {title:record.song.title,tracks:record.tracks.length,audioClips:record.audioClips.length};
}
