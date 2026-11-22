/* Projects Save — user-initiated download only, separate from IndexedDB
 * Save to Browser / Recover Session. No localStorage or session mutations.
 */
import {defaultProjectManifest} from './SymphonyCSV_Project_Manifest_v01.mjs';
import {inspectWavBytes} from './SymphonyCSV_WAV_Core_v01.mjs';
import {writeAudioCompanionZip,projectCompanionSha256} from './SymphonyCSV_Project_Audio_Companion_v01.mjs';
import {chooseProjectSaveMode} from './SymphonyCSV_Project_Dialogs_v01.mjs';
import {writeSymphonyCSVProjectZip} from './SymphonyCSV_Project_ZIP_Writer_v01.mjs';
import {prepareSymphonyCSVTrackExport} from './SymphonyCSV_MIDI_Export_Core_v01.mjs';
import {buildProjectDetailsText} from './SymphonyCSV_Project_Details_v01.mjs';
import {prepareSoundFontsForSession} from './SymphonyCSV_SoundFont_Ready_v01.mjs';
import {captureSoundFontAssets,verifySoundFontAssets} from './SymphonyCSV_SoundFont_Assets_v01.mjs';

const safeName=name=>String(name||'Untitled Project').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,120)||'Untitled Project';

// One logical export receipt. It only reports after every required ZIP download
// has been requested, never merely because ZIP bytes were prepared. Reporting
// is best-effort and cannot influence any export or modify musical data.
export function createProjectExportReceipt(host, requiredParts=['music']) {
  const pending=new Set(requiredParts);
  if(!pending.size || [...pending].some(part=>!['music','audio'].includes(part)) ||
     pending.size!==requiredParts.length)
    throw Error('Invalid Project export receipt parts.');
  let sent=false;
  return part=>{
    if(sent || !pending.has(part))return false;
    pending.delete(part);
    if(pending.size)return false;
    sent=true;
    try {
      if(typeof host?.dispatchEvent==='function') {
        const EventConstructor=host.Event||globalThis.Event;
        if(typeof EventConstructor==='function')
          host.dispatchEvent(new EventConstructor('symphonycsv:project-export-complete'));
      }
    }catch { /* Telemetry must never affect the export. */ }
    return true;
  };
}


// Keep the Project ZIP's pre-mute nominal volume separate from browser-session
// recovery, while preserving all P060 parallel-send mute arrays unchanged.
export function captureProjectRuntime(host=globalThis){
  const runtime=host.SymphonyCSVSessionRuntime?.capture?.();
  if(!runtime||typeof runtime!=='object')
    throw Error('Studio runtime settings are not ready for Project ZIP export.');
  const stored=host.SymphonyCSVProjectPlayerRuntime?.capture?.()?.projectMutedLevels;
  return {...runtime,projectMutedLevels:stored??runtime.projectMutedLevels};
}

export function prepareMusicalProjectZIP({session,sources,runtime,soundFonts=null,audioTracks=[],companionAudio=null}){
  if(!session?.song||!Array.isArray(session.tracks)||session.tracks.length!==6)
    throw Error('A validated musical composition is required.');
  if(!Array.isArray(sources)||!sources.length)
    throw Error('At least one authoritative musical CSV source is required.');
  const used=session.tracks.map((x,i)=>x?i+1:null).filter(Boolean);
  if(used.length!==sources.length)throw Error('Missing authoritative source for a populated musical track.');
  const bySlot=new Map();
  for(const s of sources){
    if(!s||!Number.isInteger(s.slot)||!used.includes(s.slot)||bySlot.has(s.slot)||
      typeof s.csvText!=='string'||!s.csvText.length||!String(s.filename).toLowerCase().endsWith('.csv'))
      throw Error('Missing or conflicting authoritative musical CSV.');
    bySlot.set(s.slot,s);
  }
  if(!Array.isArray(audioTracks)||audioTracks.length>2)throw Error('Invalid WAV track inventory.');
  const audioBySlot=new Map();
  for(const a of audioTracks){
    if(!a||![7,8].includes(a.slot)||audioBySlot.has(a.slot)||!(a.bytes instanceof Uint8Array))
      throw Error('Duplicate or invalid WAV track.');
    inspectWavBytes(a.bytes);
    audioBySlot.set(a.slot,a);
  }
  const inventory={sources:[
    ...used.map(slot=>({slot,filename:`Track_${slot}.csv`,type:'musical'})),
    ...[...audioBySlot.keys()].sort((a,b)=>a-b).map(slot=>({slot,filename:`Track_${slot}.wav`,type:'audio'}))]};
  const manifest=defaultProjectManifest(inventory,safeName(session.song.title));
  if(companionAudio)manifest.project.companion_audio=structuredClone(companionAudio);
  const performance=runtime?.performance||{};
  const effects=runtime?.effects||{};
  manifest.playback.natural_decay_padding_ms=performance.natural_decay_padding_ms??2000;
  manifest.playback.master_drum_volume_percent=performance.master_drum_volume_percent??100;
  const hasChorus=Array.isArray(runtime?.chorusSends);
  const hasDelay=Array.isArray(runtime?.delaySends);
  manifest.playback.global_effects={...manifest.playback.global_effects,...effects,
    chorus:hasChorus?Boolean(effects.chorus):false,
    delay:hasDelay?Boolean(effects.delay):false}; // legacy runtimes remain dry
  const sends=runtime?.reverbSends ?? [manifest.playback.global_effects.reverbMix,0,0,0,0,0];
  if(!Array.isArray(sends)||sends.length!==6||!sends.every(x=>
    Number.isSafeInteger(x)&&x>=0&&x<=100)||
    sends[0]!==manifest.playback.global_effects.reverbMix)
    throw Error('Invalid shared reverb send settings.');
  manifest.playback.reverb_sends_percent=[...sends];
  for(const [name,has] of [['chorus',hasChorus],['delay',hasDelay]]){
    const values=has?runtime[name+'Sends']:[0,0,0,0,0,0];
    if(values.length!==6||!values.every(x=>Number.isSafeInteger(x)&&x>=0&&x<=100))
      throw Error('Invalid '+name+' shared send settings.');
    manifest.playback[name+'_sends_percent']=[...values];
    // Legacy mix fields are retained for backward compatibility only.
    manifest.playback.global_effects[name+'Mix']=values[0];
  }
  const muteFields=['chorus','delay','reverb'];
  const flags=runtime?.parallelSendMutes;
  if(flags!==undefined&&(!flags||typeof flags!=='object'||Array.isArray(flags)||
    Object.keys(flags).length!==3||Object.keys(flags).some(k=>!muteFields.includes(k))))
    throw Error('Invalid parallel send mutes.');
  for(const name of muteFields){
    const mutes=flags===undefined?Array(6).fill(false):flags[name];
    if(!Array.isArray(mutes)||mutes.length!==6||
      !mutes.every(flag=>typeof flag==='boolean'))
      throw Error('Invalid '+name+' send mutes.');
    manifest.playback.parallel_send_mutes[name]=[...mutes];
  }
  const volumes=runtime?.trackVolumes||Array(6).fill(1);
  if(!Array.isArray(volumes)||volumes.length!==6)
    throw Error('Six musical track volume settings are required.');
  for(const track of manifest.tracks){
    const i=track.slot-1;
    const level=volumes[i];
    if(!Number.isFinite(level)||level<0||level>1)
      throw Error(`Track ${track.slot} volume is invalid.`);
    let percent=Math.round(level*100);
    // Restored whole-track mute is enacted using a zero slider. Retain the
    // saved nominal level so a second ZIP export does not silently erase it.
    const prior=runtime?.projectMutedLevels?.[i];
    if(level===0&&prior?.muted===true&&Number.isSafeInteger(prior.volume_percent)&&
       prior.volume_percent>=0&&prior.volume_percent<=100){
      percent=prior.volume_percent;
      track.muted=true;
    }
    track.volume_percent=percent;
    if(i===0||i===1){
      const flags=i===0?runtime?.staffMuted:runtime?.stringsStaffMuted;
      if(flags!==undefined&&
         (typeof flags?.['Lower staff']!=='boolean'||typeof flags?.['Upper staff']!=='boolean'))
        throw Error(`Track ${track.slot} staff mute settings are invalid.`);
      const upper=flags?.['Upper staff']??track.muted;
      const lower=flags?.['Lower staff']??track.muted;
      track.staff_mutes={upper,lower};
      track.muted=upper&&lower;
    }else if(runtime?.trackMuted!==undefined){
      if(!Array.isArray(runtime.trackMuted)||runtime.trackMuted.length!==6||
         runtime.trackMuted.some(v=>typeof v!=='boolean'))
        throw Error('Six track mute settings are invalid.');
      track.muted=runtime.trackMuted[i];
    }
  }
  const files=[];
  if(audioBySlot.size){
    const fx=['chorus','delay','reverb'];
    for(const slot of audioBySlot.keys()){
      const a=audioBySlot.get(slot),t=manifest.tracks.find(t=>t.slot===slot);
      if(!t)throw Error('WAV track is missing its manifest slot.');
      if(!Number.isSafeInteger(a.onset_ms)||a.onset_ms<0||
         !Number.isFinite(runtime?.songDurationMs)||a.onset_ms>=runtime.songDurationMs)
        throw Error('WAV onset must precede the musical song end.');
      if(!Number.isSafeInteger(a.volume_percent)||a.volume_percent<0||a.volume_percent>100||
         !Number.isSafeInteger(a.pan_position)||a.pan_position< -100||a.pan_position>100||
         typeof a.muted!=='boolean')throw Error('Invalid WAV mix settings.');
      Object.assign(t,{onset_ms:a.onset_ms,volume_percent:a.volume_percent,muted:a.muted,
        pan_position:a.pan_position,original_filename:a.filename});
    }
    for(const name of fx){
      manifest.playback.audio_sends_percent[name]=[7,8].map(slot=>
        audioBySlot.get(slot)?.sends?.[name]??0);
      manifest.playback.audio_send_mutes[name]=[7,8].map(slot=>
        audioBySlot.get(slot)?.sendMutes?.[name]??false);
    }
    for(const a of audioBySlot.values())files.push({name:`Track_${a.slot}.wav`,data:a.bytes});
  }
  if(soundFonts){
    const assets=new Map(soundFonts.assets.map(item=>[item.sha256,item]));
    const assignments=new Map(soundFonts.assignments.map(item=>[item.slot,item]));
    if(assignments.size!==used.length||assets.size>6||
      used.some(slot=>!assignments.has(slot)))
      throw Error('Project ZIP is missing a SoundFont assignment for a loaded musical track.');
    for(const t of manifest.tracks){
      const assignment=assignments.get(t.slot);
      const asset=assets.get(assignment.sha256);
      if(!asset||!(asset.blob instanceof Blob)||!Number.isInteger(assignment.bank)||
        !Number.isInteger(assignment.program))
        throw Error(`Track ${t.slot} embedded SoundFont is invalid.`);
      t.soundfont={origin:'custom',filename:assignment.filename,
        preset:{bank:assignment.bank,program:assignment.program},
        embedded_file:`SoundFonts/${assignment.sha256}.sf2`,sha256:assignment.sha256};
    }
    for(const asset of assets.values()){
      // The UI already verifies hashes, headers and size before this sync writer.
      // Byte extraction is performed in advance, not by this synchronous method.
      if(!(asset.bytes instanceof Uint8Array))
        throw Error('SoundFont ZIP bytes were not prepared for export.');
      files.push({name:`SoundFonts/${asset.sha256}.sf2`,data:asset.bytes});
    }
  }
  for(const slot of used){
    const source=bySlot.get(slot);
    if(!source)throw Error(`Track ${slot} authoritative source is unavailable.`);
    // MIDI generation derives exclusively from the already-validated Studio data.
    const midi=prepareSymphonyCSVTrackExport(session,slot);
    files.push({name:`Track_${slot}.csv`,data:source.csvText});
    files.push({name:`Track_${slot}.mid`,data:midi.bytes});
  }
  files.push({name:'SymphonyCSV_Project.json',data:JSON.stringify(manifest,null,2)+'\n'});
  files.push({name:'SymphonyCSV_Project_Details.txt',
    data:buildProjectDetailsText({manifest,song:session.song})});
  return {bytes:writeSymphonyCSVProjectZip(files),manifest,sourceCount:used.length};
}
function requestZipDownload(root,bytes,filename){
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));
  const a=root.createElement('a');a.href=url;a.download=filename;a.hidden=true;
  root.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

export function initializeProjectSaveUI({root=document,host=window}={}){
  const button=root.getElementById('scsv-projects-save');
  const status=root.getElementById('scsv-projects-status');
  if(!button||!status)return false;
  if(button.dataset.projectSaveReady==='yes')return true;
  button.dataset.projectSaveReady='yes';
  let busy=false;
  const downloads=root.createElement('div');downloads.id='scsv-projects-companion-downloads';
  downloads.className='scsv-projects-companion-downloads';downloads.hidden=true;
  status.after(downloads);
  function offerDownloads(items,onDownload){
    downloads.replaceChildren();downloads.hidden=false;
    for(const item of items){
      const btn=root.createElement('button');btn.type='button';btn.className='soft-button';
      btn.textContent='Download '+item.label+' ZIP';
      btn.addEventListener('click',()=>{
        requestZipDownload(root,item.bytes,item.filename);
        onDownload?.(item.label.toLowerCase());
        status.dataset.state='info';
        status.textContent=item.label+' ZIP: browser download requested. Please verify the file in Downloads.';
      });
      downloads.append(btn);
    }
  }
  const refresh=()=>{
    const session=host.SymphonyCSVImportSession;
    const count=session?.tracks?.filter(Boolean).length||0;
    button.disabled=busy||!count;
    button.textContent=busy?'Preparing Project ZIP…':'Save Project ZIP';
    button.title=count?`Save ${count} musical track(s), their MIDI, and project settings`:
      'Import at least one musical Track 1–6 first';
  };
  button.addEventListener('click',async()=>{
    if(busy)return;
    busy=true;refresh();downloads.hidden=true;downloads.replaceChildren();
    try{
      const session=host.SymphonyCSVImportSession;
      const sources=host.SymphonyCSVSessionSources?.getAccepted?.();
      const used=session?.tracks?.map((t,i)=>t?i+1:null).filter(Boolean)||[];
      const audioTracks=host.SymphonyCSVWAVRuntime?.captureForZIP?.()??[];
      const audioBytes=audioTracks.reduce((n,t)=>n+t.bytes.byteLength,0);
      let mode='music';
      if(audioTracks.length){
        const answer=await chooseProjectSaveMode({root,title:session.song?.title||'Current composition',
          sourceCount:audioTracks.length,bytes:audioBytes});
        if(answer.action==='cancel'){
          status.dataset.state='warning';
          status.textContent='Save Project cancelled. Your loaded composition and recordings are unchanged.';
          return;
        }
        mode=answer.action;
      }
      const bridge=host.SymphonyCSVSoundFontRuntime;
      status.dataset.state='working';
      status.textContent='Saving Project · Preparing and verifying embedded SoundFonts…';
      await prepareSoundFontsForSession(used,bridge);
      const bundle=await verifySoundFontAssets(
        await captureSoundFontAssets(bridge.capture(used),used),{requiredSlots:used});
      const assets=[];
      for(const asset of bundle.assets)assets.push({...asset,
        bytes:new Uint8Array(await asset.blob.arrayBuffer())});
      const runtime={...captureProjectRuntime(host),
        songDurationMs:host.SymphonyCSVWAVBridge?.compositionEndMs?.()};
      const basename=safeName(session.song.title);
      let companion=null,companionAudio=null;
      if(mode==='both'){
        status.textContent='Saving Project · Packaging recorded WAV tracks into a companion ZIP…';
        const packageId=host.crypto?.randomUUID?.()||globalThis.crypto?.randomUUID?.();
        const prepared=writeAudioCompanionZip(audioTracks,{packageId,projectName:basename,
          songDurationMs:runtime.songDurationMs});
        companion={bytes:prepared.bytes,filename:basename+' — Audio.zip'};
        const sha256=await projectCompanionSha256(companion.bytes);
        companionAudio={package_id:packageId,filename:companion.filename,
          sha256,slots:audioTracks.map(a=>a.slot).sort((a,b)=>a-b)};
      }
      status.textContent='Saving Project · Packaging musical CSVs and SoundFonts…';
      // Audio source bytes never enter the Music ZIP when the split format is selected.
      const result=prepareMusicalProjectZIP({session,sources,runtime,
        soundFonts:{...bundle,assets},audioTracks:[],companionAudio});
      const musicFilename=basename+(companion?' — Music':'')+'.zip';
      const markDownloaded=createProjectExportReceipt(host,companion?['music','audio']:['music']);
      if(companion){
        offerDownloads([{label:'Music',bytes:result.bytes,filename:musicFilename},
          {label:'Audio',bytes:companion.bytes,filename:companion.filename}],markDownloaded);
        status.dataset.state='ok';
        status.textContent=`Both ZIPs prepared: ${result.sourceCount} musical track(s) and `+
          `${audioTracks.length} original WAV(s). Download BOTH ZIPs using the buttons below; `+
          'the browser may require separate download approval.';
      }else{
        requestZipDownload(root,result.bytes,musicFilename);
        markDownloaded('music');
        status.dataset.state='ok';
        status.textContent=`Music-only Project ZIP prepared; browser download requested: `+
          `${result.sourceCount} musical track(s), SoundFonts and settings. `+
          (audioTracks.length?`${audioTracks.length} loaded WAV(s) intentionally excluded. `:'')+
          'Your live composition was not modified.';
      }
    }catch(error){
      status.dataset.state='error';
      status.textContent=`PROJECT NOT SAVED: ${error?.message||String(error)}. Existing browser session unchanged.`;
      host.console?.error?.('Projects ZIP export rejected',error);
    }finally{busy=false;refresh();}
  });
  host.addEventListener?.('symphonycsv:session-changed',refresh);
  host.addEventListener?.('symphonycsv:source-accepted',refresh);
  refresh();
  return true;
}
if(typeof document!=='undefined'&&typeof window!=='undefined'){
  if(document.readyState==='loading')
    document.addEventListener('DOMContentLoaded',()=>initializeProjectSaveUI(),{once:true});
  else initializeProjectSaveUI();
}
