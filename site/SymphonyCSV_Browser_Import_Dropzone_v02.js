/* SymphonyCSV Studio — browser import/drop-zone prototype v0.2.
 * Requires window.SymphonyCSVImport (the existing, tested CSV import core).
 * Step 36: invokes an optional guarded player hook for Track 1 only.
 * Track 2–6 data remain in independently validated session slots.
 * Do not interpret CSV validation as evidence of audio playback.
 */
(() => {
  'use strict';

  function initialize() {
    const importer = window.SymphonyCSVImport;
    const title = document.querySelector('#playback-title');
    const viewTop = document.querySelector('#view-playback .view-top');
    const leftHeader = document.querySelector('#view-playback .view-top > div:first-child');
    const trackTabs = document.querySelectorAll('#sixTrackNav .track-tab[data-track]');
    if (!importer || !title || !viewTop || !leftHeader || trackTabs.length !== 6) {
      console.error('SymphonyCSV drop-zone integration guard failed', {
        importer: !!importer, title: !!title, leftHeader: !!leftHeader,
        trackTabs: trackTabs.length
      });
      return;
    }
    if (document.querySelector('#scsv-import-file')) return;

    // A pending track hides the Playback Viewer itself in Exploration 01.8.
    // Move the existing title/header out to a shared, always-visible location,
    // rather than building a second, competing upload target for Track 2–6.
    const sharedHeader = document.createElement('div');
    sharedHeader.className = 'view-top scsv-shared-title';
    const pendingPanel = document.querySelector('#sixTrackPending');
    (pendingPanel || document.querySelector('#view-playback')).before(sharedHeader);
    sharedHeader.append(leftHeader);
    const topActions = viewTop.querySelector('.top-actions');
    if (topActions) sharedHeader.append(topActions);
    viewTop.hidden = true;
    // LABS V2 layout: the song identity is a full-width, stable section.
    // The original import target remains separate so its drop and click handlers
    // can operate without making the song heading itself a file-picker button.
    const eyebrow = leftHeader.querySelector('.eyebrow');
    if (eyebrow) eyebrow.textContent = 'CURRENT COMPOSITION';
    const subtitle = leftHeader.querySelector('.under-title');
    const songPanel = document.createElement('section');
    songPanel.className = 'scsv-song-panel';
    songPanel.setAttribute('aria-label', 'Current composition');
    if (eyebrow) songPanel.append(eyebrow);
    songPanel.append(title);
    if (subtitle) songPanel.append(subtitle);
    const songStats = document.createElement('div');
    songStats.className = 'scsv-song-stats';
    songStats.innerHTML = [
      ['scsv-stat-bpm', 'BPM'],
      ['scsv-stat-meter', 'Time signature'],
      ['scsv-stat-measures', 'Measures'],
      ['scsv-stat-tracks', 'Tracks loaded']
    ].map(([id,label]) => `<div class="scsv-stat"><strong id="${id}">—</strong><span>${label}</span></div>`).join('');
    songPanel.append(songStats);
    // P060-I: a collapsed one-line console sits directly below composition
    // metadata. Its history is volatile UI state, never musical/project data.
    const studioConsole=document.createElement('details');
    studioConsole.id='scsv-studio-console';
    studioConsole.className='scsv-studio-console';
    studioConsole.innerHTML=`
      <summary class="scsv-console-summary">
        <span class="scsv-console-heading">▤ STUDIO CONSOLE</span>
        <span class="scsv-console-led" data-kind="info" aria-hidden="true"></span>
        <span id="scsv-console-latest">Ready for an import or Project.</span>
        <span class="scsv-console-expander">History ▾</span>
      </summary>
      <div class="scsv-console-history" id="scsv-console-history" role="log"
           aria-label="Studio operations history" aria-live="off"></div>`;
    songPanel.append(studioConsole);
    sharedHeader.insertBefore(songPanel, leftHeader);
    // Parallel FX A/B/C plus independent downstream master Compressor and EQ.
    // DRY is a separate fourth branch; it never passes through the wet effects.
    const routing=document.createElement('details');
    routing.open=true; // Diagram initially visible; user can collapse it independently of FX state.
    routing.id='scsv-fx-routing';
    routing.className='scsv-fx-routing';
    routing.setAttribute('aria-label','Shared effects signal flow and bypass controls');
    routing.innerHTML=`
      <summary class="scsv-fx-strip-heading"><span>FX SIGNAL FLOW</span>
        <small>3 shared parallel slots · Compressor → Graphic EQ → Limiter</small>
        <span class="scsv-fx-expander" aria-hidden="true">Hide ▴</span></summary>
      <div class="scsv-fx-routing-body">
      <div class="scsv-fx-flow-scroll"><div class="scsv-fx-flow-inner">
        <div class="scsv-fx-input-bus">TRACKS 1–8 <span>· SIX MUSICAL · TWO RECORDED WAV</span>
          <div class="scsv-fx-track-context" id="scsv-fx-track-context">TRACK 1 · SEND CONTROL</div></div>
        <svg class="scsv-fx-lines" viewBox="0 0 800 35" aria-hidden="true">
          <path d="M400 0 V12 H100 V35 M400 12 H700 V35 M300 12 V35 M500 12 V35"/>
          <circle cx="100" cy="12" r="3"/><circle cx="300" cy="12" r="3"/>
          <circle cx="500" cy="12" r="3"/><circle cx="700" cy="12" r="3"/>
        </svg>
        <div class="scsv-fx-branches">
          <div class="scsv-fx-dry"><span>DRY PATH</span><strong>UNCHANGED</strong>
            <small>Direct to master mix</small></div>
          <button type="button" class="scsv-fx-stomp" data-fx-key="chorus"
            aria-pressed="false" aria-label="Toggle selected track Chorus send">
            <span class="scsv-fx-slot">SLOT A · PARALLEL</span><span class="scsv-fx-lamp" aria-hidden="true"></span>
            <strong>≋ CHORUS</strong><span class="scsv-fx-switch">● BYPASSED</span></button>
          <button type="button" class="scsv-fx-stomp" data-fx-key="delay"
            aria-pressed="false" aria-label="Toggle selected track Delay send">
            <span class="scsv-fx-slot">SLOT B · PARALLEL</span><span class="scsv-fx-lamp" aria-hidden="true"></span>
            <strong>↻ DELAY</strong><span class="scsv-fx-switch">● BYPASSED</span></button>
          <button type="button" class="scsv-fx-stomp" data-fx-key="reverb"
            aria-pressed="false" aria-label="Toggle selected track Reverb send">
            <span class="scsv-fx-slot">SLOT C · PARALLEL</span><span class="scsv-fx-lamp" aria-hidden="true"></span>
            <strong>◉ REVERB</strong><span class="scsv-fx-switch">● BYPASSED</span></button>
        </div>
        <svg class="scsv-fx-lines" viewBox="0 0 800 35" aria-hidden="true">
          <path d="M100 0 V12 H700 V0 M300 0 V12 M500 0 V12 M400 12 V35"/>
          <circle cx="400" cy="12" r="4"/>
        </svg>
        <div class="scsv-fx-master-line"><span class="scsv-master-mix">MASTER MIX</span>
          <span class="scsv-routing-arrow" aria-hidden="true">→</span>
          <button type="button" class="scsv-fx-stomp scsv-fx-master" data-fx-key="compressor"
            aria-pressed="false" aria-label="Toggle master Compressor bypass">
            <span class="scsv-fx-slot">MASTER · AFTER MIX</span><span class="scsv-fx-lamp" aria-hidden="true"></span>
            <strong>◈ COMPRESSOR</strong><span class="scsv-fx-switch">● BYPASSED</span></button>
          <span class="scsv-routing-arrow" aria-hidden="true">→</span>
          <button type="button" class="scsv-fx-stomp scsv-fx-master scsv-fx-equalizer" data-fx-key="equalizer"
            aria-pressed="false" aria-label="Toggle master Graphic EQ bypass">
            <span class="scsv-fx-slot">MASTER · AFTER COMPRESSOR</span><span class="scsv-fx-lamp" aria-hidden="true"></span>
            <strong>≡ GRAPHIC EQ</strong><span class="scsv-fx-switch">● BYPASSED</span></button>
          <span class="scsv-routing-arrow" aria-hidden="true">→</span>
          <span class="scsv-fx-output">OUTPUT <small>LIMITER</small></span></div>
      </div></div>
      <p class="scsv-fx-route-help">Chorus, Delay and Reverb switch the selected track's send between
        0% and its saved level. Their shared processors stay globally enabled or bypassed in their
        respective workspaces. Master Compressor and Graphic EQ have independent bypasses;
        the fixed output limiter remains downstream. Tracks 7–8 share the same effects processors and master processing chain.</p>
      </div>`;
    sharedHeader.insertBefore(routing,leftHeader);

    // Three buttons operate the SELECTED musical track's sends. Compressor and
    // Graphic EQ have independent GLOBAL bypass stompboxes. This display owns no
    // effect state: the existing Studio runtime remains authoritative.
    const parallelKeys=['chorus','delay','reverb'];
    function syncFxStrip(){
      const runtime=window.SymphonyCSVSessionRuntime;
      const snapshot=runtime?.getFxRoutingState?.();
      if(!snapshot)return;
      // P068-U1: Track 7/8 has its own send state, not Track 1's.
      const wav=window.SymphonyCSVWAVRuntime;
      const wavSlot=wav?.selectedSlot?.()||0;
      const wavSettings=wavSlot?wav.get(wavSlot):null;
      const selectedSlot=wavSlot||snapshot.track;
      const context=routing.querySelector('#scsv-fx-track-context');
      if(context)context.textContent=`TRACK ${selectedSlot} · SELECTED SEND CONTROLS`;
      for(const name of parallelKeys){
        const stomp=routing.querySelector(`[data-fx-key="${name}"]`);
        if(!stomp)continue;
        const percent=wavSettings?wavSettings.sends[name]:snapshot.sends[name];
        const global=snapshot.global[name];
        const mute=wavSettings?wavSettings.sendMutes[name]:snapshot.muted[name];
        const active=global && percent>0 && !mute;
        stomp.classList.toggle('scsv-fx-on',active);
        stomp.disabled=!global||percent===0;
        stomp.setAttribute('aria-pressed',String(active));
        stomp.dataset.sendMuted=String(mute);
        const message=!global?'GLOBAL OFF · '+percent+'% SAVED':
          percent===0?'0% · SET SEND':mute?'0% · '+percent+'% SAVED':percent+'% SEND';
        stomp.querySelector('.scsv-fx-switch').textContent='● '+message;
        stomp.setAttribute('aria-label',`Track ${selectedSlot} ${name} send: ${message}. `+
          (stomp.disabled?'Set or enable it in the '+name+' workspace.':'Click to toggle track send mute.'));
      }
      const comp=routing.querySelector('[data-fx-key="compressor"]');
      const master=!!snapshot.global.compressor;
      comp.classList.toggle('scsv-fx-on',master);
      comp.setAttribute('aria-pressed',String(master));
      comp.querySelector('.scsv-fx-switch').textContent=master?'● ACTIVE':'● BYPASSED';
      comp.setAttribute('aria-label','Toggle master Compressor bypass for all tracks');
      const eq=routing.querySelector('[data-fx-key="equalizer"]');
      const eqEnabled=!!snapshot.global.masterEqEnabled;
      eq.classList.toggle('scsv-fx-on',eqEnabled);
      eq.setAttribute('aria-pressed',String(eqEnabled));
      eq.querySelector('.scsv-fx-switch').textContent=eqEnabled?'● ACTIVE':'● BYPASSED';
      eq.setAttribute('aria-label','Toggle master Graphic EQ bypass for all tracks');
    }
    for(const name of parallelKeys){
      routing.querySelector(`[data-fx-key="${name}"]`).addEventListener('click',()=>{
        const wav=window.SymphonyCSVWAVRuntime;
        const wavSlot=wav?.selectedSlot?.()||0;
        if(wavSlot)wav.toggleSend(wavSlot,name);
        else window.SymphonyCSVSessionRuntime?.toggleTrackSend?.(name);
        syncFxStrip();
      });
      document.getElementById(name+'Enabled')?.addEventListener('change',syncFxStrip);
    }
    routing.querySelector('[data-fx-key="compressor"]').addEventListener('click',()=>{
      document.getElementById('compressorEnabled')?.click();
      syncFxStrip();
    });
    document.getElementById('compressorEnabled')?.addEventListener('change',syncFxStrip);
    routing.querySelector('[data-fx-key="equalizer"]').addEventListener('click',()=>{
      document.getElementById('masterEqEnabled')?.click();
      syncFxStrip();
    });
    document.getElementById('masterEqEnabled')?.addEventListener('change',syncFxStrip);
    window.SymphonyCSVStudioFxStrip=Object.freeze({sync:syncFxStrip});
    syncFxStrip();

    // Centralized operational history; limit memory and deduplicate repeated
    // status renderings. Never write to Project ZIP or Save to Browser data.
    const history=studioConsole.querySelector('#scsv-console-history');
    const latest=studioConsole.querySelector('#scsv-console-latest');
    const led=studioConsole.querySelector('.scsv-console-led');
    let previousConsoleKey='';
    function logConsole(message,kind='info',source='Studio'){
      const clean=String(message||'').trim().replace(/\s+/g,' ');
      if(!clean||clean.length>1200)return;
      const key=source+'|'+kind+'|'+clean;
      if(key===previousConsoleKey)return;
      previousConsoleKey=key;
      latest.textContent=`${source}: ${clean}`;
      led.dataset.kind=kind;
      const item=document.createElement('div');
      item.className='scsv-console-entry';item.dataset.kind=kind;
      const time=document.createElement('time');
      time.textContent=new Date().toLocaleTimeString();
      const content=document.createElement('span');content.textContent=`${source}: ${clean}`;
      item.append(time,content);
      history.prepend(item);
      while(history.childElementCount>60)history.lastElementChild.remove();
    }
    function watchStatus(element,source){
      if(!element)return;
      let prior=element.textContent.trim();
      const watcher=new MutationObserver(()=>{
        const text=element.textContent.trim();
        if(!text||text===prior)return;
        prior=text;
        const severity=element.dataset.result==='error'||element.dataset.state==='error'||
          /^(ERROR|FAILED|SAVE FAILED|RECOVERY INCOMPLETE|PROJECT NOT SAVED)/i.test(text)
          ?'error':element.dataset.result==='ok'||element.dataset.state==='ok'||
          /^(Track \d+|Recovered |Last saved:|PROJECT OPENED|Project ZIP downloaded)/i.test(text)
          ?'ok':'info';
        logConsole(text,severity,source);
      });
      watcher.observe(element,{childList:true,characterData:true,subtree:true,attributes:true,
        attributeFilter:['data-result','data-state']});
    }
    window.SymphonyCSVStudioConsole=Object.freeze({log:logConsole,watch:watchStatus});
    const watchedStatuses=[
      ['scsv-import-status','Import'],['scsv-projects-status','Projects'],
      ['scsv-session-timestamp','Session'],['sf2LoadStatus','SoundFont'],
      ['scsv-padding-message','Settings'],['footerMessage','Studio']
    ];
    for(const [id,source] of watchedStatuses){
      watchStatus(document.getElementById(id),source);
    }

    const session = {
      song: null,
      tracks: Array(6).fill(null),
      filenames: Array(6).fill(null),
      version: 'browser-dropzone-v0.2',
    };
    // Accessible only in this local prototype; no persistence or network upload.
    window.SymphonyCSVImportSession = session;

    const style = document.createElement('style');
    style.textContent = `
      #view-playback .view-top[hidden]{display:none!important;}
      .scsv-shared-title{margin:0 0 24px;}
            /* Step 206 — full-width contextual import header */
      .scsv-shared-title {
        display:block!important;
        width:100%;
      }
      .scsv-shared-title > .scsv-dropzone {
        width:100%;
        margin:0;
        padding:22px 26px;
      }
      .scsv-shared-title .top-actions {
        display:none!important;
      }
      /* Step 208 — two-column composition dropzone */
      .scsv-shared-title > .scsv-dropzone {
        display:grid;
        grid-template-columns:minmax(0,0.9fr) minmax(0,1.1fr);
        grid-template-rows:auto auto auto;
        column-gap:36px;
        row-gap:10px;
        align-items:start;
      }

      .scsv-dropzone > .eyebrow {
        grid-column:1;
        grid-row:1;
      }

      .scsv-dropzone > #playback-title {
        grid-column:1;
        grid-row:2;
      }

      .scsv-dropzone > .under-title {
        grid-column:1;
        grid-row:3;
        margin-top:4px;
      }

      .scsv-dropzone > .scsv-import-hint {
        grid-column:2;
        grid-row:1;
        margin-top:0;
        font-size:14px;
        font-weight:650;
        color:#ead8ff;
      }

      .scsv-dropzone > .scsv-import-types {
        grid-column:1 / -1;
        grid-row:4;
        margin-top:9px;
        padding-top:12px;
        border-top:1px solid #443254;
        white-space:pre-line;
        line-height:1.9;
      }

      .scsv-dropzone > .scsv-import-status {
        grid-column:2;
        grid-row:3;
        margin-top:0;
      }

      @media(max-width:850px) {
        .scsv-shared-title > .scsv-dropzone {
          grid-template-columns:minmax(0,1fr);
          row-gap:12px;
        }

        .scsv-dropzone > .eyebrow,
        .scsv-dropzone > #playback-title,
        .scsv-dropzone > .under-title,
        .scsv-dropzone > .scsv-import-hint,
        .scsv-dropzone > .scsv-import-types,
        .scsv-dropzone > .scsv-import-status {
          grid-column:1;
          grid-row:auto;
        }
      }
      .scsv-native-export{display:flex;justify-content:space-between;align-items:center;gap:12px;
        background:#24182f;border:1px solid #5a4474;border-radius:11px;
        padding:12px 16px;margin:0 0 15px;flex-wrap:wrap;}
      .scsv-native-export-label{font-size:12px;color:#d3bee8;font-weight:650;}
      #scsv-download-track-csv{font:750 13px system-ui;border:1px solid #bc94e7;
        border-radius:8px;padding:10px 14px;color:white;background:#6e3ca8;cursor:pointer;}
      #scsv-download-track-csv:hover:not(:disabled){background:#8b50c6;}
      #scsv-download-track-csv:disabled{opacity:.45;cursor:not-allowed;background:#362a42;border-color:#69547c;}
      #scsv-download-track-csv:focus-visible{outline:2px solid #dfb8ff;outline-offset:3px;}
      .scsv-import-types {
        margin-top:12px;
        color:#a8b9d8;
        font-size:11px;
        letter-spacing:.35px;
        line-height:1.6;
      }
      .scsv-dropzone{border:1px dashed #71549a;border-radius:12px;padding:12px 16px;
        margin:-12px -16px;transition:border-color .15s,background .15s;cursor:copy;}
      .scsv-dropzone:hover,.scsv-dropzone:focus-visible,.scsv-dropzone.scsv-over{
        border-color:#d1a2ff;background:#30203e88;outline:none;}
      .scsv-import-hint{font-size:12px;line-height:1.5;color:#c4acd9;
        margin-top:11px;display:flex;align-items:center;gap:9px;}
      .scsv-import-status{font-size:12px;line-height:1.5;color:#cdb8e2;
        margin-top:8px;max-width:800px;}
      .scsv-import-status[data-result="ok"]{color:#a2edc9;}
      .scsv-import-status[data-result="error"]{color:#ffc4b6;}
      .scsv-file-input{position:absolute;width:1px;height:1px;opacity:0;
        overflow:hidden;pointer-events:none;}

      /* LABS V2 contextual composition and selected-track overview */
      .scsv-shared-title{display:block!important;margin:0 0 17px;}
      .scsv-song-panel{box-sizing:border-box;width:100%;padding:25px 27px 20px;border:1px solid #5b4179;
        border-radius:14px 14px 0 0;background:linear-gradient(128deg,#261830,#1c1529);}
      .scsv-song-panel .eyebrow{color:#c49be9;letter-spacing:1.5px;
        font-size:11px;font-weight:800;margin:0 0 10px;}
      .scsv-song-panel #playback-title{max-width:none;width:100%;font-family:Georgia,serif;
        font-size:clamp(29px,3.1vw,43px);line-height:1.13;overflow-wrap:anywhere;
        margin:0 0 17px;color:#f5e9ff;}
      .scsv-song-panel .under-title{color:#c5b4d8;font-size:12px;margin:0 0 14px;
        line-height:1.5;}
      .scsv-song-panel[data-loaded="true"] .under-title{display:none;}
      .scsv-song-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
      .scsv-stat{display:flex;flex-direction:column;gap:4px;min-width:0;
        border:1px solid #4b365e;border-radius:9px;background:#171121;padding:11px 14px;}
      .scsv-stat strong{font:700 clamp(17px,2vw,25px) system-ui;color:#f8ecff;
        font-variant-numeric:tabular-nums;}
      .scsv-stat span{font:600 11px system-ui;color:#c6b1db;}
      .scsv-shared-title>.scsv-dropzone{display:flex!important;flex-direction:column;
        align-items:stretch;gap:10px;box-sizing:border-box;width:100%;margin:-1px 0 0;padding:18px 27px 20px;
        border:1px solid #5b4179;border-radius:0 0 14px 14px;
        background:linear-gradient(140deg,#21172f,#1c1528);min-width:0;}
      .scsv-shared-title>.scsv-dropzone:hover{background:#281c35;}
      .scsv-selected-head{display:flex;justify-content:space-between;
        align-items:center;gap:12px;flex-wrap:wrap;}
      .scsv-selected-head .scsv-selected-label{display:block;color:#c49be9;
        letter-spacing:1.3px;font-size:10px;font-weight:800;margin-bottom:6px;}
      #scsv-selected-track-name{color:#f4e7ff;font:750 17px system-ui;}
      #scsv-selected-track-state{padding:6px 10px;border:1px solid #6c557f;
        border-radius:20px;color:#d4c3e1;font:700 11px system-ui;background:#31253d;}
      #scsv-selected-track-state[data-loaded="true"]{border-color:#3f8d73;
        color:#9df0ce;background:#203b34;}
      #scsv-track-summary{margin:0;color:#cbb8dc;font:400 12px/1.5 system-ui;
        overflow-wrap:anywhere;}
      .scsv-shared-title .scsv-import-hint{font-size:12px;font-weight:500;
        color:#bda7d5;margin:0;line-height:1.5;}
      .scsv-shared-title .scsv-import-status{font-size:12px;margin:0;
        max-width:100%;overflow-wrap:anywhere;}
      .scsv-shared-title .scsv-native-export{display:flex;align-items:center;
        justify-content:flex-start;gap:9px;padding:0;border:0;background:none;
        margin:4px 0 0;flex-wrap:wrap;}
      .scsv-shared-title .scsv-native-export-label{position:absolute;
        width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;
        clip:rect(0,0,0,0);white-space:nowrap;border:0;}
      #scsv-import-selected-file{font:750 13px system-ui;
        color:#fff;background:#6c3daa;border:1px solid #ab84e3;
        border-radius:9px;padding:11px 15px;cursor:pointer;}
      #scsv-import-selected-file:hover{background:#874bc5;}
      #scsv-import-selected-file:focus-visible{outline:2px solid #e6c4ff;outline-offset:3px;}
      .scsv-shared-title .scsv-import-types{display:none;}
      /* P060-I: Console directly below title, tempo and composition counts. */
      .scsv-studio-console{margin-top:16px;border-top:1px solid #593f6d;padding-top:12px;}
      .scsv-console-summary{display:flex;align-items:center;gap:11px;cursor:pointer;
        font:600 12px/1.5 system-ui;color:#c9b8d8;list-style:none;min-height:28px;}
      .scsv-console-summary::-webkit-details-marker{display:none;}
      .scsv-console-summary:focus-visible{outline:2px solid #cba4ff;outline-offset:4px;}
      .scsv-console-heading{white-space:nowrap;font-size:10px;letter-spacing:1px;
        font-weight:800;color:#c69cf1;}
      .scsv-console-led{width:9px;height:9px;flex:none;border-radius:50%;
        background:#aaa0b7;box-shadow:0 0 0 2px #62536d;}
      .scsv-console-led[data-kind="ok"]{background:#79ddae;box-shadow:0 0 0 2px #366954;}
      .scsv-console-led[data-kind="error"]{background:#ffad9c;box-shadow:0 0 0 2px #834037;}
      #scsv-console-latest{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;
        white-space:nowrap;color:#d6c9e3;font-size:12px;font-weight:500;}
      .scsv-console-expander{white-space:nowrap;color:#b39bc9;font-size:11px;}
      .scsv-studio-console[open] .scsv-console-expander{font-size:0;}
      .scsv-studio-console[open] .scsv-console-expander::after{content:'Hide ▴';font-size:11px;}
      .scsv-console-history{margin-top:13px;padding:5px 12px;max-height:170px;overflow:auto;
        border-radius:9px;background:#140e1f;border:1px solid #433154;}
      .scsv-console-entry{display:flex;gap:12px;align-items:baseline;padding:7px 0;
        color:#d6c4e8;font:12px/1.5 system-ui;border-bottom:1px solid #35263f;overflow-wrap:anywhere;}
      .scsv-console-entry:last-child{border:0;}
      .scsv-console-entry time{color:#a68ab8;font:11px system-ui;flex:none;}
      .scsv-console-entry[data-kind="ok"]{color:#a8efcc;}
      .scsv-console-entry[data-kind="error"]{color:#ffb6a7;}
      /* The operational status is echoed into the console. Keep its original
         live region for assistive tech, but do not occupy the selected-track area. */
      #scsv-import-status{position:absolute!important;width:1px!important;height:1px!important;
        padding:0!important;margin:0!important;overflow:hidden!important;
        clip-path:inset(50%)!important;white-space:nowrap!important;}
      /* Three contextual sends plus two independent master bypass switches. */
      .scsv-fx-routing{box-sizing:border-box;width:100%;margin:-1px 0 0;
        border:1px solid #5b4179;border-bottom:0;
        background:linear-gradient(140deg,#1c1729,#1a1427);padding:15px 24px 17px;}
      .scsv-fx-strip-heading{display:flex;flex-wrap:wrap;gap:10px;
        align-items:center;justify-content:space-between;font:800 10px system-ui;
        letter-spacing:1.25px;color:#c49be9;cursor:pointer;list-style:none;outline-offset:3px;}
      .scsv-fx-strip-heading::-webkit-details-marker{display:none;}
      .scsv-fx-strip-heading::marker{content:'';}
      .scsv-fx-strip-heading:focus-visible{outline:2px solid #deb5ff;}
      .scsv-fx-strip-heading small{font:500 11px system-ui;letter-spacing:0;color:#ab9bc0;}
      .scsv-fx-expander{font:700 11px system-ui;letter-spacing:0;color:#c7a6e6;white-space:nowrap;}
      .scsv-fx-routing:not([open]){border-bottom:1px solid #5b4179;}
      .scsv-fx-routing:not([open]) .scsv-fx-expander{font-size:0;}
      .scsv-fx-routing:not([open]) .scsv-fx-expander::after{content:'Show ▾';font-size:11px;}
      .scsv-fx-routing-body{padding-top:8px;}
      .scsv-fx-flow-scroll{overflow-x:auto;overflow-y:hidden;}
      .scsv-fx-flow-inner{min-width:690px;}
      .scsv-fx-input-bus{text-align:center;padding:10px 0 0;font:800 11px system-ui;
        letter-spacing:.7px;color:#d0b8eb;}
      .scsv-fx-input-bus span{font-weight:500;font-size:10px;color:#ac95bb;}
      .scsv-fx-track-context{margin-top:6px;font:700 10px system-ui;
        letter-spacing:.8px;color:#90e3ba;}
      .scsv-fx-lines{display:block;width:100%;height:35px;overflow:visible;}
      .scsv-fx-lines path{fill:none;stroke:#9677b9;stroke-width:2.5;stroke-linejoin:round;}
      .scsv-fx-lines circle{fill:#b58bdd;}
      .scsv-fx-branches{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;}
      .scsv-fx-dry,.scsv-fx-stomp{display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:5px;min-width:0;min-height:95px;border-radius:12px;
        background:#1c1627;border:1px solid #5b4773;text-align:center;}
      .scsv-fx-dry span,.scsv-fx-slot{font:800 9px system-ui;letter-spacing:.8px;color:#aa8bbd;}
      .scsv-fx-dry strong{font:750 13px system-ui;color:#f1dfff;}
      .scsv-fx-dry small{color:#a69abc;font-size:10px;}
      .scsv-fx-stomp{padding:10px 6px;cursor:pointer;color:#d6c3ea;
        border-color:#655079;transition:background .12s,border-color .12s;}
      .scsv-fx-stomp strong{font:800 12px system-ui;letter-spacing:.4px;}
      .scsv-fx-stomp:hover:not(:disabled){background:#342449;border-color:#ab7de2;}
      .scsv-fx-stomp:disabled{opacity:.68;cursor:not-allowed;}
      .scsv-fx-stomp:focus-visible{outline:2px solid #deb5ff;outline-offset:2px;}
      .scsv-fx-lamp{width:10px;height:10px;background:#696071;border-radius:50%;
        box-shadow:0 0 0 3px #34283f;}
      .scsv-fx-on{background:#322243;border-color:#aa77db;color:#f8eaff;}
      .scsv-fx-on .scsv-fx-lamp{background:#78e7b1;
        box-shadow:0 0 0 3px #2b5a46,0 0 8px #7ef1b0;}
      .scsv-fx-switch{font:700 10px system-ui;color:#aba2bb;}
      .scsv-fx-on .scsv-fx-switch{color:#92eac0;}
      .scsv-fx-master-line{display:flex;align-items:center;gap:10px;
        justify-content:center;min-height:96px;}
      .scsv-master-mix,.scsv-fx-output{border:1px solid #655079;border-radius:8px;
        padding:10px 12px;background:#241b31;color:#e8d9f5;
        font:750 11px system-ui;text-align:center;white-space:nowrap;}
      .scsv-fx-output small{display:block;font:500 9px system-ui;color:#b1a2c1;}
      .scsv-routing-arrow{font-size:21px;color:#9f81ca;}
      .scsv-fx-master{flex:0 1 155px;min-height:74px;}
      .scsv-fx-equalizer{flex-basis:155px;}
      .scsv-fx-route-help{margin:2px 0 0!important;color:#a99ab9!important;
        font:11px/1.5 system-ui!important;}
      .scsv-shared-title>.scsv-dropzone{border-radius:0 0 14px 14px;}
      @media(max-width:650px){
        .scsv-song-panel{padding:19px 17px 15px;}
        .scsv-shared-title>.scsv-dropzone{padding:17px;}
        .scsv-song-stats{grid-template-columns:repeat(2,minmax(0,1fr));}
        .scsv-song-panel #playback-title{font-size:clamp(25px,6vw,34px);}
      }
    `;
    document.head.append(style);

    const input = document.createElement('input');
    input.type = 'file';
    input.id = 'scsv-import-file';
    input.className = 'scsv-file-input';
    input.accept = '.csv,.mid,.midi,text/csv,audio/midi,audio/x-midi';
    input.setAttribute('aria-label', 'Choose SymphonyCSV CSV or MIDI for selected track');
    leftHeader.append(input);

    leftHeader.classList.add('scsv-dropzone');
    leftHeader.tabIndex = 0;
    leftHeader.setAttribute('role','button');
    leftHeader.setAttribute('aria-label',
      'Import SymphonyCSV CSV, or MIDI for Piano Roll Tracks 1/2 and Drum Tracks 5/6');

    const hint = document.createElement('p');
    hint.className = 'scsv-import-hint';
    hint.textContent = '↓ Drop SymphonyCSV CSV or MIDI for the selected compatible track, or click to browse';
        const formatGuide = document.createElement('p');
    formatGuide.className = 'scsv-import-types';
    formatGuide.textContent =
      'TRACKS 1–2 · CSV OR MIDI (PIANO ROLL)\nTRACKS 3–4 · CSV (TAB)\nTRACKS 5–6 · CSV OR MIDI (DRUMS)\nTRACKS 7–8 · WAV ONLY (USE THE WAV TRACK CONTROLS)';
    const status = document.createElement('p');
    status.className = 'scsv-import-status';
    status.id = 'scsv-import-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live','polite');
    status.textContent = 'Drop a SymphonyCSV CSV or MIDI to establish the shared composition.';
    const trackHeading = document.createElement('div');
    trackHeading.className = 'scsv-selected-head';
    trackHeading.innerHTML = '<div><span class="scsv-selected-label">SELECTED TRACK</span>' +
      '<strong id="scsv-selected-track-name">Track 1 — Piano Roll</strong></div>' +
      '<span id="scsv-selected-track-state">Empty</span>';
    const trackSummary = document.createElement('p');
    trackSummary.id = 'scsv-track-summary';
    trackSummary.textContent = 'No CSV or MIDI imported for this track.';
    leftHeader.prepend(trackHeading, trackSummary);
    leftHeader.append(hint, status);
    window.SymphonyCSVStudioConsole.watch(status,'Import');

    const activeSlot = () => {
      const active = document.querySelector('#sixTrackNav .track-tab.selected[data-track]');
      const number = Number(active?.dataset.track);
      return Number.isInteger(number) && number >= 1 && number <= 6 ? number : 1;
    };
    const updateEditingAction = () => {
      if (topActions) topActions.style.display = 'none';
      const number = activeSlot();
      hint.textContent = [1,2,5,6].includes(number)
        ? 'Drop a MIDI (.mid/.midi) or SymphonyCSV (.csv) file here, or use Import.'
        : 'Drop a SymphonyCSV (.csv) file here, or use Import. TAB is CSV-only.';
      refreshOverview();
      // The existing track-select handlers update the instrument label, too.
      setTimeout(refreshOverview, 0);
    };
    for (const tab of trackTabs) tab.addEventListener('click',updateEditingAction);

    // LABS V2: Download the exact accepted musical CSV for the selected track.
    // No reconstructed 85/129/20-column rows; no SoundFont/effects data.
    const csvExportBar=document.createElement('div');
    csvExportBar.className='scsv-native-export';
    csvExportBar.setAttribute('aria-label','Selected musical track CSV export');
    const exportText=document.createElement('span');
    exportText.className='scsv-native-export-label';
    const csvExportButton=document.createElement('button');
    csvExportButton.id='scsv-download-track-csv';
    csvExportButton.type='button';
    csvExportButton.textContent='↓ Download .csv';
    csvExportButton.disabled=true;
    const importAction = document.createElement('button');
    importAction.id = 'scsv-import-selected-file';
    importAction.type = 'button';
    importAction.textContent = 'Import CSV or MIDI';
    importAction.addEventListener('click', () => input.click());
    csvExportBar.append(importAction, csvExportButton, exportText);
    leftHeader.insertBefore(csvExportBar, status);
    // The drop zone is still mouse-drop/click capable, but explicit buttons
    // provide proper keyboard access without nested role=button semantics.
    leftHeader.removeAttribute('role');
    leftHeader.removeAttribute('tabindex');
    leftHeader.setAttribute('aria-label', 'Drop a supported file onto the selected track');

    function refreshOverview(){
      const slot = activeSlot();
      const song = session.song;
      songPanel.dataset.loaded = song?'true':'false';
      const loaded = session.tracks[slot-1];
      const type = slot<=2 ? 'Piano Roll' : slot<=4 ? 'TAB' : 'Drums';
      const supportedMidi = [1,2,5,6].includes(slot);
      const stats = {
        'scsv-stat-bpm': song ? String(song.tempoBpm ?? '—') : '—',
        'scsv-stat-meter': song ? String(song.timeSignature ?? '—') : '—',
        'scsv-stat-measures': song ? String(song.totalMeasures ?? '—') : '—',
        'scsv-stat-tracks': session.tracks.filter(Boolean).length + '/6'
      };
      for (const [id,value] of Object.entries(stats)) {
        const el = document.getElementById(id);
        if (el) el.textContent=value;
      }
      const titleText = song?.title || 'No song loaded';
      if (title.textContent !== titleText) title.textContent=titleText;
      document.getElementById('scsv-selected-track-name').textContent = `Track ${slot} — ${type}`;
      const badge=document.getElementById('scsv-selected-track-state');
      badge.dataset.loaded=loaded?'true':'false';
      badge.textContent=loaded?'Imported':'Empty';
      const summary=document.getElementById('scsv-track-summary');
      if (loaded) {
        const noteCount = Number.isFinite(loaded.summary?.noteEvents)
          ? loaded.summary.noteEvents
          : Array.isArray(loaded.studioEvents) ? loaded.studioEvents.length : null;
        const countText = noteCount===null ? '' :
          `${noteCount.toLocaleString()} ${slot>=5?'drum hits':'note events'} · `;
        const selectedInstrument = document.getElementById('sidebarInstrument')?.textContent?.trim();
        const instrumentText = selectedInstrument && selectedInstrument !== 'Test piano synth'
          ? `${selectedInstrument} · ` : '';
        summary.textContent = instrumentText + countText +
          `${song?.totalMeasures ?? '—'} measures`;
      } else {
        summary.textContent = `${type} · No source file imported for this track`;
      }
      importAction.textContent = `${loaded?'Replace':'Import'} ${supportedMidi?'CSV or MIDI':'CSV'}`;
      importAction.title = `Choose ${supportedMidi?'CSV or MIDI':'CSV'} for Track ${slot}`;
    }
    function updateCSVExport(){
      const slot=activeSlot();
      const loaded=Boolean(session.tracks[slot-1]);
      exportText.textContent=loaded?`Track ${slot} · Authoritative SymphonyCSV source`:
        `Track ${slot} · Import a CSV or MIDI before exporting`;
      csvExportButton.disabled=!loaded;
      csvExportButton.title=loaded?`Download validated source CSV for Track ${slot}`:
        `Track ${slot} has no imported musical CSV`;
      refreshOverview();
    }
    function downloadCSVSource(){
      const slot=activeSlot();
      try{
        const accepted=window.SymphonyCSVSessionSources.getSlot(slot);
        if(!accepted)return;
        const filename=/\.csv$/i.test(accepted.filename)?accepted.filename:`Track_${String(slot).padStart(2,'0')}_SymphonyCSV.csv`;
        const blob=new Blob([accepted.csvText],{type:'text/csv;charset=utf-8'});
        const downloadURL=URL.createObjectURL(blob);
        const anchor=document.createElement('a');
        anchor.href=downloadURL;anchor.download=filename;
        anchor.style.display='none';document.body.append(anchor);anchor.click();anchor.remove();
        setTimeout(()=>URL.revokeObjectURL(downloadURL),30000);
        displayStatus(`Downloaded Track ${slot} authoritative SymphonyCSV: ${filename}`,'ok');
      }catch(err){displayStatus(`CSV download unavailable: ${err?.message||String(err)}`,'error');}
    }
    csvExportButton.addEventListener('click',downloadCSVSource);
    for(const tab of trackTabs)tab.addEventListener('click',updateCSVExport);
    window.addEventListener('symphonycsv:source-accepted',updateCSVExport);
    window.addEventListener('symphonycsv:session-changed',updateCSVExport);
    updateEditingAction();
    updateCSVExport();
    const displayStatus = (message, outcome = 'info') => {
      status.dataset.result = outcome;
      status.textContent = message;
    };

    // Accepted source copies exist in memory until the user explicitly saves.
    // No browser persistence occurs on import or on a timer.
    const acceptedSources = Array(6).fill(null);
    let recoveryInProgress = false;
    window.SymphonyCSVSessionSources = {
      getSlot(slot) {
        if(!Number.isInteger(slot) || slot<1 || slot>6) return null;
        if(!session.tracks[slot-1])return null;
        const entry=acceptedSources[slot-1];
        if(!entry || entry.filename!==session.filenames[slot-1])
          throw Error('Authoritative CSV source for Track '+slot+' is unavailable. Reimport before exporting.');
        return {...entry};
      },
      getAccepted() {
        return session.tracks.map((track,index) => {
          if (!track) return null;
          const entry = acceptedSources[index];
          if (!entry || entry.filename !== session.filenames[index])
            throw Error('Validated CSV source is unavailable for Track '+(index+1)+'. Reimport it before saving.');
          return {...entry};
        }).filter(Boolean);
      }
    };
    // PROJECTS: separate from Save to Browser / Recover Session.
    // This private source bridge is invoked only after full ZIP preflight and
    // staging. Every source and absent slot is replaced in a single handoff.
    window.SymphonyCSVProjectSourcesRuntime = Object.freeze({
      capture(){return acceptedSources.map(s=>s?{...s}:null);},
      replace(entries,filenames){
        if(!Array.isArray(entries)||!Array.isArray(filenames)||filenames.length!==6)
          throw Error('Invalid project source replacement.');
        const next=Array(6).fill(null);
        for(const entry of entries){
          if(!Number.isInteger(entry?.slot)||entry.slot<1||entry.slot>6||
            entry.filename!==filenames[entry.slot-1]||typeof entry.csvText!=='string'||
            next[entry.slot-1])throw Error('Invalid project source identity.');
          next[entry.slot-1]={slot:entry.slot,filename:entry.filename,csvText:entry.csvText};
        }
        for(let i=0;i<6;i++){
          if(Boolean(next[i])!==Boolean(filenames[i]))
            throw Error('Project source coverage mismatch.');
        }
        acceptedSources.splice(0,6,...next);
      }
    });
    function rememberAccepted(slot,filename,csvText) {
      acceptedSources[slot-1] = {slot,filename,csvText};
      window.dispatchEvent(new CustomEvent('symphonycsv:source-accepted',{detail:{slot}}));
    }
    async function importFile(file,recoverySlot=null) {
      if (!file) return;
      if (recoveryInProgress && recoverySlot===null)
        throw Error('Session recovery is in progress.');
      const slot = recoverySlot===null ? activeSlot() : Number(recoverySlot);
      if (!Number.isInteger(slot) || slot<1 || slot>6)
        throw Error('Invalid musical track slot.');
      if (!/\.csv$/i.test(file.name)) {
        displayStatus('Only SymphonyCSV (.csv) files are accepted in Studio.','error');
        return;
      }
      displayStatus(`Reading ${file.name} for Track ${slot}…`);
      try {
        const originalCSVText = await file.text();
        // SCVS_STEP100_TRACK3_TAB_IMPORT
        // Track 3 has its own authoritative TAB CSV schema.
        // Do not pass it through the Pitched importer.
        if (slot === 3 || slot === 4) {
          // SCVS_STEP265_DUAL_TAB_IMPORT
          const [{ importTabText }, { tabImportToStudioEvents }] =
            await Promise.all([
              import('/SymphonyCSV_TAB_WASM_Import_Bridge_v01.mjs'),
              import('/SymphonyCSV_TAB_Studio_Transport_v01.mjs')
            ]);

          // All validation must finish before session mutation.
          const importedTab = await importTabText(
            originalCSVText,
            file.name
          );

          importedTab.song = window.SymphonyCSVTiming.prepareSong(
            importedTab.song, importedTab.records, importedTab.headers
          );

          const studioEvents = tabImportToStudioEvents(
            importedTab,
            slot
          );

          // SCVS_STEP143_TAB_COMPOSITION_AUTHORITY
          // Compare all six properties before modifying the session.
          if (!importedTab.song) {
            throw new Error('TAB composition metadata is missing.');
          }

          const agreement = importer.compareSong(
            session.song,
            importedTab.song
          );

          if (!agreement.ok) {
            displayStatus(
              `Track ${slot} rejected: ${agreement.mismatches.join('; ')}`,
              'error'
            );
            return;
          }

          window.SymphonyCSVWAVRuntime?.assertSongCompatible?.(importedTab.song);
          if (session.tracks[slot - 1] && !window.confirm(
             `Track ${slot} already contains TAB data. Replace it?`
          )) {
            displayStatus(
              'TAB import cancelled. Existing CSV preserved.'
            );
            return;
          }

          session.tracks[slot - 1] = {
            ...importedTab,
            studioEvents,
            summary: {
              noteEvents: studioEvents.length,
              csvColumns: importedTab.columnCount,
              dataRows: importedTab.rowCount
            }
          };
          session.filenames[slot - 1] = file.name;
          if (!session.song) session.song = importedTab.song;

          const used = session.tracks.filter(Boolean).length;

          displayStatus(
            `Track ${slot} TAB validated: ${file.name} - ` +
            `${studioEvents.length} notes - ${used}/6 imported. ` +
            'TAB CSV validated and stored in its independent track slot.',
            'ok'
          );

          console.info('Track '+slot+' Rust/WASM TAB import accepted', {
            filename: file.name,
            columns: importedTab.columnCount,
            notes: studioEvents.length,
            studioTrack: slot
          });

          // SCVS_STEP103_TAB3_SESSION_NOTIFICATION
          // Refresh the existing Track 3 placeholder.
          // This does not indicate that audio is connected.
          window.dispatchEvent(new CustomEvent(
            'symphonycsv:session-changed',
            { detail: { slot, appliedToPlayer: false } }
          ));
          rememberAccepted(slot,file.name,originalCSVText);
          return;
        }

        // SCVS_STEP104_BUNDLED_DRUMS: validate music, map the selected fixed
        // bundled kit and project onto the shared CSV clock BEFORE mutation.
        if (slot === 5 || slot === 6) {
          const [{importDrumText},{BUNDLED_DRUM_KITS,
            parseDrumKitProfile,projectDrumTrack}] = await Promise.all([
              import('/SymphonyCSV_Drums_WASM_Import_Bridge_v01.mjs'),
              import('/SymphonyCSV_Drums_Studio_Transport_v01.mjs')
            ]);

          const importedDrums = await importDrumText(originalCSVText, file.name);
          const agreement = importer.compareSong(session.song, importedDrums.song);
          if (!agreement.ok) {
            displayStatus(`Track ${slot} rejected: ${agreement.mismatches.join('; ')}`,'error');
            return;
          }
          window.SymphonyCSVWAVRuntime?.assertSongCompatible?.(importedDrums.song);
          const timing = window.SymphonyCSVTiming.create(session.song || importedDrums.song);
          const kit = BUNDLED_DRUM_KITS[slot];
          const profileResponse = await fetch(kit.profileUrl);
          if (!profileResponse.ok) throw Error(
            `Bundled Track ${slot} drum-kit mapping unavailable: HTTP ${profileResponse.status}`);
          const mappings = parseDrumKitProfile(
            await profileResponse.text(), importer.parseCSV);
          const studioEvents = projectDrumTrack(importedDrums,slot,mappings,timing);

          if (session.tracks[slot-1] && !window.confirm(
            `Track ${slot} already contains Drums data. Replace it?`
          )) {
            displayStatus('Drums import cancelled. Existing CSV preserved.');
            return;
          }

          session.tracks[slot-1] = {
            ...importedDrums,studioEvents,kitName:kit.name,
            summary:{...importedDrums.summary,noteEvents:studioEvents.length}
          };
          session.filenames[slot-1] = file.name;
          if (!session.song) session.song = importedDrums.song;
          const used = session.tracks.filter(Boolean).length;
          displayStatus(
            `Track ${slot} ${kit.name} ready: ${studioEvents.length} hits, `+
            `${session.song.totalMeasures} measures · ${used}/6 imported. `+
            'SoundFont audio uses the shared composition clock.', 'ok'
          );
          window.dispatchEvent(new CustomEvent('symphonycsv:session-changed', {
            detail:{slot,appliedToPlayer:true}
          }));
          console.info('Rust/WASM drums connected to Studio', {
            slot,hitCount:studioEvents.length,profile:kit.profileUrl
          });
          rememberAccepted(slot,file.name,originalCSVText);
          return true;
        }
        // Parse and validate before modifying any session slot.
        const { importText: importTextWasm } =
          await import('/SymphonyCSV_WASM_Import_Bridge_v01.js');
        const parsed = await importTextWasm(
          originalCSVText, file.name
        );
        parsed.song = window.SymphonyCSVTiming.prepareSong(
          parsed.song, parsed.rows
        );
        const agreement = importer.compareSong(session.song, parsed.song);
        if (!agreement.ok) {
          displayStatus(`Track ${slot} rejected: ${agreement.mismatches.join('; ')}`, 'error');
          return;
        }
        window.SymphonyCSVWAVRuntime?.assertSongCompatible?.(parsed.song);
        if (session.tracks[slot - 1] && !window.confirm(
          `Track ${slot} already has a validated CSV. Replace its in-memory import?`
        )) {
          displayStatus('Import cancelled. Existing in-memory CSV preserved.');
          return;
        }
        // Let the existing player accept or reject a new Track 1 data set
        // BEFORE modifying the validated CSV session. On Track 2–6, this
        // intentionally returns false; their audio/editor bridges come later.
        const appliedToPlayer = typeof window.SymphonyCSVApplyTrack === 'function'
          ? window.SymphonyCSVApplyTrack(slot, parsed, session) === true
          : false;
        session.tracks[slot - 1] = parsed;
        session.filenames[slot - 1] = file.name;
        if (!session.song) session.song = parsed.song;
        const used = session.tracks.filter(Boolean).length;
        displayStatus(
          `Validated Track ${slot}: ${file.name} · ${parsed.summary.noteEvents} notes · ` +
          `${parsed.song.totalMeasures} measures · ${used}/6 imported. ` +
          (appliedToPlayer ? 'Track '+slot+' is connected to the shared player.' :
            'CSV validated; this track is not yet connected to audio.'),
          'ok'
        );
        window.dispatchEvent(new CustomEvent('symphonycsv:session-changed', {
          detail: { slot, appliedToPlayer }
        }));
        console.info('SymphonyCSV import validation passed',{
          slot, filename:file.name, notes:parsed.summary.noteEvents,
          song:parsed.song, csvColumns:parsed.summary.csvColumns
        });
        rememberAccepted(slot,file.name,originalCSVText);
        return true; // Only after Rust/WASM validation and session acceptance.
      } catch (err) {
        console.error('SymphonyCSV import rejected', err);
        displayStatus(`Track ${slot} rejected: ${err?.message || String(err)}`, 'error');
      }
    }

    // MIDI V2: reuse the same transactional Rust/WASM importFile path for
    // pitched (1/2) and Drums (5/6). TAB (3/4) remains native CSV only.
    window.SymphonyCSVImportMidiCSV = async function({slot, filename, csvText}) {
      const target = Number(slot);
      if (![1,2,5,6].includes(target))
        throw Error('Direct MIDI loading supports Piano Roll 1/2 or Drums 5/6.');
      if (typeof csvText !== 'string' || !csvText.length || csvText.length > 30_000_000)
        throw Error('Generated SymphonyCSV must be nonempty and under 30 MB.');
      if (typeof filename !== 'string' || !/^Track_0[1256]_[\w.-]+_SymphonyCSV\.csv$/i.test(filename))
        throw Error('Generated filename is not a valid Track 1/2/5/6 SymphonyCSV filename.');
      if (Number(filename.slice(6,8)) !== target)
        throw Error('CSV filename and requested target track disagree.');
      const file = new File([csvText], filename, {type:'text/csv'});
      return await importFile(file, target) === true;
    };

    // Legacy callable for existing Piano Roll integrations.
    window.SymphonyCSVImportPitchedCSV = async args => {
      if (![1,2].includes(Number(args?.slot))) throw Error('Expected Piano Roll Track 1/2.');
      return window.SymphonyCSVImportMidiCSV(args);
    };

    // Check all six track types via authoritative Rust/WASM *before* altering
    // any live track. This reduces (but cannot eliminate) partial restore risk
    // if browser resources disappear in the middle of reconstruction.
    window.SymphonyCSVPreflightRecoveryFromCSV = async function(entries) {
      if (!Array.isArray(entries) || entries.length<1 || entries.length>6)
        throw Error('Invalid saved musical track list.');
      let referenceSong=null;
      const unique=new Set();
      for (const entry of entries) {
        const slot=Number(entry.slot);
        if (!Number.isInteger(slot)||slot<1||slot>6||unique.has(slot))
          throw Error('Duplicate or invalid recovery Track '+slot+'.');
        unique.add(slot);
        let candidate;
        if (slot===3 || slot===4) {
          const [{importTabText},{tabImportToStudioEvents}]=await Promise.all([
            import('/SymphonyCSV_TAB_WASM_Import_Bridge_v01.mjs'),
            import('/SymphonyCSV_TAB_Studio_Transport_v01.mjs')
          ]);
          const tab=await importTabText(entry.csvText,entry.filename);
          candidate=window.SymphonyCSVTiming.prepareSong(tab.song,tab.records,tab.headers);
          tabImportToStudioEvents({...tab,song:candidate},slot);
        } else if (slot===5 || slot===6) {
          const [{importDrumText},{BUNDLED_DRUM_KITS,
            parseDrumKitProfile,projectDrumTrack}]=await Promise.all([
            import('/SymphonyCSV_Drums_WASM_Import_Bridge_v01.mjs'),
            import('/SymphonyCSV_Drums_Studio_Transport_v01.mjs')
          ]);
          const drums=await importDrumText(entry.csvText,entry.filename);
          candidate=drums.song;
          const timing=window.SymphonyCSVTiming.create(referenceSong||candidate);
          const profileResponse=await fetch(BUNDLED_DRUM_KITS[slot].profileUrl);
          if (!profileResponse.ok)throw Error('Track '+slot+' drum mapping is unavailable.');
          const mappings=parseDrumKitProfile(
            await profileResponse.text(),importer.parseCSV);
          projectDrumTrack(drums,slot,mappings,timing);
        } else {
          const {importText}=await import('/SymphonyCSV_WASM_Import_Bridge_v01.js');
          const pitched=await importText(entry.csvText,entry.filename);
          candidate=window.SymphonyCSVTiming.prepareSong(pitched.song,pitched.rows);
        }
        const compared=importer.compareSong(referenceSong,candidate);
        if (!compared.ok)throw Error('Saved Track '+slot+
          ' does not belong to the same composition: '+compared.mismatches.join('; '));
        if (!referenceSong)referenceSong=candidate;
      }
      return referenceSong;
    };

    // Recover uses precisely the existing Rust/WASM-controlled importer.
    // Recovery is intentionally restricted to a blank musical session.
    window.SymphonyCSVRecoverSessionFromCSV = async function(entries) {
      if (recoveryInProgress) throw Error('Recovery already in progress.');
      if (!Array.isArray(entries) || entries.length<1 || entries.length>6)
        throw Error('Recovery requires one to six musical CSV tracks.');
      if (session.tracks.some(Boolean))
        throw Error('Recovery requires an empty Studio. Confirm reload before restoring.');
      if (new Set(entries.map(t=>t.slot)).size!==entries.length)
        throw Error('Duplicate recovery slots.');
      recoveryInProgress=true;
      try {
        for (const entry of entries) {
          if (!Number.isInteger(entry.slot) || entry.slot<1 || entry.slot>6)
            throw Error('Invalid recovery slot.');
          if (session.tracks[entry.slot-1]) throw Error('Recovery slot already occupied.');
          const file = new File([entry.csvText],entry.filename,{type:'text/csv'});
          await importFile(file,entry.slot);
          if (!session.tracks[entry.slot-1] ||
              session.filenames[entry.slot-1]!==entry.filename ||
              acceptedSources[entry.slot-1]?.csvText!==entry.csvText)
            throw Error('Track '+entry.slot+' failed the normal CSV import validation.');
        }
        return session;
      } finally {recoveryInProgress=false;}
    };

    // The MIDI handoff is a request to the Studio-owned workspace launcher.
    // The converter never mutates Studio state directly.
    function routeNativeFile(file) {
      if (!file) return;
      if (/\.midi?$/i.test(file.name)) {
        const slot = activeSlot();
        if (![1,2,5,6].includes(slot)) {
          displayStatus('MIDI conversion supports Piano Roll Tracks 1–2 and Drum Tracks 5–6; TAB Tracks 3–4 accept CSV only.', 'error');
          return;
        }
        if (typeof window.SymphonyCSVOpenMidiWorkspace !== 'function') {
          displayStatus('MIDI workspace bridge is not available. CSV import remains available.', 'error');
          return;
        }
        window.SymphonyCSVOpenMidiWorkspace(slot, file);
        return;
      }
      void importFile(file);
    }

    leftHeader.addEventListener('click', event => {
      if (event.target.closest('a,button,input,select,textarea')) return;
      input.click();
    });
    leftHeader.addEventListener('keydown', event => {
      if (event.target !== leftHeader) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        input.click();
      }
    });
    leftHeader.addEventListener('dragenter', event => {
      event.preventDefault(); leftHeader.classList.add('scsv-over');
    });
    leftHeader.addEventListener('dragover', event => {
      event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
      leftHeader.classList.add('scsv-over');
    });
    leftHeader.addEventListener('dragleave', event => {
      if (!leftHeader.contains(event.relatedTarget)) leftHeader.classList.remove('scsv-over');
    });
    leftHeader.addEventListener('drop', event => {
      event.preventDefault();leftHeader.classList.remove('scsv-over');
      const files = event.dataTransfer?.files;
      if (files?.length !== 1) {
        displayStatus('Drop exactly one CSV or MIDI file at a time.','error');
        return;
      }
      routeNativeFile(files[0]);
    });
    input.addEventListener('change', () => {
      const selected = input.files?.[0];
      input.value = ''; // Picking the same file again must trigger change.
      routeNativeFile(selected);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once:true });
  } else initialize();
})();
