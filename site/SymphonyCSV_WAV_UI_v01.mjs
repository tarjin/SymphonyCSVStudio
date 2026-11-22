/* P068 — WAV-only Tracks 7–8: local sources, one shared Studio mixer,
 * one selected WAV track per musical measure, full-fidelity waveform and shared playhead.
 * Loads AFTER Studio's player bridge; does not change source CSV semantics.
 */
import {inspectWavBytes,formatOnsetMs,parseOnsetClock,validateWavOnset,
  waveformPeaks,wavClipWindow} from './SymphonyCSV_WAV_Core_v01.mjs';
import {clampWavMeasure,wavMeasureAtPosition,wavMeasureWindow,
  wavMeasurePlayheadFraction,wavMeasurePeakBins,wavMeasureAudioSamplePeaks,
  wavWaveformDisplayGain,wavMeasureActiveRegion} from './SymphonyCSV_WAV_Measure_View_v01.mjs';

const KEYS=['chorus','delay','reverb'];
const fresh=(slot)=>({slot,filename:'',bytes:null,buffer:null,durationMs:0,
  onset_ms:0,volume_percent:100,muted:false,pan_position:0,
  sends:{chorus:0,delay:0,reverb:0},sendMutes:{chorus:false,delay:false,reverb:false},peaks:null});
const requireTrue=(ok,msg)=>{if(!ok)throw Error(msg);};
export function createWavRuntime({host=window,root=document,bridge=host.SymphonyCSVWAVBridge}={}){
  requireTrue(bridge&&typeof bridge.ensureAudio==='function'&&typeof bridge.compositionEndMs==='function',
    'Studio WAV audio bridge is not ready.');
  const tracks=[fresh(7),fresh(8)];
  let voices=[],previewVoices=[],previewing=false,selection=0;
  const get=(slot)=>{requireTrue(slot===7||slot===8,'Invalid WAV track.');return tracks[slot-7];};
  const hasSong=()=>Boolean(bridge.hasSong());
  const validEnd=()=>Number(bridge.compositionEndMs());
  const snapshot=()=>tracks.map(t=>({...t,sends:{...t.sends},sendMutes:{...t.sendMutes}}));
  const getMixSettings=()=>tracks.map(t=>({volume_percent:t.volume_percent,muted:t.muted,
    pan_position:t.pan_position,sends:{...t.sends},sendMutes:{...t.sendMutes}}));
  const updateGraph=()=>{bridge.refreshEffects();};
  const stopSources=collection=>{for(const v of collection.splice(0))try{v.stop();}catch{}};
  const stopLiveVoices=()=>stopSources(voices);
  const stopPreview=()=>{stopSources(previewVoices);previewing=false;update();};
  function scheduleBuffer(ctx,graph,t,startAt,offset,duration,destination){
    if(!t.buffer||duration<=0)return null;
    const src=ctx.createBufferSource();src.buffer=t.buffer;
    src.connect(destination);
    const remaining=t.buffer.duration-offset;
    const count=Math.min(duration,remaining);
    if(count<=0)return null;
    src.start(startAt,offset,count);
    return src;
  }
  function scheduleLive({ctx,graph,audioStartSeconds,startPosMs,endPosMs,decayPaddingMs}){
    stopLiveVoices();stopPreview();
    const songEnd=validEnd();
    for(const t of tracks){
      if(!t.buffer)continue;
      const span=wavClipWindow({onsetMs:t.onset_ms,durationMs:t.buffer.duration*1000,
        fromMs:startPosMs,toMs:endPosMs,songDurationMs:songEnd,decayPaddingMs:endPosMs===songEnd?decayPaddingMs:0});
      if(!span)continue;
      const when=audioStartSeconds+(span.startMs-startPosMs)/1000;
      const src=scheduleBuffer(ctx,graph,t,when,span.sourceOffsetMs/1000,
        span.durationMs/1000,graph.wavInputs[t.slot-7]);
      if(src)voices.push(src);
    }
  }
  function scheduleOffline(ctx,graph,{musicalEndMs,decayPaddingMs}){
    for(const t of tracks){
      if(!t.buffer)continue;
      const span=wavClipWindow({onsetMs:t.onset_ms,durationMs:t.buffer.duration*1000,
        fromMs:0,toMs:musicalEndMs,decayPaddingMs});
      if(!span)continue;
      scheduleBuffer(ctx,graph,t,span.startMs/1000,span.sourceOffsetMs/1000,
        span.durationMs/1000,graph.wavInputs[t.slot-7]);
    }
  }
  async function decode(bytes){
    inspectWavBytes(bytes);
    const graph=await bridge.ensureAudio();
    requireTrue(graph?.ctx?.decodeAudioData,'Web Audio WAV decoding is not available.');
    const buffer=await graph.ctx.decodeAudioData(bytes.slice().buffer);
    requireTrue(buffer?.numberOfChannels>=1&&buffer.numberOfChannels<=2&&buffer.duration>0,
      'WAV decode returned unsupported channel data.');
    return {buffer,peaks:waveformPeaks(buffer,{samples:4000})};
  }
  function assertSongCompatible(song){
    const duration=bridge.songDurationFor(song);
    for(const t of tracks)if(t.buffer)validateWavOnset(t.onset_ms,duration);
    return true;
  }
  async function importFile(slot,file){
    requireTrue(hasSong(),'Load a validated SymphonyCSV musical track (1–6) before importing WAV audio.');
    requireTrue(file&&/\.wav$/i.test(file.name),'Tracks 7 and 8 accept .wav files only.');
    requireTrue(bridge.mode()==='stopped','Stop the musical transport before importing WAV audio.');
    stopPreview();
    const bytes=new Uint8Array(await file.arrayBuffer());
    const info=inspectWavBytes(bytes);
    validateWavOnset(0,validEnd());
    const decoded=await decode(bytes);
    const current=get(slot);
    // Only replace the selected WAV after every asynchronous validation succeeds.
    Object.assign(current,fresh(slot),{filename:file.name,bytes,buffer:decoded.buffer,
      peaks:decoded.peaks,durationMs:info.durationMs});
    lastDrawSignature='';updateGraph();update();
    host.dispatchEvent(new CustomEvent('symphonycsv:wav-changed',{detail:{slot}}));
    return current;
  }
  function setValue(slot,key,value){
    const t=get(slot);requireTrue(t.buffer,'Load a WAV before editing Track '+slot+'.');
    if(key==='onset_ms'){
      requireTrue(hasSong(),'WAV onset requires a validated musical composition.');
      validateWavOnset(value,validEnd());
      t.onset_ms=value;
    }else if(key==='volume_percent'){
      requireTrue(Number.isSafeInteger(value)&&value>=0&&value<=100,'WAV volume must be 0–100%.');
      t.volume_percent=value;
    }else if(key==='pan_position'){
      requireTrue(Number.isSafeInteger(value)&&value>=-100&&value<=100,'WAV pan must be −100 to +100.');
      t.pan_position=value;
    }else if(key==='muted'){
      requireTrue(typeof value==='boolean','Invalid WAV mute setting.');t.muted=value;
    }else throw Error('Unsupported WAV setting.');
    updateGraph();update();return t;
  }
  function setSend(slot,name,value){
    requireTrue(KEYS.includes(name),'Invalid shared effect.');
    requireTrue(Number.isSafeInteger(value)&&value>=0&&value<=100,'Send must be 0–100%.');
    const t=get(slot);requireTrue(t.buffer,'Load a WAV before changing effects.');
    t.sends[name]=value;t.sendMutes[name]=false;updateGraph();update();
  }
  function toggleSend(slot,name){
    requireTrue(KEYS.includes(name),'Invalid shared effect.');
    const t=get(slot);if(!t.buffer||t.sends[name]===0)return false;
    t.sendMutes[name]=!t.sendMutes[name];updateGraph();update();return true;
  }
  function clear(slot){
    requireTrue(bridge.mode()==='stopped','Stop the musical transport before clearing audio.');
    stopPreview();stopLiveVoices();Object.assign(get(slot),fresh(slot));
    lastDrawSignature='';updateGraph();update();host.dispatchEvent(new CustomEvent('symphonycsv:wav-changed',{detail:{slot,cleared:true}}));
  }
  async function preview(){
    throw Error('WAV-only preview is retired. Load a musical composition and use the shared transport.');
    if(previewing){stopPreview();return;}
    const graph=await bridge.ensureAudio();
    requireTrue(tracks.some(t=>t.buffer),'Load a WAV to preview.');
    const now=graph.ctx.currentTime+.04;
    // Reset the master after a previous musical playback ended at a gated tail.
    graph.master.gain.cancelScheduledValues(graph.ctx.currentTime);
    graph.master.gain.setValueAtTime(.66,graph.ctx.currentTime);
    for(const t of tracks){
      if(!t.buffer)continue;
      const src=scheduleBuffer(graph.ctx,graph,t,now,0,t.buffer.duration,graph.wavInputs[t.slot-7]);
      if(src)previewVoices.push(src);
    }
    previewing=true;
    for(const src of previewVoices)src.addEventListener('ended',()=>{
      previewVoices=previewVoices.filter(s=>s!==src);
      if(!previewVoices.length){previewing=false;update();}
    },{once:true});
    update();
  }
  function captureForZIP(){return tracks.filter(t=>t.bytes).map(t=>({slot:t.slot,bytes:t.bytes,
    filename:t.filename,onset_ms:t.onset_ms,volume_percent:t.volume_percent,
    muted:t.muted,pan_position:t.pan_position,sends:{...t.sends},sendMutes:{...t.sendMutes}}));}
  async function prepareRestore(audioSources,manifest,song){
    requireTrue(Array.isArray(audioSources)&&audioSources.length<=2&&manifest?.tracks,
      'Invalid WAV Project snapshot.');
    const duration=bridge.songDurationFor(song),ready=[fresh(7),fresh(8)];
    for(const entry of audioSources){
      requireTrue([7,8].includes(entry.slot)&&!ready[entry.slot-7].bytes,
        'Project WAV slots must be unique.');
      const config=manifest.tracks.find(t=>t.slot===entry.slot);
      requireTrue(config&&entry.filename===config.source_file,'Project WAV filename does not match its settings.');
      validateWavOnset(config.onset_ms,duration);
      const info=inspectWavBytes(entry.bytes),decoded=await decode(entry.bytes);
      const sends=Object.fromEntries(KEYS.map(k=>[k,manifest.playback.audio_sends_percent?.[k]?.[entry.slot-7]??0]));
      const sendMutes=Object.fromEntries(KEYS.map(k=>[k,manifest.playback.audio_send_mutes?.[k]?.[entry.slot-7]??false]));
      ready[entry.slot-7]={slot:entry.slot,filename:config.original_filename??entry.filename,bytes:entry.bytes,
        buffer:decoded.buffer,peaks:decoded.peaks,durationMs:info.durationMs,
        onset_ms:config.onset_ms,volume_percent:config.volume_percent,
        muted:config.muted,pan_position:config.pan_position??0,sends,sendMutes};
    }
    return ready;
  }
  function captureRestorable(){return snapshot();}
  function commitRestore(ready){
    requireTrue(Array.isArray(ready)&&ready.length===2&&ready.every(t=>t.slot===7||t.slot===8),
      'Invalid prepared WAV Project.');
    stopPreview();stopLiveVoices();
    for(let i=0;i<2;i++)Object.assign(tracks[i],ready[i]);
    lastDrawSignature='';updateGraph();update();
    host.dispatchEvent(new CustomEvent('symphonycsv:wav-changed',{detail:{restored:true}}));
  }
  const runtime={selectedSlot:()=>selection,captureForZIP,getMixSettings,assertSongCompatible,
    importFile,setValue,setSend,toggleSend,clear,preview,stopPreview,stopLiveVoices,
    scheduleLive,scheduleOffline,prepareRestore,commitRestore,captureRestorable,hasSong,
    get:(slot)=>({...get(slot)}),getTracks:()=>snapshot(),refresh:()=>update()};
  // Waveform drawing and controls. All DOM nodes are in the WAV panel only.
  const playback=root.getElementById('view-playback');
  const workspace=root.querySelector('main.workspace');
  const transport=root.querySelector('#view-playback .playback-hero .transport-card');
  requireTrue(playback&&workspace&&transport,'Studio playback workspace/transport is missing.');
  // The real transport moves between two views. The same AudioContext, DOM
  // listeners and musical transport remain authoritative in both locations.
  const originalTransportLocation=root.createComment('P068-U1 original musical transport');
  transport.before(originalTransportLocation);
  const panel=root.createElement('section');panel.id='scsv-wav-panel';panel.hidden=true;
  panel.setAttribute('aria-label','Selected WAV audio track workspace');
  const focusStyle=root.createElement('style');
  focusStyle.id='scsv-p068-u1-dedicated-wave-workspace';
  focusStyle.textContent=`
    /* The musical editor stays mounted and fully alive; only its display hides. */
    .workspace.scsv-wav-focus>.scsv-shared-title{display:none!important}
    .workspace.scsv-wav-focus #view-playback>.view-top,
    .workspace.scsv-wav-focus #view-playback>.source-banner,
    .workspace.scsv-wav-focus #view-playback>.playback-hero,
    .workspace.scsv-wav-focus #view-playback>.playback-controls,
    .workspace.scsv-wav-focus #view-playback>#scsv-tab-viewer,
    .workspace.scsv-wav-focus #view-playback>.main-grid{display:none!important}
    body.scsv-wav-focus .song-sidebar .meta-row{display:none}
    .workspace.scsv-wav-focus #scsv-wav-panel{margin:0 0 18px;padding:22px}
    #scsv-wav-panel .scsv-wav-controls{grid-template-columns:minmax(0,1fr);margin:12px 0}
    #scsv-wav-panel .scsv-wav-track[hidden]{display:none!important}
    #scsv-wav-panel .scsv-wav-track{border-color:#8060ad;background:#241a35}
    #scsv-wav-panel .scsv-wav-summary{font:600 12px/1.5 system-ui;color:#d5c5ed;margin:4px 0 10px}
    #scsv-wav-panel .scsv-wav-transport-host:empty{display:none}
    #scsv-wav-panel .scsv-wav-transport-host{margin:16px 0}
    #scsv-wav-panel .scsv-wav-transport-host .transport-card{width:100%;max-width:none}
    /* The one live FX diagram moves here while a WAV track owns the workspace. */
    #scsv-wav-panel > .scsv-fx-routing{margin:14px 0;border:1px solid #8060ad;
      border-radius:12px;padding:14px 18px}
    #audioTrackNav .track-tab.selected[aria-pressed=true]{border:2px solid #bf91ff;background:#352448;color:#fff}
    @media(max-width:760px){#scsv-wav-panel .scsv-wav-head{display:block}
      #scsv-wav-panel .scsv-wav-actions{margin-top:14px}}
  `;
  root.head.append(focusStyle);
  panel.innerHTML=`<header class="scsv-wav-head"><div><p class="eyebrow">RECORDED AUDIO · TRACKS 7 & 8</p>
    <h2 id="scsv-wav-heading">Track 7 — WAV Audio</h2><p id="scsv-wav-song-context" class="scsv-wav-summary"></p><p id="scsv-wav-mode">Load a musical track (1–6) to enable WAV import.</p></div>
    <div class="scsv-wav-actions"><button type="button" id="scsv-wav-preview" hidden disabled>▶ Preview WAVs</button>
    <button type="button" id="scsv-wav-prev" aria-label="Previous measure">Previous</button>
    <button type="button" id="scsv-wav-next" aria-label="Next measure">Next</button>
    <label>Jump to measure <input type="number" id="scsv-wav-jump" min="1" value="1" style="width:70px"></label>
    <button type="button" id="scsv-wav-go">Go</button></div></header>
    <div class="scsv-wav-controls" id="scsv-wav-controls"></div>
    <div class="scsv-wav-transport-host" id="scsv-wav-transport-host"></div>
    <p id="scsv-wav-message" role="status" aria-live="polite"></p>
    <section class="scsv-wav-measure-view" id="scsv-wav-measure-view" aria-label="One musical measure of recorded WAV audio">
      <header class="scsv-wav-measure-header"><div><p class="eyebrow" id="scsv-wav-measure-eyebrow">NOW VIEWING · RECORDED AUDIO</p>
        <h3 id="scsv-wav-measure-title">Measure 001</h3></div>
        <span id="scsv-wav-measure-mode" class="scsv-wav-measure-badge">STOPPED</span></header>
      <div class="scsv-wav-measure-panel">
        <div class="scsv-wav-measure-topline"><strong>ONE SHARED PLAYHEAD · WAV AUDIO</strong>
          <span id="scsv-wav-measure-time">00:00:00.000 – 00:00:00.000</span></div>
        <p id="scsv-wav-current-file" class="scsv-wav-current-file">Track 7 · No WAV loaded</p>
        <div id="scsv-wav-measure-progress" class="scsv-wav-measure-progress" role="progressbar" aria-label="Position within the current musical measure" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="scsv-wav-measure-fill"></span><i id="scsv-wav-measure-needle"></i></div>
        <div class="scsv-wav-waveframe"><canvas id="scsv-wav-canvas" width="1000" height="280" aria-label="Selected WAV track waveform for the current musical measure"></canvas>
          <div id="scsv-wav-playhead" class="scsv-wav-playhead" aria-hidden="true"></div></div>
        <div id="scsv-wav-beats" class="scsv-wav-beats" aria-hidden="true"></div>
      </div>
    </section>`;
  playback.prepend(panel);
  // P072-FX: reuse the exact, listener-bearing FX Signal Flow diagram.
  // WAV focus hides the musical shared header, so the diagram must move into
  // the active WAV workspace and return without cloning controls or FX state.
  // The WAV ES module can execute while document.readyState is "interactive",
  // BEFORE the classic CSV importer creates #scsv-fx-routing at DOMContentLoaded.
  // Resolve the existing diagram only when the workspace actually needs it.
  // Never cache an absent diagram or create a second set of FX controls.
  let fxRouting=null;
  let originalFxRoutingLocation=null;
  function resolveFxRouting(){
    const live=root.getElementById('scsv-fx-routing');
    if(!live)return null;
    if(live!==fxRouting){
      fxRouting=live;
      originalFxRoutingLocation=root.createComment('P072-FX original diagram location');
      fxRouting.before(originalFxRoutingLocation);
    }
    return fxRouting;
  }
  const q=id=>root.getElementById(id);
  const report=(message,kind='')=>{q('scsv-wav-message').textContent=message;q('scsv-wav-message').dataset.state=kind;};
  // P068-U7: the WAV viewer shares the musical measure and the existing transport.
  // No vertical song canvas, independent media clock, or waveform editing model.
  let shownMeasure=0,lastDrawSignature='';
  const currentMeasure=()=>hasSong()?wavMeasureAtPosition(bridge.timing(),bridge.currentPosition()):0;
  const measureWindow=()=>shownMeasure&&hasSong()?wavMeasureWindow(bridge.timing(),shownMeasure):null;
  function drawMeasure(){
    const view=q('scsv-wav-measure-view'),canvas=q('scsv-wav-canvas');
    const win=measureWindow();
    view.hidden=!win;
    q('scsv-wav-jump').max=String(bridge.timing()?.totalMeasures||1);
    if(!win)return;
    const {measure,totalMeasures,startMs,endMs}=win;
    q('scsv-wav-measure-title').textContent=`Measure ${String(measure).padStart(3,'0')} / ${totalMeasures}`;
    q('scsv-wav-measure-time').textContent=`${formatOnsetMs(Math.round(startMs))} – ${formatOnsetMs(Math.round(endMs))}`;
    if(root.activeElement!==q('scsv-wav-jump'))q('scsv-wav-jump').value=String(measure);
    q('scsv-wav-prev').disabled=measure===1;
    q('scsv-wav-next').disabled=measure===totalMeasures;
    const c=canvas.getContext('2d');if(!c)return;
    const width=canvas.width,height=canvas.height;
    c.clearRect(0,0,width,height);c.fillStyle='#191226';c.fillRect(0,0,width,height);
    // P068-U10: only the selected WAV has a softly tinted background, from
    // its exact onset to its actual end. No duplicate amber onset playhead.
    const slot=selection===8?8:7,t=get(slot);
    const activeRegion=t.buffer?wavMeasureActiveRegion({onsetMs:t.onset_ms,
      durationMs:t.durationMs,startMs,endMs}):null;
    if(activeRegion){
      const left=activeRegion.startFraction*width;
      const right=activeRegion.endFraction*width;
      c.fillStyle='#233146';c.fillRect(left,0,right-left,height);
    }
    // Draw a musical beat ruler using the song's actual meter, not an assumed 4/4.
    const meter=String(host.SymphonyCSVImportSession?.song?.timeSignature||'4/4');
    const beats=Math.max(1,Math.min(16,Number.parseInt(meter.split('/')[0],10)||4));
    const beatsNode=q('scsv-wav-beats');beatsNode.replaceChildren();
    for(let beat=0;beat<beats;beat++){
      const x=beat*width/beats;
      c.strokeStyle=beat===0?'rgba(222,190,255,.4)':'rgba(222,190,255,.15)';
      c.beginPath();c.moveTo(x,0);c.lineTo(x,height);c.stroke();
      if(beats<=12){const mark=root.createElement('span');mark.textContent=`Beat ${beat+1}`;
        mark.style.left=`${(beat/beats*100).toFixed(4)}%`;beatsNode.append(mark);}
    }
    // P068-U8: precisely one selected track, with the FULL canvas height.
    // Read the decoded WAV samples for this bar rather than stretching
    // 4,000 coarse, song-wide preview peaks across 143 measures.
    canvas.setAttribute('aria-label',`Track ${slot} ${t.filename||'empty WAV'} within musical measure ${measure}`);
    const center=height/2,extent=(height-44)/2;
    c.strokeStyle='rgba(197,169,234,.26)';c.lineWidth=1;
    c.beginPath();c.moveTo(0,center+.5);c.lineTo(width,center+.5);c.stroke();
    if(!t.buffer){
      c.font='600 18px system-ui';c.fillStyle='#cbb9df';
      c.textAlign='center';c.fillText(`Track ${slot} · No WAV loaded`,width/2,center-12);
      c.font='14px system-ui';c.fillStyle='#a99abb';
      c.fillText('Choose a WAV above to see its waveform.',width/2,center+16);c.textAlign='start';
    }else{
      const gain=wavWaveformDisplayGain(t.peaks);
      const wave=t.buffer?wavMeasureAudioSamplePeaks({buffer:t.buffer,durationMs:t.durationMs,
        onsetMs:t.onset_ms,startMs,endMs,bins:width}):null;
      // Backwards-compatible fallback for restorations that provide peaks
      // before a decoded AudioBuffer is attached. This preserves U7 callers.
      const legacy=!wave?wavMeasurePeakBins({peaks:t.peaks,durationMs:t.durationMs,onsetMs:t.onset_ms,
        startMs,endMs,bins:width}):null;
      c.fillStyle=slot===7?'#78b8fd':'#a4efd2';
      for(let i=0;i<width;i++){
        const high=wave?wave.upper[i]:legacy?.[i]||0;
        const low=wave?wave.lower[i]:-(legacy?.[i]||0);
        // Scaling affects VISUALIZATION only: no WAV, mixer, or gain changes.
        const yTop=center-Math.min(1,high*gain)*extent;
        const yBottom=center+Math.min(1,-low*gain)*extent;
        if(yBottom-yTop>.01)c.fillRect(i,yTop,1,Math.max(1,yBottom-yTop));
      }

    }
  }
  function update(){
    q('scsv-wav-heading').textContent=`Track ${selection===8?8:7} — WAV Audio`;
    q('scsv-wav-measure-eyebrow').textContent=selection?`NOW VIEWING · TRACK ${selection} WAV`:'NOW VIEWING · RECORDED AUDIO';
    q('scsv-wav-current-file').textContent=selection?`Track ${selection} · ${get(selection).filename||'No WAV loaded'}`:'Select Track 7 or 8';
    const song=host.SymphonyCSVImportSession?.song;
    q('scsv-wav-song-context').textContent=hasSong()
      ?`${song?.title||'Current composition'} · ${song?.tempoBpm??'—'} BPM · ${song?.timeSignature||'—'} · ${bridge.timing()?.totalMeasures??'—'} measures · ${host.SymphonyCSVImportSession.tracks.filter(Boolean).length}/6 musical tracks`
      :'No musical CSV loaded · WAV import disabled';
    q('scsv-wav-mode').textContent=hasSong()
      ?'Musical Tracks 1–6 define the measure grid and song duration. Onset uses clock time.'
      :'Load a validated SymphonyCSV musical track (1–6) before importing WAV recordings. Tracks 7–8 depend on its measure grid.';
    q('scsv-wav-preview').disabled=true;
    q('scsv-wav-preview').textContent=previewing?'■ Stop Preview':'▶ Preview WAVs';
    q('scsv-wav-jump').disabled=q('scsv-wav-go').disabled=!hasSong();
    for(const t of tracks){
      const label=q('scsv-wav-name-'+t.slot);if(!label)continue;
      label.textContent=t.filename||'Empty WAV track';
      q('scsv-wav-file-'+t.slot).disabled=!hasSong();
      q('scsv-wav-clear-'+t.slot).disabled=!t.buffer;
      const onsetInput=q('scsv-wav-onset-'+t.slot);
      // Never overwrite a musician's in-progress millisecond edit during a UI refresh.
      if(root.activeElement!==onsetInput)onsetInput.value=formatOnsetMs(hasSong()?t.onset_ms:0);
      onsetInput.disabled=!t.buffer||!hasSong();
      q('scsv-wav-volume-'+t.slot).value=String(t.volume_percent);
      const navVolume=root.querySelector(`#audioTrackNav .scsv-audio-channel:nth-child(${t.slot-6}) .track-volume`);
      if(navVolume)navVolume.value=String(t.volume_percent);
      q('scsv-wav-mute-'+t.slot).textContent=t.muted?'Unmute':'Mute';
      q('scsv-wav-pan-'+t.slot).value=String(t.pan_position);
      q('scsv-wav-panlabel-'+t.slot).textContent=t.pan_position===0?'Center':
        `${Math.abs(t.pan_position)} ${t.pan_position<0?'L':'R'}`;
      root.querySelector(`[data-audio-track="${t.slot}"] .track-tab-type`)?.replaceChildren(root.createTextNode(t.buffer?'WAV · Loaded':'WAV · Empty'));
    }
    if(!hasSong()){shownMeasure=0;lastDrawSignature='';drawMeasure();}
    else{
      shownMeasure=shownMeasure?clampWavMeasure(bridge.timing(),shownMeasure):currentMeasure();
      const signature=tracks.map(t=>t.filename+':'+t.onset_ms+':'+t.durationMs).join('|')+'|'+
        `${validEnd()}:${shownMeasure}:${selection}:${host.SymphonyCSVImportSession?.song?.timeSignature||''}`;
      if(signature!==lastDrawSignature){lastDrawSignature=signature;drawMeasure();}
    }
    q('scsv-wav-prev').disabled=!hasSong()||shownMeasure<=1;
    q('scsv-wav-next').disabled=!hasSong()||shownMeasure>=Number(bridge.timing()?.totalMeasures||0);
  }
  const list=q('scsv-wav-controls');
  for(const slot of [7,8]){
    const card=root.createElement('article');card.id='scsv-wav-card-'+slot;card.className='scsv-wav-track';card.innerHTML=`
      <h3>TRACK ${slot} · WAV AUDIO</h3><p id="scsv-wav-name-${slot}">Empty WAV track</p>
      <div class="scsv-wav-row"><input type="file" accept=".wav,audio/wav,audio/x-wav" id="scsv-wav-file-${slot}" aria-label="Choose WAV file for Track ${slot}">
      <button id="scsv-wav-clear-${slot}" type="button">Clear</button></div>
      <div class="scsv-wav-onset-block">
        <label class="scsv-wav-onset-label" for="scsv-wav-onset-${slot}">WAV START POSITION</label>
        <input class="scsv-wav-onset-timecode" type="text" id="scsv-wav-onset-${slot}" value="00:00:00.000" inputmode="numeric" maxlength="12" autocomplete="off" spellcheck="false" aria-describedby="scsv-wav-onset-hint-${slot}" aria-label="Track ${slot} WAV start position">
        <span class="scsv-wav-onset-hint" id="scsv-wav-onset-hint-${slot}">HH:MM:SS.mmm · Relative to song start · Enter to apply · Esc to cancel</span>
      </div>
      <div class="scsv-wav-row"><label>Volume <input type="range" id="scsv-wav-volume-${slot}" min="0" max="100" value="100"></label>
      <button id="scsv-wav-mute-${slot}" type="button">Mute</button>
      <label>Pan L ↔ R <input type="range" id="scsv-wav-pan-${slot}" min="-100" max="100" value="0"></label>
      <span id="scsv-wav-panlabel-${slot}">Center</span>
      <button id="scsv-wav-center-${slot}" type="button">Center</button></div>`;
    list.append(card);
    const file=q('scsv-wav-file-'+slot);
    async function acceptFile(selected){try{
      report(`Reading and decoding Track ${slot}…`);await importFile(slot,selected);
      report(`Track ${slot} loaded: ${selected.name}. Source WAV remains unmodified.`,'ok');
    }catch(err){report('Track '+slot+' rejected: '+err.message,'error');}finally{file.value='';}}
    file.addEventListener('change',()=>{if(file.files?.length===1)void acceptFile(file.files[0]);});
    card.addEventListener('dragover',ev=>{ev.preventDefault();ev.dataTransfer.dropEffect=hasSong()?'copy':'none';});
    card.addEventListener('drop',ev=>{ev.preventDefault();if(!hasSong()){report('Load a validated musical track (1–6) before importing WAV audio.','error');return;}if(ev.dataTransfer.files.length===1)
      void acceptFile(ev.dataTransfer.files[0]);else report('Drop one WAV file per track.','error');});
    q('scsv-wav-clear-'+slot).addEventListener('click',()=>{try{clear(slot);report('Track '+slot+' cleared.');}catch(err){report(err.message,'error');}});
    const onsetInput=q('scsv-wav-onset-'+slot);
    function commitOnset(){
      try{
        const parsed=parseOnsetClock(onsetInput.value);
        if(parsed===get(slot).onset_ms){onsetInput.value=formatOnsetMs(parsed);report('','');return;}
        setValue(slot,'onset_ms',parsed);
        onsetInput.value=formatOnsetMs(parsed);
        report('Track '+slot+' WAV start position updated.','ok');
      }catch(err){report(err.message,'error');onsetInput.value=formatOnsetMs(get(slot).onset_ms);update();}
    }
    onsetInput.addEventListener('change',commitOnset);
    onsetInput.addEventListener('keydown',ev=>{
      if(ev.key==='Enter'){ev.preventDefault();ev.stopPropagation();commitOnset();onsetInput.blur();}
      else if(ev.key==='Escape'){
        ev.preventDefault();ev.stopPropagation();
        onsetInput.value=formatOnsetMs(get(slot).onset_ms);
        report('',''); // An abandoned invalid edit must not leave a stale red error.
        onsetInput.blur();
      }
    });
    q('scsv-wav-volume-'+slot).addEventListener('input',ev=>{if(get(slot).buffer)setValue(slot,'volume_percent',Number(ev.target.value));});
    q('scsv-wav-mute-'+slot).addEventListener('click',()=>{if(get(slot).buffer)setValue(slot,'muted',!get(slot).muted);});
    q('scsv-wav-pan-'+slot).addEventListener('input',ev=>{if(get(slot).buffer)setValue(slot,'pan_position',Number(ev.target.value));});
    q('scsv-wav-center-'+slot).addEventListener('click',()=>{if(get(slot).buffer)setValue(slot,'pan_position',0);});
  }
  q('scsv-wav-preview').addEventListener('click',()=>{void preview().catch(err=>report(err.message,'error'));});
  function navigateToMeasure(target){
    if(!hasSong())return;
    const m=clampWavMeasure(bridge.timing(),target);
    bridge.seekMeasure(m); // Same transport seek used by musical tracks and Drums.
    shownMeasure=m;lastDrawSignature='';update();
  }
  q('scsv-wav-prev').addEventListener('click',()=>navigateToMeasure(shownMeasure-1));
  q('scsv-wav-next').addEventListener('click',()=>navigateToMeasure(shownMeasure+1));
  q('scsv-wav-go').addEventListener('click',()=>navigateToMeasure(Number(q('scsv-wav-jump').value)||1));
  // P068-U1: one visible editor at a time. Do not change the musical
  // selectedTrackSlot, track mutes, note sources, shared clock or transport.
  function syncWorkspace(){
    const visible=Boolean(selection)&&root.getElementById('view-playback').classList.contains('active');
    workspace.classList.toggle('scsv-wav-focus',visible);
    root.body.classList.toggle('scsv-wav-focus',visible);
    panel.hidden=!visible;
    if(visible){
      q('scsv-wav-transport-host').append(transport);
      const routing=resolveFxRouting();
      if(routing)q('scsv-wav-controls').before(routing); // Immediately below WAV heading.
    }else{
      originalTransportLocation.after(transport);
      const routing=resolveFxRouting();
      if(routing&&originalFxRoutingLocation)originalFxRoutingLocation.after(routing);
    }
    root.querySelectorAll('#audioTrackNav button[data-audio-track]').forEach(el=>{
      const active=Number(el.dataset.audioTrack)===selection;
      el.classList.toggle('selected',active);
      el.setAttribute('aria-pressed',String(active));
      el.setAttribute('aria-current',active?'true':'false');
    });
    root.querySelectorAll('#sixTrackNav button[data-track]').forEach(el=>{
      if(!selection)return; // ShowTrackSlot restores its own selected state.
      el.classList.remove('selected');
      el.setAttribute('aria-pressed','false');
      el.removeAttribute('aria-current');
    });
    for(const slot of [7,8]){
      const card=q('scsv-wav-card-'+slot);
      if(card)card.hidden=Boolean(selection)&&selection!==slot;
    }
    host.SymphonyCSVStudioFxStrip?.sync?.();
    host.dispatchEvent?.(new CustomEvent('symphonycsv:wav-workspace-selected',{detail:{slot:visible?selection:0}}));
  }
  function select(slot){
    requireTrue(slot===7||slot===8,'Invalid WAV editor selection.');
    lastDrawSignature='';
    selection=slot;
    host.SymphonyCSVSetView('playback');
    syncWorkspace();update();
    // Selecting a track reveals its own editor directly below the track tabs,
    // not the previously selected Piano Roll and several screens of scrolling.
    root.querySelector('.track-tabs-scroll')?.scrollIntoView({block:'start',behavior:'auto'});
  }
  for(const slot of [7,8]){
    const btn=root.querySelector(`#audioTrackNav button[data-audio-track="${slot}"]`);
    if(btn){btn.disabled=false;btn.title='Open WAV Track '+slot;btn.addEventListener('click',()=>select(slot));}
    const vol=root.querySelector(`#audioTrackNav .scsv-audio-channel:nth-child(${slot-6}) .track-volume`);
    if(vol){vol.disabled=false;vol.addEventListener('input',()=>{if(get(slot).buffer)
      setValue(slot,'volume_percent',Number(vol.value));q('scsv-wav-volume-'+slot).value=vol.value;});}
  }
  root.querySelectorAll('#sixTrackNav button[data-track]').forEach(btn=>btn.addEventListener('click',()=>{
    selection=0;
    syncWorkspace();
    host.SymphonyCSVSetView('playback');
  }));
  host.addEventListener('symphonycsv:session-changed',()=>update());
  host.addEventListener('symphonycsv:workspace-changed',()=>syncWorkspace());
  // Visual-only RAF: a single measure follows the existing musical position.
  // The waveform is genuine, stationary source peaks; only the shared playhead moves.
  let previousProgress=-1,previousMode='';
  function animate(){
    if(panel.hidden){host.requestAnimationFrame(animate);return;}
    const timing=bridge.timing();
    if(hasSong()&&timing){
      const position=bridge.currentPosition(),measure=wavMeasureAtPosition(timing,position);
      if(measure!==shownMeasure){shownMeasure=measure;lastDrawSignature='';update();}
      const win=measureWindow();
      if(win){
        const fraction=wavMeasurePlayheadFraction(win,position),percent=Math.round(fraction*10000)/100;
        if(Math.abs(percent-previousProgress)>.08){
          q('scsv-wav-playhead').style.left=percent+'%';
          q('scsv-wav-measure-fill').style.width=percent+'%';
          q('scsv-wav-measure-needle').style.left=percent+'%';
          q('scsv-wav-measure-progress').setAttribute('aria-valuenow',String(Math.round(percent)));
          previousProgress=percent;
        }
        const mode=position>=validEnd()?'NATURAL DECAY':bridge.mode().toUpperCase();
        if(mode!==previousMode){q('scsv-wav-measure-mode').textContent=mode;previousMode=mode;}
      }
    }
    host.requestAnimationFrame(animate);
  }
  host.requestAnimationFrame(animate);
  host.addEventListener('symphonycsv:session-changed',()=>{if(hasSong())stopPreview();update();});
  update();
  return Object.freeze(runtime);
}
if(typeof document!=='undefined'&&typeof window!=='undefined'){
  const load=()=>{if(!window.SymphonyCSVWAVRuntime){try{
    window.SymphonyCSVWAVRuntime=createWavRuntime();
  }catch(error){window.console.error('P068 WAV initialization unavailable',error);}}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
}
