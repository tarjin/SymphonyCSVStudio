/* P068-U4 — independently readable optional WAV companion ZIP.
 * Both archive halves are local. Music ZIP alone remains a complete song.
 * V1 uses classic STORE ZIP, capped at 512 MiB. No false claim of ZIP64.
 */
import {projectZipCrc32,PROJECT_ZIP_MAX_BYTES,readRestrictedZipEntries} from './SymphonyCSV_Project_ZIP_Reader_v01.mjs';
import {inspectWavBytes,validateWavOnset} from './SymphonyCSV_WAV_Core_v01.mjs';

export const AUDIO_COMPANION_JSON='SymphonyCSV_Project_Audio.json';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const requireTrue=(condition,message)=>{if(!condition)throw Error(message);};
const effects=['chorus','delay','reverb'];
const uuidPattern=/^[a-f0-9-]{36}$/i;
const canonical=slot=>`Track_${slot}.wav`;

export function writeAudioCompanionZip(audioTracks,{packageId,projectName,songDurationMs}={}){
  requireTrue(typeof packageId==='string'&&uuidPattern.test(packageId),
    'A unique matching package identifier is required.');
  requireTrue(typeof projectName==='string'&&projectName.length>0&&projectName.length<=200,
    'Invalid companion Project name.');
  requireTrue(Array.isArray(audioTracks)&&audioTracks.length>=1&&audioTracks.length<=2,
    'The companion must contain one or two WAV tracks.');
  const seen=new Set();
  const sorted=[...audioTracks].sort((a,b)=>a.slot-b.slot);
  const tracks=[];
  for(const item of sorted){
    requireTrue((item.slot===7||item.slot===8)&&!seen.has(item.slot),
      'Invalid or duplicate companion audio slot.');
    seen.add(item.slot);
    requireTrue(item.bytes instanceof Uint8Array,'Companion WAV source bytes are required.');
    inspectWavBytes(item.bytes);
    validateWavOnset(item.onset_ms,songDurationMs);
    requireTrue(typeof item.filename==='string'&&item.filename.length>4&&item.filename.length<=255&&
      /\.wav$/i.test(item.filename)&&!/[\\/\x00-\x1f]/.test(item.filename),
      'Invalid original WAV source filename.');
    requireTrue(Number.isSafeInteger(item.volume_percent)&&item.volume_percent>=0&&item.volume_percent<=100&&
      Number.isSafeInteger(item.pan_position)&&item.pan_position>=-100&&item.pan_position<=100&&
      typeof item.muted==='boolean','Invalid WAV mixer settings.');
    for(const key of effects){
      requireTrue(Number.isSafeInteger(item.sends?.[key])&&item.sends[key]>=0&&item.sends[key]<=100&&
        typeof item.sendMutes?.[key]==='boolean','Invalid WAV effects sends.');
    }
    tracks.push({slot:item.slot,source_file:canonical(item.slot),original_filename:item.filename,
      onset_ms:item.onset_ms,volume_percent:item.volume_percent,muted:item.muted,
      pan_position:item.pan_position,sends:{...item.sends},sendMutes:{...item.sendMutes}});
  }
  const metadata={schema_version:1,package_id:packageId,project_name:projectName,tracks};
  const files=[...sorted.map(x=>({name:canonical(x.slot),data:x.bytes})),
    {name:AUDIO_COMPANION_JSON,data:enc.encode(JSON.stringify(metadata,null,2)+'\n')}];
  let total=0,centralSize=0;
  const normalized=files.map(f=>{
    const name=enc.encode(f.name),data=f.data,crc=projectZipCrc32(data);
    const offset=total;
    total+=30+name.length+data.length;centralSize+=46+name.length;
    requireTrue(total+centralSize+22<=PROJECT_ZIP_MAX_BYTES&&data.length<=0xffffffff&&
      total<=0xffffffff,'Companion ZIP exceeds the current 512 MiB classic-ZIP limit.');
    return {name,data,crc,offset};
  });
  const bytes=new Uint8Array(total+centralSize+22),dv=new DataView(bytes.buffer);
  const u16=(p,v)=>dv.setUint16(p,v,true),u32=(p,v)=>dv.setUint32(p,v>>>0,true);
  for(const f of normalized){
    const p=f.offset;
    u32(p,0x04034b50);u16(p+4,20);u16(p+6,0x800);u16(p+8,0);
    u32(p+14,f.crc);u32(p+18,f.data.length);u32(p+22,f.data.length);
    u16(p+26,f.name.length);u16(p+28,0);bytes.set(f.name,p+30);
    bytes.set(f.data,p+30+f.name.length);
  }
  let at=total;
  for(const f of normalized){
    u32(at,0x02014b50);u16(at+4,20);u16(at+6,20);u16(at+8,0x800);u16(at+10,0);
    u32(at+16,f.crc);u32(at+20,f.data.length);u32(at+24,f.data.length);
    u16(at+28,f.name.length);u16(at+30,0);u16(at+32,0);
    u16(at+34,0);u16(at+36,0);u32(at+38,0);u32(at+42,f.offset);
    bytes.set(f.name,at+46);at+=46+f.name.length;
  }
  u32(at,0x06054b50);u16(at+4,0);u16(at+6,0);
  u16(at+8,normalized.length);u16(at+10,normalized.length);
  u32(at+12,centralSize);u32(at+16,total);u16(at+20,0);
  return {bytes,metadata};
}
export async function projectCompanionSha256(bytes){
  const crypto=globalThis.crypto;
  requireTrue(crypto?.subtle?.digest,'Secure browser SHA-256 is unavailable.');
  const buffer=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(buffer),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function readAudioCompanionZip(input,{expected,songDurationMs}={}){
  requireTrue(expected&&uuidPattern.test(expected.package_id)&&
    typeof expected.sha256==='string'&&/^[a-f0-9]{64}$/.test(expected.sha256)&&
    Array.isArray(expected.slots),'Music ZIP does not declare a valid companion.');
  const raw=input instanceof Uint8Array?input:
    (typeof Blob!=='undefined'&&input instanceof Blob?new Uint8Array(await input.arrayBuffer()):null);
  requireTrue(raw&&raw.byteLength<=PROJECT_ZIP_MAX_BYTES,'Companion ZIP is too large or invalid.');
  requireTrue(await projectCompanionSha256(raw)===expected.sha256,
    'Audio ZIP checksum does not match this saved Music Project.');
  const permitted=[AUDIO_COMPANION_JSON,...expected.slots.map(canonical)];
  const entries=await readRestrictedZipEntries(raw,{allowedNames:permitted,maxEntries:3});
  requireTrue(entries.size===permitted.length&&permitted.every(x=>entries.has(x)),
    'Audio ZIP is missing one or more declared track files.');
  let meta;
  try{meta=JSON.parse(dec.decode(entries.get(AUDIO_COMPANION_JSON)));}
  catch{throw Error('Audio ZIP settings are malformed.');}
  requireTrue(meta&&typeof meta==='object'&&!Array.isArray(meta)&&
    Object.keys(meta).sort().join(',')==='package_id,project_name,schema_version,tracks'&&
    meta.schema_version===1&&meta.package_id===expected.package_id&&
    typeof meta.project_name==='string'&&meta.project_name.length>0&&
    Array.isArray(meta.tracks)&&meta.tracks.length===expected.slots.length,
    'Audio ZIP pairing or settings are incompatible with this Music Project.');
  const audioSources=[],audioTracks=[];
  for(const slot of expected.slots){
    const t=meta.tracks.find(x=>x?.slot===slot);
    requireTrue(t&&t.source_file===canonical(slot),'Companion WAV slot or source mismatch.');
    requireTrue(Object.keys(t).sort().join(',')==='muted,onset_ms,original_filename,pan_position,sendMutes,sends,slot,source_file,volume_percent',
      'Unrecognized companion WAV settings.');
    requireTrue(typeof t.original_filename==='string'&&/\.wav$/i.test(t.original_filename)&&
      t.original_filename.length<=255&&!/[\\/\x00-\x1f]/.test(t.original_filename),
      'Invalid restored WAV filename.');
    validateWavOnset(t.onset_ms,songDurationMs);
    requireTrue(Number.isSafeInteger(t.volume_percent)&&t.volume_percent>=0&&t.volume_percent<=100&&
      Number.isSafeInteger(t.pan_position)&&t.pan_position>=-100&&t.pan_position<=100&&
      typeof t.muted==='boolean','Invalid restored WAV mixer settings.');
    for(const key of effects){
      requireTrue(Number.isSafeInteger(t.sends?.[key])&&t.sends[key]>=0&&t.sends[key]<=100&&
        typeof t.sendMutes?.[key]==='boolean','Invalid restored WAV effects sends.');
    }
    const bytes=entries.get(canonical(slot));inspectWavBytes(bytes);
    audioSources.push({slot,filename:canonical(slot),bytes});audioTracks.push(t);
  }
  const manifest={tracks:audioTracks.map(t=>({slot:t.slot,source_file:t.source_file,
    original_filename:t.original_filename,onset_ms:t.onset_ms,
    volume_percent:t.volume_percent,muted:t.muted,pan_position:t.pan_position})),
  playback:{audio_sends_percent:Object.fromEntries(effects.map(k=>[k,[7,8].map(slot=>
    audioTracks.find(t=>t.slot===slot)?.sends?.[k]??0)])),
    audio_send_mutes:Object.fromEntries(effects.map(k=>[k,[7,8].map(slot=>
      audioTracks.find(t=>t.slot===slot)?.sendMutes?.[k]??false)]))}};
  return {audioSources,manifest,metadata:meta};
}
