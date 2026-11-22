/* SymphonyCSV Studio — P070 Master Monitor.
 * Display-only 16-band spectrum of the LIVE post-limiter audio signal.
 * AnalyserNode is attached as a passive leaf; the existing limiter -> speaker
 * connection remains untouched. No analyser is added to offline rendering.
 */

export const MASTER_MONITOR_BANDS = 16;
export const MASTER_MONITOR_SEGMENTS = 12;

// Equal log-frequency bands, roughly the familiar 1980s spectrum-analyzer look.
// This is a spectrum visualization, not a calibrated dBFS or clipping meter.
export function spectrumBandValues(bytes, sampleRate, fftSize, count=MASTER_MONITOR_BANDS) {
  if (!(bytes instanceof Uint8Array) || !Number.isFinite(sampleRate) || sampleRate <= 0 ||
      !Number.isFinite(fftSize) || fftSize <= 0 || !Number.isInteger(count) || count < 1)
    throw new TypeError('Invalid spectrum data.');
  const nyquist=sampleRate/2;
  const minHz=50, maxHz=Math.min(16000,nyquist*.95);
  const values=new Array(count).fill(0);
  if(maxHz<=minHz || bytes.length===0)return values;
  const ratio=maxHz/minHz;
  for(let band=0;band<count;band++){
    const lo=minHz*Math.pow(ratio,band/count);
    const hi=minHz*Math.pow(ratio,(band+1)/count);
    const first=Math.max(1,Math.min(bytes.length-1,Math.floor(lo*fftSize/sampleRate)));
    const last=Math.max(first,Math.min(bytes.length-1,Math.ceil(hi*fftSize/sampleRate)));
    let maximum=0;
    for(let bin=first;bin<=last;bin++)maximum=Math.max(maximum,bytes[bin]);
    // Deliberate quiet floor, preventing an ambient/noise-floor glow.
    values[band]=Math.max(0,Math.min(MASTER_MONITOR_SEGMENTS,
      Math.round((maximum-52)*MASTER_MONITOR_SEGMENTS/(255-52))));
  }
  return values;
}

export function createMasterMonitor({document,bridge}={}) {
  const display=document?.getElementById?.('scsv-master-spectrum');
  const status=document?.getElementById?.('scsv-master-monitor-status');
  if(!display || !status || !bridge)return {update(){},destroy(){}};

  const columns=[];
  for(let band=0;band<MASTER_MONITOR_BANDS;band++){
    const column=document.createElement('div');
    column.className='scsv-master-band';
    column.setAttribute('aria-hidden','true');
    const segments=[];
    // Topmost high segment first; DOM grid flows top-to-bottom.
    for(let level=MASTER_MONITOR_SEGMENTS;level>=1;level--){
      const cell=document.createElement('span');
      cell.className='scsv-master-segment';
      cell.dataset.zone=level>=11?'clip':level>=8?'upper':'normal';
      column.appendChild(cell);
      segments.push({cell,level});
    }
    display.appendChild(column);
    columns.push(segments);
  }

  let ctx=null,limiter=null,analyser=null,fftData=null;
  let lastTick=-Infinity,lastRender=0,active=false;
  const levelValues=new Array(MASTER_MONITOR_BANDS).fill(0);
  const peaks=new Array(MASTER_MONITOR_BANDS).fill(0);
  const peakHeldUntil=new Array(MASTER_MONITOR_BANDS).fill(0);

  function setStatus(value,live=false){
    if(status.textContent!==value)status.textContent=value;
    status.dataset.live=live?'true':'false';
  }
  function draw(){
    for(let i=0;i<MASTER_MONITOR_BANDS;i++){
      const lit=Math.round(levelValues[i]);
      const peak=Math.round(peaks[i]);
      for(const {cell,level} of columns[i]){
        cell.classList.toggle('is-lit',level<=lit);
        cell.classList.toggle('is-peak',peak>0 && level===peak);
      }
    }
  }
  function clear(){
    if(!active)return;
    active=false;
    levelValues.fill(0);peaks.fill(0);peakHeldUntil.fill(0);
    draw();
  }
  function detach(){
    if(limiter && analyser){
      // Disconnect ONLY the monitor leaf, NEVER the limiter's speaker link.
      try{limiter.disconnect(analyser);}catch{}
    }
    ctx=null;limiter=null;analyser=null;fftData=null;
  }
  function attach(live){
    if(!live?.ctx || !live?.limiter)return false;
    if(live.ctx===ctx && live.limiter===limiter && analyser)return true;
    detach();
    if(typeof live.ctx.createAnalyser!=='function')return false;
    const node=live.ctx.createAnalyser();
    node.fftSize=4096;
    node.minDecibels=-90;
    node.maxDecibels=-12;
    node.smoothingTimeConstant=.72;
    try {
      // Passive tap. It deliberately has NO connection to ctx.destination.
      live.limiter.connect(node);
    }catch{
      return false;
    }
    ctx=live.ctx;limiter=live.limiter;analyser=node;
    fftData=new Uint8Array(node.frequencyBinCount);
    return true;
  }
  function update(timestamp){
    const now=Number.isFinite(timestamp)?timestamp:0;
    if(now-lastTick<32)return; // about 30 FPS, independently of transport FPS
    const dt=lastRender?Math.min(.2,Math.max(0,(now-lastRender)/1000)):.033;
    lastTick=now;lastRender=now;
    let playing=false,output=null;
    try{playing=!!bridge.playing();output=bridge.output();}
    catch{clear();setStatus('STANDBY');return;}
    if(!playing || document.hidden){
      clear();
      setStatus(output?'READY':'STANDBY');
      return;
    }
    if(!attach(output)){
      clear();setStatus('UNAVAILABLE');return;
    }
    try{analyser.getByteFrequencyData(fftData);}
    catch{clear();setStatus('UNAVAILABLE');return;}
    const wanted=spectrumBandValues(fftData,ctx.sampleRate,analyser.fftSize);
    for(let i=0;i<MASTER_MONITOR_BANDS;i++){
      const target=wanted[i];
      levelValues[i]=target>=levelValues[i]?target:Math.max(target,levelValues[i]-dt*14);
      if(target>=peaks[i]){
        peaks[i]=target;
        peakHeldUntil[i]=now+360;
      } else if(now>peakHeldUntil[i]){
        peaks[i]=Math.max(levelValues[i],peaks[i]-dt*8);
      }
    }
    draw();active=true;
    setStatus('LIVE',true);
  }
  function destroy(){clear();detach();}
  setStatus('STANDBY');
  return {update,destroy};
}

if(typeof window!=='undefined' && window.document){
  window.SymphonyCSVMasterMonitor=createMasterMonitor({
    document:window.document,
    bridge:window.SymphonyCSVMasterMonitorBridge
  });
}
