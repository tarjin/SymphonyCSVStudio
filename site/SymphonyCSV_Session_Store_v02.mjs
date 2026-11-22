/* SymphonyCSV Studio — manual browser session storage (Step 107).
 * No autosaving. One committed IndexedDB record replaces the prior record
 * atomically, only after the user presses Save to Browser.
 */
import {validateSoundFontAssets,verifySoundFontAssets} from './SymphonyCSV_SoundFont_Assets_v01.mjs';

export const SESSION_SCHEMA = 3;
const LEGACY_SESSION_SCHEMA = 2;
const DB_NAME = 'SymphonyCSVStudioManualSession_v2';
const STORE = 'saved_sessions';
const KEY = 'latest';
const MAX_CSV_CHARS = 20 * 1024 * 1024;
const MAX_AUDIO_BYTES = 512 * 1024 * 1024;
function requireThat(ok, message) { if (!ok) throw new Error(message); }
function cleanName(input, ext) {
  const value=String(input??'');
  requireThat(value.length>0 && value.length<=255 && !/[\\/\u0000-\u001f]/.test(value) && ext.test(value),
    'Saved filename is invalid: '+value.slice(0,40));
  return value;
}
function safeSong(input) {
  requireThat(input && typeof input==='object','Missing composition metadata.');
  const title=String(input.title??'').trim();
  const totalMeasures=Number(input.totalMeasures);
  const tempoBpm=Number(input.tempoBpm);
  const timeSignature=String(input.timeSignature??'');
  requireThat(title.length>0 && title.length<=500,'Composition title is invalid.');
  requireThat(Number.isInteger(totalMeasures)&&totalMeasures>0&&totalMeasures<=100000,'Invalid measure count.');
  requireThat(Number.isFinite(tempoBpm)&&tempoBpm>0,'Invalid tempo.');
  requireThat(/^\d+\/\d+$/.test(timeSignature),'Invalid time signature.');
  return {title,totalMeasures,tempoBpm,timeSignature,
    ticksPerQuarter:Number(input.ticksPerQuarter??input.tpq??0)};
}
function safeSettings(input) {
  requireThat(input && typeof input==='object' && !Array.isArray(input),'Session settings are missing.');
  const json=JSON.stringify(input);
  requireThat(json && json.length<=64000,'Session settings exceed the safe limit.');
  return JSON.parse(json);
}
const FX_KEYS=['chorus','delay','reverb'];
function safeAudioSettings(item){
  // Older saved records predate P069 and lack per-WAV mixer settings.
  const volume_percent=item.volume_percent??100;
  const muted=item.muted??false;
  const pan_position=item.pan_position??0;
  requireThat(Number.isSafeInteger(volume_percent)&&volume_percent>=0&&volume_percent<=100,
    'Saved WAV volume is invalid.');
  requireThat(typeof muted==='boolean','Saved WAV mute is invalid.');
  requireThat(Number.isSafeInteger(pan_position)&&pan_position>=-100&&pan_position<=100,
    'Saved WAV pan is invalid.');
  const sends={},sendMutes={};
  for(const key of FX_KEYS){
    const send=item.sends?.[key]??0,mute=item.sendMutes?.[key]??false;
    requireThat(Number.isSafeInteger(send)&&send>=0&&send<=100,
      'Saved WAV '+key+' send is invalid.');
    requireThat(typeof mute==='boolean','Saved WAV '+key+' mute is invalid.');
    sends[key]=send;sendMutes[key]=mute;
  }
  return {volume_percent,muted,pan_position,sends,sendMutes};
}
export function validateSession(input) {
  requireThat(input && (input.schema===SESSION_SCHEMA||input.schema===LEGACY_SESSION_SCHEMA),
    'Unsupported saved-session version.');
  const song=safeSong(input.song);
  requireThat(Array.isArray(input.tracks)&&input.tracks.length>=1&&input.tracks.length<=6,
    'Saved session requires one to six musical tracks.');
  const tracks=input.tracks.map(t=>{
    const slot=Number(t?.slot);
    requireThat(Number.isInteger(slot)&&slot>=1&&slot<=6,'Musical track slot must be 1–6.');
    const filename=cleanName(t.filename,/\.csv$/i);
    requireThat(typeof t.csvText==='string'&&t.csvText.length>0&&t.csvText.length<=MAX_CSV_CHARS,
      'CSV text is empty or too large.');
    requireThat(/^[0-9a-f]{64}$/i.test(t.sha256??''),'CSV fingerprint is invalid.');
    return {slot,filename,csvText:t.csvText,sha256:t.sha256.toLowerCase()};
  }).sort((a,b)=>a.slot-b.slot);
  requireThat(new Set(tracks.map(t=>t.slot)).size===tracks.length,'Duplicate musical track slots.');
  const audioClips=(input.audioClips??[]);
  requireThat(Array.isArray(audioClips)&&audioClips.length<=6,'Invalid audio clip list.');
  const clips=audioClips.map(c=>{
    const slot=Number(c?.slot);
    requireThat(Number.isInteger(slot)&&slot>=7&&slot<=12,'Audio track slot must be 7–12.');
    const filename=cleanName(c.filename,/\.(wav|mp3)$/i);
    requireThat(c.blob instanceof Blob && c.blob.size>0 && c.blob.size<=MAX_AUDIO_BYTES,
      'Audio clip data is missing or too large.');
    const onsetMs=Number(c.onsetMs);
    requireThat(Number.isFinite(onsetMs)&&onsetMs>=0,'Invalid audio onset.');
    requireThat(/^[0-9a-f]{64}$/i.test(c.sha256??''),'Audio fingerprint is invalid.');
    return {slot,filename,blob:c.blob,onsetMs,sha256:c.sha256.toLowerCase(),
      ...safeAudioSettings(c)};
  }).sort((a,b)=>a.slot-b.slot);
  requireThat(new Set(clips.map(c=>c.slot)).size===clips.length,'Duplicate audio slots.');
  const savedAt=String(input.savedAt??'');
  requireThat(/^\d{4}-\d\d-\d\dT/.test(savedAt)&&Number.isFinite(Date.parse(savedAt)),
    'Invalid save date.');
  const soundFonts=input.schema===LEGACY_SESSION_SCHEMA?null:
    validateSoundFontAssets(input.soundFonts,{requiredSlots:tracks.map(t=>t.slot)});
  if(soundFonts)requireThat(soundFonts.assignments.length===tracks.length,
    'A saved musical track has no SoundFont assignment.');
  return {schema:input.schema,song,tracks,audioClips:clips,soundFonts,
    settings:safeSettings(input.settings),savedAt};
}
// Exact source payload sizes (binary Blob lengths and UTF-8 source bytes), plus
// byte-measured UTF-8 record metadata. IndexedDB's private page overhead cannot
// be measured from the app without reporting misleading quota estimates.
export function savedSessionPayloadBytes(input){
  const value=validateSession(input);
  const encoder=new TextEncoder();
  const csvBytes=value.tracks.reduce((total,t)=>total+encoder.encode(t.csvText).byteLength,0);
  const audioBytes=value.audioClips.reduce((total,t)=>total+t.blob.size,0);
  // SF2 assets are deduplicated by SHA-256, and are each counted just once.
  const fontBytes=value.soundFonts?.assets.reduce((total,a)=>total+a.blob.size,0)??0;
  const metadata={...value,
    tracks:value.tracks.map(({csvText,...track})=>track),
    audioClips:value.audioClips.map(({blob,...clip})=>clip),
    soundFonts:value.soundFonts?{...value.soundFonts,
      assets:value.soundFonts.assets.map(({blob,...asset})=>asset)}:null};
  const metadataBytes=encoder.encode(JSON.stringify(metadata)).byteLength;
  return csvBytes+audioBytes+fontBytes+metadataBytes;
}
export function formatSessionPayloadBytes(bytes){
  requireThat(Number.isSafeInteger(bytes)&&bytes>=0,'Invalid saved-session payload size.');
  const units=['B','KiB','MiB','GiB'];
  let amount=bytes,i=0;
  while(amount>=1024&&i<units.length-1){amount/=1024;i++;}
  return i===0?`${amount} B`:`${amount.toFixed(amount<10?2:1)} ${units[i]}`;
}
async function sha256(bytes){
  requireThat(globalThis.crypto?.subtle,'Browser SHA-256 is unavailable. Use localhost or HTTPS.');
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function hashText(text){return sha256(new TextEncoder().encode(text));}
export async function hashBlob(blob){return sha256(await blob.arrayBuffer());}
export async function verifySession(input){
  const session=validateSession(input);
  for(const track of session.tracks){
    requireThat(await hashText(track.csvText)===track.sha256,
      `Track ${track.slot} CSV failed SHA-256 verification.`);
  }
  for(const clip of session.audioClips){
    requireThat(await hashBlob(clip.blob)===clip.sha256,
      `Track ${clip.slot} audio failed SHA-256 verification.`);
  }
  if(session.soundFonts) await verifySoundFontAssets(session.soundFonts);
  return session;
}
function openDB(){
  return new Promise((resolve,reject)=>{
    if(!globalThis.indexedDB) return reject(Error('IndexedDB is unavailable.'));
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);
    };
    request.onerror=()=>reject(request.error||Error('Cannot open browser session storage.'));
    request.onsuccess=()=>resolve(request.result);
  });
}
async function runTx(mode, callback){
  const db=await openDB();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode);
      let output;
      let request;
      try{request=callback(tx.objectStore(STORE));}
      catch(e){try{tx.abort();}catch{}reject(e);return;}
      request.onsuccess=()=>{output=request.result;};
      tx.oncomplete=()=>resolve(output);
      tx.onerror=()=>reject(tx.error||Error('Browser storage transaction failed.'));
      tx.onabort=()=>reject(tx.error||Error('Browser storage transaction was cancelled.'));
    });
  }finally{db.close();}
}
export async function getSavedSession(){return await runTx('readonly',s=>s.get(KEY))||null;}
export async function putSavedSession(input){
  const session=await verifySession(input);
  await runTx('readwrite',s=>s.put(session,KEY));
  return session;
}
export async function clearSavedSession(){await runTx('readwrite',s=>s.delete(KEY));}
