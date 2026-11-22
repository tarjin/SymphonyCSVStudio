/* P068 — non-destructive WAV asset and clock-time contract. No DOM, transport,
 * session, or filesystem mutation. Shared by import, ZIP validation and tests.
 */
export const WAV_MAX_BYTES=256*1024*1024;
export const WAV_MAX_DURATION_MS=60*60*1000;
const fail=(reason)=>{throw Error(reason);};
const requireTrue=(condition,why)=>{if(!condition)fail(why);};
const readTag=(view,i)=>String.fromCharCode(view.getUint8(i),view.getUint8(i+1),view.getUint8(i+2),view.getUint8(i+3));
export function inspectWavBytes(input){
  const bytes=input instanceof Uint8Array?input:input instanceof ArrayBuffer?new Uint8Array(input):null;
  requireTrue(bytes&&bytes.byteLength>=44&&bytes.byteLength<=WAV_MAX_BYTES,'WAV is empty, oversized, or invalid.');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  requireTrue(readTag(v,0)==='RIFF'&&readTag(v,8)==='WAVE','Only RIFF/WAVE files are supported.');
  const riffSize=v.getUint32(4,true)+8;
  requireTrue(riffSize>=44&&riffSize<=bytes.length,'WAV RIFF length does not match the file.');
  let at=12,fmt=null,dataBytes=0;
  while(at+8<=riffSize){
    const name=readTag(v,at),size=v.getUint32(at+4,true),start=at+8;
    requireTrue(size<=riffSize-start,'WAV contains a truncated or invalid chunk.');
    if(name==='fmt '){
      requireTrue(fmt===null&&size>=16,'WAV has a missing or duplicate fmt chunk.');
      let codec=v.getUint16(start,true);
      if(codec===0xfffe){
        requireTrue(size>=40&&v.getUint16(start+16,true)>=22,'Invalid extended WAV fmt chunk.');
        codec=v.getUint16(start+24,true); // SubFormat GUID first uint16 (PCM or IEEE float)
        // Remaining GUID identifies standard KSDATAFORMAT_SUBTYPE family.
        const suffix=[0,0,16,0,128,0,0,170,0,56,155,113];
        for(let i=0;i<12;i++)requireTrue(v.getUint8(start+28+i)===suffix[i],
          'Unsupported WAV extensible subtype.');
      }
      const channels=v.getUint16(start+2,true),sampleRate=v.getUint32(start+4,true);
      const byteRate=v.getUint32(start+8,true),blockAlign=v.getUint16(start+12,true),bits=v.getUint16(start+14,true);
      requireTrue([1,3].includes(codec)&&[1,2].includes(channels),'WAV must contain mono or stereo uncompressed PCM/float audio.');
      requireTrue(sampleRate>=8000&&sampleRate<=192000,'Unsupported WAV sample rate.');
      requireTrue((codec===1&&[8,16,24,32].includes(bits))||(codec===3&&[32,64].includes(bits)),
        'Unsupported WAV PCM/float sample depth.');
      requireTrue(blockAlign===channels*bits/8&&byteRate===sampleRate*blockAlign,'Invalid WAV sample alignment.');
      fmt={codec,channels,sampleRate,bits,blockAlign};
    }
    if(name==='data'){
      requireTrue(dataBytes===0&&size>0,'WAV data chunk is missing, empty or duplicated.');
      dataBytes=size;
    }
    at=start+size+(size%2);
  }
  requireTrue(fmt&&dataBytes>0&&dataBytes%fmt.blockAlign===0,'WAV needs aligned fmt and audio data chunks.');
  const durationMs=Math.round(dataBytes/fmt.blockAlign/fmt.sampleRate*1000);
  requireTrue(durationMs>=1&&durationMs<=WAV_MAX_DURATION_MS,'WAV duration is outside supported bounds.');
  return {...fmt,durationMs,dataBytes,frames:dataBytes/fmt.blockAlign,byteLength:bytes.length};
}
export function formatOnsetMs(ms){
  requireTrue(Number.isSafeInteger(ms)&&ms>=0,'Invalid WAV onset.');
  const hours=Math.floor(ms/3600000),minutes=Math.floor(ms/60000)%60,seconds=Math.floor(ms/1000)%60;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
}
export function parseOnsetClock(value){
  requireTrue(typeof value==='string','Onset must be a clock time (HH:MM:SS.mmm).');
  const m=/^(\d{2,4}):([0-5]\d):([0-5]\d)\.(\d{3})$/.exec(value.trim());
  requireTrue(m!==null,'Onset must use HH:MM:SS.mmm (for example 00:01:32.450).');
  const ms=(Number(m[1])*3600+Number(m[2])*60+Number(m[3]))*1000+Number(m[4]);
  requireTrue(Number.isSafeInteger(ms)&&ms<=2147483647,'Audio onset exceeds the supported time range.');
  return ms;
}
export function validateWavOnset(onsetMs,songDurationMs){
  requireTrue(Number.isSafeInteger(onsetMs)&&onsetMs>=0,'WAV onset must be a non-negative integer millisecond time.');
  requireTrue(Number.isFinite(songDurationMs)&&songDurationMs>0,'A valid musical composition must establish the song duration.');
  requireTrue(onsetMs<songDurationMs,
    `WAV onset ${formatOnsetMs(onsetMs)} must be before the final musical boundary ${formatOnsetMs(Math.round(songDurationMs))}. Extend Tracks 1–6 with empty measures, move or remove the WAV.`);
  return onsetMs;
}
export function wavClipWindow({onsetMs,durationMs,fromMs=0,toMs,songDurationMs=toMs,decayPaddingMs=0}){
  requireTrue(Number.isFinite(toMs)&&toMs>fromMs&&Number.isSafeInteger(decayPaddingMs)&&decayPaddingMs>=0,
    'Invalid WAV render window.');
  validateWavOnset(onsetMs,songDurationMs);
  const start=Math.max(fromMs,onsetMs);
  const end=Math.min(onsetMs+durationMs,toMs+decayPaddingMs);
  if(end<=start)return null;
  return {startMs:start,endMs:end,sourceOffsetMs:start-onsetMs,durationMs:end-start};
}
export function waveformPeaks(buffer,{samples=2000}={}){
  requireTrue(buffer&&buffer.numberOfChannels>=1&&buffer.numberOfChannels<=2&&buffer.length>0,
    'AudioBuffer is required for waveform visualization.');
  const count=Math.max(1,Math.min(20000,Math.floor(samples),buffer.length));
  const channels=[];
  for(let c=0;c<buffer.numberOfChannels;c++){
    const data=buffer.getChannelData(c),peaks=new Float32Array(count);
    for(let i=0;i<count;i++){
      const start=Math.floor(i*data.length/count),stop=Math.max(start+1,Math.floor((i+1)*data.length/count));
      let amplitude=0;
      for(let j=start;j<stop;j++)amplitude=Math.max(amplitude,Math.abs(data[j]));
      peaks[i]=Math.min(1,amplitude);
    }
    channels.push(peaks);
  }
  return channels;
}
