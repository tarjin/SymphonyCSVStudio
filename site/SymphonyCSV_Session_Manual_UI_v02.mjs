/* Step 107 — user-initiated session saves. Nothing is stored automatically.
 * Header controls work across Studio views and are scoped to this browser origin.
 */
import {
  SESSION_SCHEMA, hashText, hashBlob, verifySession, getSavedSession,
  putSavedSession, clearSavedSession, savedSessionPayloadBytes, formatSessionPayloadBytes
} from './SymphonyCSV_Session_Store_v02.mjs';
import {captureSoundFontAssets,soundFontAssignmentsWithBytes} from './SymphonyCSV_SoundFont_Assets_v01.mjs';
import {prepareSoundFontsForSession} from './SymphonyCSV_SoundFont_Ready_v01.mjs';
import {captureWavSessionClips,stageBrowserSessionRecovery,
  commitStagedBrowserSession} from './SymphonyCSV_Session_Recovery_v01.mjs';

function start(){
  const saveButton=document.getElementById('scsv-session-save');
  const recoverButton=document.getElementById('scsv-session-recover');
  const clearButton=document.getElementById('scsv-session-clear');
  const label=document.getElementById('scsv-session-timestamp');
  const sizeLabel=document.getElementById('scsv-session-size');
  const moreMenu=document.getElementById('scsv-session-menu');
  if(!saveButton||!recoverButton||!clearButton||!label)return;
  if(saveButton.dataset.initialized==='yes')return;
  saveButton.dataset.initialized='yes';
  let saved=null, damaged=false, busy=false, storageAvailable=true, storageReady=false;
  const showSize=raw=>{
    if(!sizeLabel)return;
    sizeLabel.title='Measured source and metadata bytes; browser database overhead is not included.';
    if(!raw){sizeLabel.textContent=damaged?'Saved session size: Unavailable':
      'No saved session';return;}
    try{sizeLabel.textContent='Saved session size: '+
      formatSessionPayloadBytes(savedSessionPayloadBytes(raw));}
    catch(error){sizeLabel.textContent='Saved session size: Unavailable';}
  };
  const currentTracks=()=>window.SymphonyCSVImportSession?.tracks?.filter(Boolean).length||0;
  const dateText=iso=>new Date(iso).toLocaleString(undefined,{
    year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
  });
  function refresh(message=''){
    saveButton.disabled=busy||!storageAvailable||!storageReady||!currentTracks();
    recoverButton.disabled=busy||!storageAvailable||!storageReady||!saved;
    clearButton.disabled=busy||!storageAvailable||!storageReady||(!saved&&!damaged);
    label.textContent=message||(saved
      ? `Last saved: ${dateText(saved.savedAt)} · ${saved.song.title} · ${saved.tracks.length} musical track(s) · ${saved.audioClips.length} WAV track(s)`
      : 'No saved browser session');
    recoverButton.title=saved?`Recover ${saved.song.title} (saved ${dateText(saved.savedAt)})`:
      'No browser session is saved';
  }
  async function loadExisting(){
    try {
      const raw=await getSavedSession();
      if(raw){
        try{saved=await verifySession(raw);damaged=false;storageReady=true;showSize(saved);refresh();}
        catch(error){
          damaged=true;saved=null;storageReady=true;showSize(null);
          console.error('Saved browser session integrity check failed',error);
          refresh('Saved session failed integrity verification. Use More → Clear Saved Session, or Save to Browser to replace it.');
        }
      }else{saved=null;damaged=false;storageReady=true;showSize(null);refresh();}
    } catch(error){
      storageAvailable=false;showSize(null);
      console.error('Saved browser session unavailable',error);
      refresh('Browser session storage unavailable: '+(error?.message||String(error)));
    }
  }
  async function captureAudio(){
    // WAV runtime is mandatory even for a six-track-only save: if it failed to
    // initialize we cannot know whether a loaded recording is being omitted.
    const clips=captureWavSessionClips(window.SymphonyCSVWAVRuntime);
    return Promise.all(clips.map(async c=>({...c,sha256:await hashBlob(c.blob)})));
  }
  async function refreshSizeOnOpen(){
    if(!moreMenu?.open||!sizeLabel)return;
    try{
      const raw=await getSavedSession();
      if(moreMenu.open)showSize(raw);
    }catch(error){
      if(moreMenu.open)sizeLabel.textContent='Saved session size: Unavailable';
    }
  }
  if(typeof moreMenu?.addEventListener==='function')
    moreMenu.addEventListener('toggle',()=>{if(moreMenu.open)void refreshSizeOnOpen();});
  saveButton.addEventListener('click',async()=>{
    if(busy||!storageAvailable||!storageReady||!currentTracks())return;
    if((saved||damaged)&&!window.confirm(saved
      ? 'Replace the saved browser session from '+dateText(saved.savedAt)+
        '? This will not change your original CSV files.'
      : 'Replace the damaged browser session with your current validated composition?'))return;
    busy=true;refresh('Saving session to this browser…');
    try{
      const session=window.SymphonyCSVImportSession;
      const sources=window.SymphonyCSVSessionSources?.getAccepted?.();
      if(!session?.song||!Array.isArray(sources)||sources.length!==currentTracks())
        throw Error('Not every imported track has validated source CSV text. Reimport any missing track.');
      const runtime=window.SymphonyCSVSessionRuntime;
      if(typeof runtime?.capture!=='function')
        throw Error('Studio session-settings bridge is unavailable.');
      const tracks=await Promise.all(sources.map(async s=>({
        ...s,sha256:await hashText(s.csvText)
      })));
      const soundFontBridge=window.SymphonyCSVSoundFontRuntime;
      if(typeof soundFontBridge?.capture!=='function')
        throw Error('SoundFont persistence bridge is unavailable. Session not replaced.');
      const populatedSlots=sources.map(s=>s.slot);
      refresh('Preparing SoundFonts for the saved session…');
      await prepareSoundFontsForSession(populatedSlots,soundFontBridge);
      refresh('Saving session to this browser…');
      const soundFonts=await captureSoundFontAssets(
        soundFontBridge.capture(populatedSlots),populatedSlots);
      const audioClips=await captureAudio();
      const snapshot={schema:SESSION_SCHEMA,
        song:{...session.song},tracks,audioClips,
        soundFonts,settings:runtime.capture(),savedAt:new Date().toISOString()};
      let committed=false;
      try{
        await putSavedSession(snapshot);
        committed=true;
        saved=await verifySession(await getSavedSession());
      }catch(error){
        if(committed){
          saved=null;damaged=true;showSize(null);
          throw Error('Session write committed, but read-back verification failed: '+
            (error?.message||String(error))+'. Inspect browser storage before saving again.');
        }
        throw error;
      }
      damaged=false;showSize(saved);
      refresh(`Last saved: ${dateText(saved.savedAt)} · `+
        `${saved.song.title} · ${saved.tracks.length} musical track(s) · ${saved.audioClips.length} WAV track(s)`);
      console.info('Manual session saved',{title:saved.song.title,tracks:saved.tracks.length,
        audioClips:saved.audioClips.length,savedAt:saved.savedAt});
    }catch(error){
      console.error('Save to Browser failed; verify prior session status',error);
      refresh('SAVE NOT VERIFIED — '+(error?.message||String(error)));
    }finally{busy=false;saveButton.disabled=!storageAvailable||!storageReady||!currentTracks();
      recoverButton.disabled=!storageAvailable||!storageReady||!saved;
      clearButton.disabled=!storageAvailable||!storageReady||(!saved&&!damaged);}
  });

  async function replay(){
    if(busy||!saved||!storageAvailable||!storageReady)return;
    busy=true;refresh('Checking saved session integrity and staging tracks…');
    try{
      // P069: no forced reload. All CSVs, SoundFonts, WAV bytes, decoding,
      // onset and settings are staged before the guarded live-state swap.
      const staged=await stageBrowserSessionRecovery(await getSavedSession(),{host:window});
      refresh(`Recovering ${staged.session.tracks.length} musical and `+
        `${staged.session.audioClips.length} WAV track(s)…`);
      const restored=commitStagedBrowserSession(staged,{host:window});
      saved=staged.session;showSize(saved);
      refresh(`Recovered ${restored.title} · ${restored.tracks} musical track(s) · `+
        `${restored.audioClips} WAV track(s) · original save: ${dateText(saved.savedAt)}`);
      console.info('Manual session restored',restored);
    }catch(error){
      console.error('Saved session recovery did not complete',error);
      refresh('RECOVERY FAILED — '+(error?.message||String(error))+
        '. Existing composition was retained unless rollback itself reported an error.');
    }finally{
      busy=false;
      saveButton.disabled=!storageAvailable||!storageReady||!currentTracks();
      recoverButton.disabled=!storageAvailable||!storageReady||!saved;
      clearButton.disabled=!storageAvailable||!storageReady||(!saved&&!damaged);
    }
  }
  recoverButton.addEventListener('click',async()=>{
    if(busy||!saved)return;
    if(currentTracks()&&!window.confirm('Recover the saved session from '+dateText(saved.savedAt)+
      '? The currently loaded composition will be replaced only after full validation. ' +
      'Unsaved changes will be lost if recovery succeeds.'))return;
    await replay();
  });
  clearButton.addEventListener('click',async()=>{
    if(busy||(!saved&&!damaged))return;
    if(!window.confirm('Permanently clear the saved browser session'+
      (saved?' from '+dateText(saved.savedAt):' (damaged copy)')+
      '? This cannot be undone. Current tracks and original files remain untouched.'))return;
    busy=true;refresh('Clearing the browser recovery copy…');
    try {
      await clearSavedSession();
      saved=null;damaged=false;showSize(null);
      document.getElementById('scsv-session-menu')?.removeAttribute('open');
      refresh('Saved browser session cleared. Current music remains loaded.');
    }catch(error){
      refresh('Clear failed: '+(error?.message||String(error)));
    }finally{
      busy=false;
      saveButton.disabled=!storageAvailable||!storageReady||!currentTracks();
      recoverButton.disabled=!storageAvailable||!storageReady||!saved;
      clearButton.disabled=!storageAvailable||!storageReady||(!saved&&!damaged);
    }
  });
  // Projects swaps validated track sources in one transaction and emits
  // session-changed (rather than one source-accepted event per track).
  // Keep manual session controls synchronized without writing to storage.
  window.addEventListener('symphonycsv:session-changed',()=>refresh());
  window.addEventListener('symphonycsv:source-accepted',()=>refresh());
  refresh('Checking for a saved browser session…');
  void loadExisting();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
