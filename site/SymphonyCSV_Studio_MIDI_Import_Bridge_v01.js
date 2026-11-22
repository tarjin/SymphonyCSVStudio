/* SymphonyCSV Studio MIDI Import Bridge V3 — in-shell workspace.
 * The existing MIDI converter stays in its same-origin iframe and retains its
 * state when the user visits another Studio workspace. No modal/second app bar.
 * Accepted converted CSV still goes through the Studio Rust/WASM importer.
 */
function initializeSymphonyCSVMidiBridge(){
  'use strict';
  const HOST_READY='symphonycsv:midi:host-ready';
  const IMPORT_REQUEST='symphonycsv:midi:import-request';
  const IMPORT_RESULT='symphonycsv:midi:import-result';
  const MIDI_STATUS='symphonycsv:midi:status';
  const sessionStatus=document.getElementById('scsv-import-status');
  const header=sessionStatus?.parentElement;
  const frame=document.getElementById('scsv-midi-frame');
  if(!header || !frame || !document.getElementById('sixTrackNav') ||
     typeof window.SymphonyCSVSetView!=='function'){
    console.error('MIDI import bridge: Studio workspace or CSV dropzone not ready.');
    return;
  }
  const style=document.createElement('style');
  style.textContent=`
    #scsv-midi-open{display:inline-block;padding:8px 13px;border-radius:8px;
      background:#593482;color:#fff;border:1px solid #9871c8;cursor:pointer;
      font:600 12px system-ui;}
    #scsv-midi-open:hover,#scsv-midi-open:focus-visible{
      background:#70449d;outline:2px solid #c29cf0;}
  `;
  document.head.append(style);
  const button=document.createElement('button');
  button.id='scsv-midi-open';button.type='button';button.textContent='♫ Import MIDI';
  button.title='Import MIDI into Piano Roll Track 1/2 or Drum Track 5/6';
  header.append(button);
  let pendingFile=null,requestedTrack=1,busy=false,frameReady=false;
  const origin=window.location.origin;
  const selectedTrack=()=>{
    const tab=document.querySelector('#sixTrackNav .track-tab.selected[data-track]');
    const n=Number(tab?.dataset.track);
    return [1,2,5,6].includes(n)?n:1;
  };
  function showError(message){
    if(sessionStatus){sessionStatus.textContent=message;sessionStatus.dataset.result='error';}
  }
  function notifyChild(file=null){
    if(!frameReady)return;
    frame.contentWindow?.postMessage({type:HOST_READY,slot:requestedTrack,file},origin);
  }
  function activate(){
    if(!frame.getAttribute('src')){
      frame.src='/midi-workspace/workspace.html';
    }
    // If already loaded, leave the user's MIDI analysis and conversion form
    // untouched. Only an explicit new MIDI file should replace the source.
    else if(frameReady && pendingFile){
      notifyChild(pendingFile);pendingFile=null;
    }
  }
  function launch(slot,file=null){
    if(busy && file){showError('MIDI import is already in progress.');return;}
    if(file && (!/\.midi?$/i.test(file.name)||file.size>30_000_000)){
      showError('Only MIDI (.mid or .midi) files up to 30 MB are accepted.');return;
    }
    if(![1,2,5,6].includes(slot)){
      showError('MIDI import supports Piano Roll Tracks 1–2 or Drum Tracks 5–6. TAB remains CSV-only.');return;
    }
    requestedTrack=slot;
    if(file)pendingFile=file;
    window.SymphonyCSVSetView('import-midi');
    activate();
  }
  window.SymphonyCSVOpenMidiWorkspace=launch;
  button.addEventListener('click',()=>launch(selectedTrack()));
  frame.addEventListener('load',()=>{
    frameReady=true;
    notifyChild(pendingFile);pendingFile=null;
  });
  window.addEventListener('symphonycsv:workspace-changed',event=>{
    if(event.detail?.view==='import-midi')activate();
  });
  window.addEventListener('message',async event=>{
    if(event.origin!==origin || event.source!==frame.contentWindow)return;
    const msg=event.data;
    if(!msg || typeof msg!=='object')return;
    if(msg.type===MIDI_STATUS){
      if(typeof msg.message==='string')
        window.SymphonyCSVStudioConsole?.log(msg.message,msg.kind==='bad'?'error':msg.kind==='good'?'ok':'info','MIDI');
      return;
    }
    if(msg.type!==IMPORT_REQUEST || busy)return;
    if(![1,2,5,6].includes(msg.slot)||typeof msg.csvText!=='string'||
       msg.csvText.length===0||msg.csvText.length>30_000_000||
       typeof msg.filename!=='string'){
      frame.contentWindow?.postMessage({type:IMPORT_RESULT,ok:false,message:'Invalid MIDI import request.'},origin);
      return;
    }
    busy=true;
    let ok=false,message='';
    try{
      if(typeof window.SymphonyCSVImportMidiCSV!=='function')
        throw Error('Studio Rust/WASM CSV import is not ready.');
      ok=await window.SymphonyCSVImportMidiCSV({slot:msg.slot,filename:msg.filename,csvText:msg.csvText});
      message=ok?`Track ${msg.slot} imported and validated by Studio.`:
        `Track ${msg.slot} was not imported. Review the Studio status for details.`;
    }catch(err){
      message=`Studio rejected import: ${err?.message||String(err)}`;
      console.error('MIDI import bridge',err);
    }
    busy=false;
    frame.contentWindow?.postMessage({type:IMPORT_RESULT,ok,message},origin);
    if(ok){
      const tab=document.querySelector(`#sixTrackNav .track-tab[data-track="${msg.slot}"]`);
      tab?.click();
      window.SymphonyCSVSetView('playback');
    }
  });
  const sidebar=document.querySelector('.view-nav .nav-item[data-view="import-midi"]');
  if(sidebar){
    sidebar.disabled=false;
    sidebar.title='MIDI import and conversion — retained when switching workspaces';
  }
  if(location.hash==='#import-midi')activate();
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initializeSymphonyCSVMidiBridge,{once:true});
}else initializeSymphonyCSVMidiBridge();
