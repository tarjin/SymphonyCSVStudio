/* P068-U7 — one authoritative musical measure per WAV viewer page.
 * Pure view model: no independent clock, no audio scheduling or asset mutation.
 */
const assert=(condition,message)=>{if(!condition)throw Error(message);};
export function clampWavMeasure(timing, requested){
  assert(timing && Number.isSafeInteger(timing.totalMeasures) && timing.totalMeasures>0,
    'A validated musical composition is required for the WAV measure viewer.');
  const value=Number.isFinite(Number(requested))?Math.floor(Number(requested)):1;
  return Math.min(timing.totalMeasures,Math.max(1,value));
}
export function wavMeasureAtPosition(timing, positionMs){
  assert(timing && typeof timing.positionToMeasure==='function', 'Musical measure mapping is missing.');
  const pos=Number.isFinite(positionMs)?Math.max(0,Math.min(positionMs,Math.max(0,timing.endMs-0.001))):0;
  return clampWavMeasure(timing,timing.positionToMeasure(pos));
}
export function wavMeasureWindow(timing, requested){
  const measure=clampWavMeasure(timing,requested);
  const startMs=timing.measureStartMs(measure),endMs=timing.measureEndMs(measure);
  assert(Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs,
    'Invalid musical measure boundaries.');
  return {measure,totalMeasures:timing.totalMeasures,startMs,endMs,durationMs:endMs-startMs};
}
export function wavMeasurePlayheadFraction(window,positionMs){
  assert(window && window.durationMs>0, 'Invalid musical measure view.');
  return Math.max(0,Math.min(1,(positionMs-window.startMs)/window.durationMs));
}
export function wavMeasurePeakBins({peaks,durationMs,onsetMs,startMs,endMs,bins=500}){
  assert(Number.isSafeInteger(bins)&&bins>=1&&bins<=4096,'Invalid waveform width.');
  const result=new Float32Array(bins);
  if(!Array.isArray(peaks)||!peaks.length||!Number.isFinite(durationMs)||durationMs<=0)return result;
  assert(Number.isFinite(onsetMs)&&Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs,
    'Invalid WAV measure timing.');
  const total=peaks[0]?.length||0;if(!total)return result;
  const step=(endMs-startMs)/bins;
  for(let col=0;col<bins;col++){
    // Exact elapsed milliseconds, never snapped to a musical beat or barline.
    const from=startMs+col*step-onsetMs;
    const to=startMs+(col+1)*step-onsetMs;
    if(to<=0||from>=durationMs)continue;
    const lo=Math.max(0,Math.min(total-1,Math.floor(Math.max(0,from)/durationMs*total)));
    const hi=Math.max(lo+1,Math.min(total,Math.ceil(Math.min(durationMs,to)/durationMs*total)));
    let peak=0;
    for(const channel of peaks){
      if(!channel)continue;
      for(let i=lo;i<hi;i++)peak=Math.max(peak,channel[i]||0);
    }
    result[col]=Math.max(0,Math.min(1,peak));
  }
  return result;
}


/* P068-U8 — precise per-measure sample peaks, not 4,000 bins spread across a
 * whole song. Display analysis is read-only and never affects audio or timing.
 * Retain signed min/max samples so positive/negative contours are genuine.
 */
export function wavMeasureAudioSamplePeaks({buffer,durationMs,onsetMs,startMs,endMs,bins=1000}){
  assert(Number.isSafeInteger(bins)&&bins>=1&&bins<=4096,'Invalid waveform width.');
  assert(buffer&&Number.isSafeInteger(buffer.length)&&buffer.length>0&&
    Number.isSafeInteger(buffer.numberOfChannels)&&buffer.numberOfChannels>=1&&buffer.numberOfChannels<=2&&
    typeof buffer.getChannelData==='function','A decoded mono/stereo WAV is required.');
  assert(Number.isFinite(durationMs)&&durationMs>0&&Number.isFinite(onsetMs)&&onsetMs>=0&&
    Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs,'Invalid WAV measure timing.');
  const upper=new Float32Array(bins),lower=new Float32Array(bins);
  const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
  const samplesPerMs=buffer.length/durationMs;
  const msPerBin=(endMs-startMs)/bins;
  for(let col=0;col<bins;col++){
    const from=startMs+col*msPerBin-onsetMs;
    const to=startMs+(col+1)*msPerBin-onsetMs;
    if(to<=0||from>=durationMs)continue;
    const first=Math.max(0,Math.min(buffer.length-1,Math.floor(Math.max(0,from)*samplesPerMs)));
    const last=Math.max(first+1,Math.min(buffer.length,Math.ceil(Math.min(durationMs,to)*samplesPerMs)));
    let high=0,low=0;
    for(const samples of channels){
      for(let i=first;i<last;i++){
        const value=samples[i];
        if(value>high)high=value;
        if(value<low)low=value;
      }
    }
    upper[col]=Math.min(1,high);
    lower[col]=Math.max(-1,low);
  }
  return {upper,lower};
}

/* One display gain per complete WAV, computed from original full-song peak
 * summaries (nonzero p95); NEVER normalize individual measures independently.
 * 24x ceiling avoids exaggerating tiny noise into a solid slab. */
export function wavWaveformDisplayGain(peaks,{target=.82,maxGain=24}={}){
  assert(Number.isFinite(target)&&target>0&&target<=1&&
    Number.isFinite(maxGain)&&maxGain>=1&&maxGain<=100,'Invalid waveform display scaling.');
  if(!Array.isArray(peaks)||!peaks.length)return 1;
  const positive=[];
  for(const channel of peaks){if(!channel)continue;
    for(const value of channel)if(Number.isFinite(value)&&value>0)positive.push(value);
  }
  if(!positive.length)return 1;
  positive.sort((a,b)=>a-b);
  const typical=positive[Math.min(positive.length-1,Math.floor((positive.length-1)*.95))];
  return Math.max(1,Math.min(maxGain,target/typical));
}

/* P068-U10 — precise recording extent within a musical measure.
 * The tint marks presence of WAV media, not audible signal level. It spans
 * silence too. Values are normalized to the authoritative measure window;
 * there is no independent audio clock or WAV-sample mutation.
 */
export function wavMeasureActiveRegion({onsetMs,durationMs,startMs,endMs}){
  if(![onsetMs,durationMs,startMs,endMs].every(Number.isFinite)||
     onsetMs<0||durationMs<=0||endMs<=startMs)return null;
  const begin=Math.max(startMs,onsetMs);
  const finish=Math.min(endMs,onsetMs+durationMs);
  if(finish<=begin)return null;
  const duration=endMs-startMs;
  return {startFraction:Math.max(0,Math.min(1,(begin-startMs)/duration)),
    endFraction:Math.max(0,Math.min(1,(finish-startMs)/duration))};
}
