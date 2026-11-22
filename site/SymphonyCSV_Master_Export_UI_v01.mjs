/* P061F: opt-in master audio download; no writes to manual browser sessions.
 * MP3 encoder source: lamejs 1.2.1 (LGPL-3.0), loaded on demand.
 * The JS library is fetched; rendered audio never leaves the browser.
 * https://github.com/zhuker/lamejs | https://lame.sourceforge.net/
 */
import {analyzeMasterAudio,encodeMasterWav,encodeMasterMp3} from './SymphonyCSV_Master_Export_v01.mjs';

const MP3_ENCODER_URL='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
let encoderPromise=null;
export async function loadMasterMp3Encoder(host=window,documentRoot=document){
  if(typeof host.lamejs?.Mp3Encoder==='function')return host.lamejs.Mp3Encoder;
  if(!encoderPromise){
    encoderPromise=new Promise((resolve,reject)=>{
      const tag=documentRoot.createElement('script');
      tag.src=MP3_ENCODER_URL;tag.async=true;
      tag.onload=()=>{
        if(typeof host.lamejs?.Mp3Encoder!=='function'){
          reject(Error('Downloaded MP3 library has no Mp3Encoder.'));return;
        }
        resolve(host.lamejs.Mp3Encoder);
      };
      tag.onerror=()=>reject(Error('Cannot download the MP3 encoder library. Internet access is required once per page. WAV export still works offline.'));
      documentRoot.head.appendChild(tag);
    }).catch(error=>{encoderPromise=null;throw error;});
  }
  return encoderPromise;
}
export function initializeMasterExportUI({root=document,host=window,loadEncoder=loadMasterMp3Encoder}={}){
  const wav=root.getElementById('scsv-master-wav');
  const mp3=root.getElementById('scsv-master-mp3');
  const label=root.getElementById('scsv-master-status');
  const panel=root.getElementById('scsv-master-progress');
  const meter=root.getElementById('scsv-master-progress-meter');
  const phaseText=root.getElementById('scsv-master-progress-phase');
  const elapsedText=root.getElementById('scsv-master-progress-elapsed');
  const activity=root.getElementById('scsv-master-progress-log');
  if(!wav||!mp3||!label||!panel||!meter||!phaseText||!elapsedText||!activity)return false;
  if(wav.dataset.masterExportReady==='yes')return true;
  wav.dataset.masterExportReady='yes';
  let busy=false,startedAt=0,elapsedTimer=null,lastLogKey='',activeFormat='';
  const status=(text,state='')=>{label.textContent=text;label.dataset.state=state;};
  const refresh=()=>{
    const loaded=Boolean(host.SymphonyCSVImportSession?.tracks?.some(Boolean));
    wav.disabled=mp3.disabled=busy||!loaded;
    if(!busy&&!loaded)status('Import a musical track to enable master export.');
    else if(!busy&&label.textContent==='Import a musical track to enable master export.')
      status('Ready to export the currently loaded six-track mix.');
  };
  const clock=()=>{
    const seconds=Math.max(0,Math.floor((Date.now()-startedAt)/1000));
    return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  };
  const updateElapsed=()=>{if(busy)elapsedText.textContent=`Elapsed ${clock()}`;};
  function log(message,stamp=true){
    const item=root.createElement('li');
    item.textContent=stamp?`[${clock()}] ${message}`:message;
    activity.appendChild(item);
    while(activity.children.length>36)activity.removeChild(activity.firstChild);
    activity.scrollTop=activity.scrollHeight;
  }
  function progress(value){
    if(value===null||!Number.isFinite(value)){
      meter.removeAttribute('value');
      meter.setAttribute('aria-valuetext','Working; exact percentage unavailable');
    }else{
      meter.value=Math.max(0,Math.min(100,value));
      meter.setAttribute('aria-valuetext',`${Math.round(meter.value)}% of current stage`);
    }
  }
  function progressEvent(event){
    const data=typeof event==='string'?{message:event}:event||{};
    const message=String(data.message||'Working locally…');
    const percentage=Number.isFinite(data.percent)?data.percent:
      Number.isFinite(data.done)&&Number.isFinite(data.total)&&data.total>0?
        data.done/data.total*100:null;
    progress(percentage);
    phaseText.textContent=percentage===null?
      (data.phase==='render'?`${message} · exact percentage unavailable on this browser`:message):
      `${message} · ${Math.round(percentage)}% of this stage`;
    status(message);
    // Log stage transitions and meaningful increments, not every MIDI note.
    const bucket=percentage===null?'?':Math.floor(percentage/10)*10;
    const key=`${data.phase||message}:${bucket}`;
    if(key!==lastLogKey){lastLogKey=key;log(percentage===null?message:`${message} (${Math.round(percentage)}%)`);}
  }
  function download(blob,name){
    const uri=host.URL.createObjectURL(blob);
    try{
      const link=root.createElement('a');link.href=uri;link.download=name;
      link.style.display='none';root.body.appendChild(link);link.click();link.remove();
    }finally{host.setTimeout(()=>host.URL.revokeObjectURL(uri),60000);}
  }
  async function exportMaster(kind){
    if(busy)return;
    activeFormat=kind.toUpperCase();busy=true;startedAt=Date.now();lastLogKey='';
    panel.hidden=false;activity.textContent='';
    elapsedText.textContent='Elapsed 00:00';
    progress(null);
    wav.textContent=kind==='wav'?'Rendering WAV…':'Download Mix_All.wav';
    mp3.textContent=kind==='mp3'?'Rendering MP3…':'Download Mix_All.mp3';
    refresh();
    log(`Starting ${activeFormat} master export. Source audio stays on this computer.`);
    // Elapsed time is wall-clock, not a fabricated estimate of audio progress.
    elapsedTimer=host.setInterval?.(updateElapsed,1000)??null;
    try{
      const runtime=host.SymphonyCSVMasterMixRuntime;
      if(typeof runtime?.render!=='function')throw Error('Studio master mixer is not ready.');
      const rendered=await runtime.render({onProgress:progressEvent});
      progressEvent({phase:'analyze',message:'Checking rendered stereo audio…'});
      const report=analyzeMasterAudio(rendered.buffer);
      const warn=report.clippedSamples?
        ` Warning: ${report.clippedSamples} samples exceeded full scale and were clipped by the encoder.`:'';
      if(kind==='wav'){
        progressEvent({phase:'wav',message:'Encoding stereo PCM WAV locally…'});
        // Encoding WAV is synchronous; don't report fictional percent before done.
        const blob=encodeMasterWav(rendered.buffer);
        progressEvent({phase:'wav',percent:100,message:'WAV encoding completed'});
        download(blob,'Mix_All.wav');
        status(`Mix_All.wav downloaded · ${report.durationSeconds.toFixed(2)} s · 44.1 kHz stereo.${warn}`,'ok');
        log(`Download initiated: Mix_All.wav (${(blob.size/1048576).toFixed(1)} MiB).`);
      }else{
        progressEvent({phase:'library',message:'Loading MP3 encoder library (one-time download)…'});
        const Mp3Encoder=await loadEncoder(host,root);
        progressEvent({phase:'mp3',percent:0,message:'Encoding 320 kbps stereo MP3 locally…'});
        const blob=await encodeMasterMp3(rendered.buffer,(...args)=>new Mp3Encoder(...args),{
          onProgress:percent=>progressEvent({phase:'mp3',percent,message:'Encoding stereo MP3 locally…'})});
        download(blob,'Mix_All.mp3');
        status(`Mix_All.mp3 downloaded · ${report.durationSeconds.toFixed(2)} s · 320 kbps stereo.${warn}`,'ok');
        log(`Download initiated: Mix_All.mp3 (${(blob.size/1048576).toFixed(1)} MiB).`);
      }
      phaseText.textContent=`${activeFormat} master export complete`;
      progress(100);
    }catch(error){
      const message=`Master export failed: ${String(error?.message||error)}. No file downloaded.`;
      status(message,'error');phaseText.textContent='Export failed';progress(null);
      log(message);
      host.console?.error?.('P061F master export failed',error);
    }finally{
      updateElapsed();
      if(elapsedTimer!==null&&typeof host.clearInterval==='function')host.clearInterval(elapsedTimer);
      elapsedTimer=null;
      busy=false;wav.textContent='Download Mix_All.wav';
      mp3.textContent='Download Mix_All.mp3';refresh();
    }
  }
  wav.addEventListener('click',()=>exportMaster('wav'));
  mp3.addEventListener('click',()=>exportMaster('mp3'));
  host.addEventListener('symphonycsv:session-changed',refresh);
  host.addEventListener('symphonycsv:workspace-changed',refresh);
  refresh();
  return true;
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>initializeMasterExportUI());
  else initializeMasterExportUI();
}
