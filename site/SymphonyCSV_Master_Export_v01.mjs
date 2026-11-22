/* P061F — Master export encoding only. No filesystem, session storage or transport.
 * The source AudioBuffer is the exact offline Web Audio output of the Studio mixer.
 * PCM and MP3 use the SAME rendered samples. Never manufacture an MP3 extension.
 */
export const MASTER_SAMPLE_RATE=44100;
export const MASTER_MP3_KBPS=320;
const WINDOW=16384;
function requireStereo(buffer){
  if(!buffer||buffer.numberOfChannels!==2||buffer.sampleRate!==MASTER_SAMPLE_RATE||
    !Number.isSafeInteger(buffer.length)||buffer.length<1||
    typeof buffer.getChannelData!=='function')
    throw Error('Expected a nonempty 44.1 kHz stereo AudioBuffer.');
  const l=buffer.getChannelData(0),r=buffer.getChannelData(1);
  if(l.length!==buffer.length||r.length!==buffer.length)
    throw Error('Audio buffer channel lengths are inconsistent.');
  return [l,r];
}
function s16(value){
  if(!Number.isFinite(value))throw Error('Master contains a non-finite audio sample.');
  return Math.round(Math.max(-1,Math.min(1,value))* (value<0?32768:32767));
}
export function analyzeMasterAudio(buffer){
  const channels=requireStereo(buffer);
  let peak=0,clipped=0;
  for(const channel of channels)for(let i=0;i<buffer.length;i++){
    const abs=Math.abs(channel[i]);
    if(!Number.isFinite(abs))throw Error('Master contains invalid audio data.');
    peak=Math.max(peak,abs);
    if(abs>1)clipped++;
  }
  return {peak,clippedSamples:clipped,durationSeconds:buffer.length/buffer.sampleRate};
}
export function encodeMasterWav(buffer){
  const [l,r]=requireStereo(buffer),bytes=buffer.length*4;
  if(!Number.isSafeInteger(bytes)||bytes>0xFFFFFFFF-36)
    throw Error('Master exceeds the RIFF/WAV 4 GB file size limit.');
  const header=new ArrayBuffer(44),dv=new DataView(header);
  const ascii=(pos,text)=>{for(let i=0;i<text.length;i++)dv.setUint8(pos+i,text.charCodeAt(i));};
  ascii(0,'RIFF');dv.setUint32(4,36+bytes,true);ascii(8,'WAVE');
  ascii(12,'fmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);
  dv.setUint16(22,2,true);dv.setUint32(24,MASTER_SAMPLE_RATE,true);
  dv.setUint32(28,MASTER_SAMPLE_RATE*4,true);dv.setUint16(32,4,true);
  dv.setUint16(34,16,true);ascii(36,'data');dv.setUint32(40,bytes,true);
  // Chunked Blob parts avoid a second contiguous allocation the size of the
  // entire composition. This is important for six-minute master renders.
  const chunks=[header];
  for(let at=0;at<buffer.length;at+=WINDOW){
    const n=Math.min(WINDOW,buffer.length-at);
    const arr=new Uint8Array(n*4),out=new DataView(arr.buffer);
    for(let i=0;i<n;i++){
      out.setInt16(i*4,s16(l[at+i]),true);
      out.setInt16(i*4+2,s16(r[at+i]),true);
    }
    chunks.push(arr);
  }
  return new Blob(chunks,{type:'audio/wav'});
}
export async function encodeMasterMp3(buffer,createEncoder,{onProgress=()=>{}}={}){
  const [l,r]=requireStereo(buffer);
  if(typeof createEncoder!=='function')
    throw Error('An MP3 encoder is required. No MP3 file was produced.');
  const encoder=createEncoder(2,MASTER_SAMPLE_RATE,MASTER_MP3_KBPS);
  if(typeof encoder?.encodeBuffer!=='function'||typeof encoder?.flush!=='function')
    throw Error('Invalid MP3 encoder.');
  const parts=[];const granule=1152;
  for(let at=0;at<buffer.length;at+=granule){
    const count=Math.min(granule,buffer.length-at);
    const left=new Int16Array(count),right=new Int16Array(count);
    for(let i=0;i<count;i++){
      left[i]=s16(l[at+i]);right[i]=s16(r[at+i]);
    }
    const block=encoder.encodeBuffer(left,right);
    if(block?.length)parts.push(Uint8Array.from(block));
    // Keep browser controls responsive during long MP3 conversions. The
    // encoder remains entirely local; yielding only pumps the UI event loop.
    if((at/granule)%256===0){
      onProgress(Math.floor(100*at/buffer.length));
      await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  const end=encoder.flush();if(end?.length)parts.push(Uint8Array.from(end));
  if(!parts.length||parts.reduce((sum,b)=>sum+b.byteLength,0)<4)
    throw Error('MP3 encoder produced no valid audio data.');
  // MPEG frames or an optional ID3 tag. Never mislabel WAV data as MP3.
  const probe=parts[0];
  if(!((probe[0]===0x49&&probe[1]===0x44&&probe[2]===0x33)||
    (probe[0]===0xff&&(probe[1]&0xe0)===0xe0)))
    throw Error('MP3 encoder returned an invalid MPEG header.');
  onProgress(100);
  return new Blob(parts,{type:'audio/mpeg'});
}
