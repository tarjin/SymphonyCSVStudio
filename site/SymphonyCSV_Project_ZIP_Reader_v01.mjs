/* SymphonyCSV Studio — read-only project ZIP extraction (P004).
 * Browser-native ZIP structures + DecompressionStream; no npm dependency.
 * IMPORTANT: This routine does NOT validate CSV musical semantics or commit
 * anything to the live composition. That transactional stage is separate.
 *
 * LABS V1 reads authoritative CSVs for slots 1–6 only. The ZIP inventory and
 * manifest contracts already reserve slots 7–12 for the later audio release.
 */
import {inventoryProjectEntries} from './SymphonyCSV_Project_Inventory_v01.mjs';
import {inspectWavBytes,WAV_MAX_BYTES} from './SymphonyCSV_WAV_Core_v01.mjs';
import {readProjectManifest} from './SymphonyCSV_Project_Manifest_v01.mjs?v=mastergain02';
import {MAX_SF2_BYTES,MAX_TOTAL_SF2_BYTES,verifySoundFontAssets} from './SymphonyCSV_SoundFont_Assets_v01.mjs';

export const PROJECT_ZIP_MAX_BYTES = 512 * 1024 * 1024;
export const PROJECT_CSV_MAX_BYTES = 32 * 1024 * 1024;
const PROJECT_JSON_MAX_BYTES = 256 * 1024;
const PROJECT_ZIP_MAX_ENTRIES = 2048;
const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_CENTRAL = 0x06054b50;
const utf8 = new TextDecoder('utf-8', {fatal:true});
const ensure = (ok, message) => {if (!ok) throw Error(message);};

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i=0;i<256;i++) {
    let x=i;
    for (let j=0;j<8;j++) x=x&1 ? (0xedb88320^(x>>>1)) : (x>>>1);
    table[i]=x>>>0;
  }
  return table;
})();

export function projectZipCrc32(bytes) {
  ensure(bytes instanceof Uint8Array,'CRC input must be bytes.');
  let crc=0xffffffff;
  for (const byte of bytes) crc=crcTable[(crc^byte)&0xff]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}

function decodeFilename(raw, flags) {
  if (flags & 0x800) return utf8.decode(raw);
  // Unmarked ZIP filenames traditionally use CP437. Reserved project file
  // names are ASCII, so preserve those exactly; ignored non-ASCII filenames
  // need only a stable non-path-remapping representation.
  return Array.from(raw, b=>String.fromCharCode(b)).join('');
}

async function archiveBytes(input) {
  if (input instanceof Uint8Array) {
    ensure(input.byteLength<=PROJECT_ZIP_MAX_BYTES,'Project ZIP is too large.');
    return input;
  }
  if (input instanceof ArrayBuffer) {
    ensure(input.byteLength<=PROJECT_ZIP_MAX_BYTES,'Project ZIP is too large.');
    return new Uint8Array(input);
  }
  if (typeof Blob!=='undefined' && input instanceof Blob) {
    ensure(input.size<=PROJECT_ZIP_MAX_BYTES,'Project ZIP is too large.');
    return new Uint8Array(await input.arrayBuffer());
  }
  throw Error('Expected a project ZIP File, Blob, Uint8Array or ArrayBuffer.');
}

function parseCentralDirectory(bytes) {
  ensure(bytes.length>=22,'File is not a complete ZIP archive.');
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let eocd=-1;
  const first=Math.max(0,bytes.length-22-65535);
  for (let p=bytes.length-22;p>=first;p--) {
    if (dv.getUint32(p,true)===END_CENTRAL && p+22+dv.getUint16(p+20,true)===bytes.length) {
      eocd=p;break;
    }
  }
  ensure(eocd!==-1,'Project ZIP central directory is missing or truncated.');
  const disk=dv.getUint16(eocd+4,true);
  const centralDisk=dv.getUint16(eocd+6,true);
  const diskEntries=dv.getUint16(eocd+8,true);
  const count=dv.getUint16(eocd+10,true);
  const centralSize=dv.getUint32(eocd+12,true);
  const centralStart=dv.getUint32(eocd+16,true);
  ensure(disk===0&&centralDisk===0&&diskEntries===count,
    'Multi-volume ZIP archives are unsupported.');
  ensure(count>0&&count<=PROJECT_ZIP_MAX_ENTRIES,'Invalid project ZIP entry count.');
  ensure(count!==0xffff&&centralSize!==0xffffffff&&centralStart!==0xffffffff,
    'ZIP64 archives are not supported in LABS V1.');
  ensure(centralStart+centralSize===eocd,'Invalid project ZIP central directory bounds.');

  const entries=[];
  let at=centralStart;
  for (let i=0;i<count;i++) {
    ensure(at+46<=eocd&&dv.getUint32(at,true)===CENTRAL_HEADER,
      'Corrupted project ZIP central directory.');
    const flags=dv.getUint16(at+8,true);
    const method=dv.getUint16(at+10,true);
    const crc=dv.getUint32(at+16,true);
    const compressedSize=dv.getUint32(at+20,true);
    const uncompressedSize=dv.getUint32(at+24,true);
    const nameSize=dv.getUint16(at+28,true);
    const extraSize=dv.getUint16(at+30,true);
    const commentSize=dv.getUint16(at+32,true);
    const entryDisk=dv.getUint16(at+34,true);
    const localOffset=dv.getUint32(at+42,true);
    const end=at+46+nameSize+extraSize+commentSize;
    ensure(end<=eocd&&entryDisk===0&&localOffset!==0xffffffff&&
      compressedSize!==0xffffffff&&uncompressedSize!==0xffffffff,
      'Unsupported ZIP64, multi-volume or truncated ZIP entry.');
    const rawName=bytes.subarray(at+46,at+46+nameSize);
    let filename;
    try {filename=decodeFilename(rawName,flags);}
    catch {throw Error('Project ZIP contains an invalid UTF-8 filename.');}
    ensure(filename.length>0&&filename.length<=1024,'Invalid project ZIP filename.');
    ensure(localOffset+30<=centralStart&&dv.getUint32(localOffset,true)===LOCAL_HEADER,
      'Project ZIP has an invalid local file header.');
    const localFlags=dv.getUint16(localOffset+6,true);
    const localMethod=dv.getUint16(localOffset+8,true);
    const localNameSize=dv.getUint16(localOffset+26,true);
    const localExtraSize=dv.getUint16(localOffset+28,true);
    const dataStart=localOffset+30+localNameSize+localExtraSize;
    const dataEnd=dataStart+compressedSize;
    ensure(localFlags===flags&&localMethod===method&&localNameSize===nameSize&&
      dataEnd<=centralStart,'Conflicting project ZIP file headers.');
    for (let k=0;k<nameSize;k++) ensure(bytes[localOffset+30+k]===rawName[k],
      'Project ZIP filename differs between headers.');
    // If bit 3 is clear, ZIP requires CRC and sizes in both headers.
    if (!(flags&0x8)) {
      ensure(dv.getUint32(localOffset+14,true)===crc&&
        dv.getUint32(localOffset+18,true)===compressedSize&&
        dv.getUint32(localOffset+22,true)===uncompressedSize,
        'Conflicting project ZIP size or checksum headers.');
    }
    entries.push({filename,flags,method,crc,compressedSize,uncompressedSize,
      dataStart,dataEnd,localOffset});
    at=end;
  }
  ensure(at===eocd,'Invalid trailing central directory data.');
  const sorted=[...entries].sort((a,b)=>a.localOffset-b.localOffset);
  for(let i=1;i<sorted.length;i++) {
    ensure(sorted[i].localOffset>=sorted[i-1].dataEnd,
      'Overlapping ZIP file entries are unsupported.');
  }
  return entries;
}

async function extractEntry(zipBytes,entry,maxOutput) {
  ensure(!(entry.flags&0x41),'Encrypted ZIP entries are unsupported.');
  ensure(entry.method===0||entry.method===8,
    `Unsupported ZIP compression method for ${entry.filename}.`);
  ensure(entry.uncompressedSize<=maxOutput,
    `Project file is too large: ${entry.filename}.`);
  const compressed=zipBytes.subarray(entry.dataStart,entry.dataEnd);
  let result;
  if (entry.method===0) {
    ensure(entry.compressedSize===entry.uncompressedSize,
      `Invalid stored ZIP file size: ${entry.filename}.`);
    result=compressed.slice();
  } else {
    ensure(typeof DecompressionStream==='function',
      'This browser cannot decompress ZIP projects.');
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const reader=stream.getReader();
    const chunks=[];
    let total=0;
    try {
      while (true) {
        const {done,value}=await reader.read();
        if (done) break;
        total+=value.byteLength;
        ensure(total<=maxOutput&&total<=entry.uncompressedSize,
          `ZIP decompressed data exceeds its declared size: ${entry.filename}.`);
        chunks.push(value);
      }
    } catch (cause) {
      try {await reader.cancel();} catch {/* stream already ended */}
      throw Error(`Cannot decompress ${entry.filename}: ${cause.message||cause}`);
    } finally {reader.releaseLock();}
    result=new Uint8Array(total);
    let offset=0;
    for (const chunk of chunks) {result.set(chunk,offset);offset+=chunk.byteLength;}
  }
  ensure(result.byteLength===entry.uncompressedSize,
    `Incorrect ZIP decompressed length: ${entry.filename}.`);
  ensure(projectZipCrc32(result)===entry.crc,
    `ZIP checksum failed: ${entry.filename}.`);
  return result;
}

/**
 * Parse and verify an entire ZIP's structure, then extract authoritative
 * CSV bytes and an optional JSON manifest. No live Studio state changes.
 *
 * @returns {Promise<{inventory:object,manifest:object,usedDefaults:boolean,
 *    sources:{slot:number,filename:string,type:string,bytes:Uint8Array}[]}>}
 */
export async function readProjectZip(input,{defaultProjectName='Untitled Project'}={}) {
  const bytes=await archiveBytes(input);
  const entries=parseCentralDirectory(bytes);
  const inventory=inventoryProjectEntries(entries.map(e=>e.filename));
  ensure(inventory.sources.some(s=>s.slot<=6),'A Project must establish a song using musical Tracks 1–6.');
  ensure(inventory.sources.every(s=>s.slot<=8),'Only audio Tracks 7 and 8 are supported.');
  const byName=new Map(entries.map(entry=>[entry.filename,entry]));
  const sources=[],audioSources=[];
  for (const source of inventory.sources) {
    const entry=byName.get(source.filename);
    const payload=await extractEntry(bytes,entry,source.slot<=6?PROJECT_CSV_MAX_BYTES:WAV_MAX_BYTES);
    if(source.slot<=6){
      ensure(payload.byteLength>0,`Empty project CSV: ${source.filename}.`);
      sources.push({...source,bytes:payload});
    }else{
      const info=inspectWavBytes(payload);
      audioSources.push({...source,bytes:payload,info});
    }
  }
  let jsonText=null;
  if (inventory.manifestFile!==null) {
    const entry=byName.get(inventory.manifestFile);
    const payload=await extractEntry(bytes,entry,PROJECT_JSON_MAX_BYTES);
    try {jsonText=utf8.decode(payload).replace(/^\uFEFF/,'');}
    catch {throw Error('Project JSON must be valid UTF-8.');}
  }
  const {manifest,usedDefaults}=readProjectManifest(jsonText,inventory,defaultProjectName);
  const embedded=new Map();
  const assignments=[];
  for(const track of manifest.tracks){
    if(track.slot>6||track.soundfont===null)continue;
    const sf=track.soundfont;
    ensure(Boolean(sf.embedded_file),
      `Track ${track.slot} references a SoundFont without embedded bytes. Re-export from an updated Studio.`);
    assignments.push({slot:track.slot,filename:sf.filename,sha256:sf.sha256,
      bank:sf.preset?.bank??0,program:sf.preset?.program??0});
    if(!embedded.has(sf.sha256))embedded.set(sf.sha256,sf.embedded_file);
  }
  const fontEntries=entries.filter(e=>e.filename.startsWith('SoundFonts/'));
  ensure(fontEntries.length===embedded.size&&
    fontEntries.every(e=>[...embedded.values()].includes(e.filename)),
    'Project ZIP has missing, duplicate or unreferenced SoundFont assets.');
  const assets=[];
  let total=0;
  for(const [sha256,filename] of embedded){
    const entry=byName.get(filename);
    ensure(entry,'Project embedded SoundFont is missing: '+filename);
    total+=entry.uncompressedSize;
    ensure(total<=MAX_TOTAL_SF2_BYTES,'Project embedded SoundFonts exceed 512 MB.');
    const payload=await extractEntry(bytes,entry,MAX_SF2_BYTES);
    const named=assignments.find(x=>x.sha256===sha256);
    assets.push({sha256,filename:named.filename,
      blob:new Blob([payload],{type:'application/octet-stream'})});
  }
  const soundFonts=assignments.length?
    await verifySoundFontAssets({assets,assignments},
      {requiredSlots:assignments.map(x=>x.slot)}):null;
  return {inventory,manifest,usedDefaults,sources,audioSources,soundFonts};
}

/* Restricted, read-only extraction for a separately paired WAV companion.
 * These entries are not valid standalone musical Projects. The caller
 * supplies the exact canonical paths that are permitted in this archive.
 */
export async function readRestrictedZipEntries(input,{allowedNames,maxEntries=3}={}){
  ensure(Array.isArray(allowedNames)&&allowedNames.length>=1,'Companion ZIP allowed paths are required.');
  const bytes=await archiveBytes(input);
  const entries=parseCentralDirectory(bytes);
  ensure(entries.length>=2&&entries.length<=maxEntries,'Unexpected companion ZIP file count.');
  const allowed=new Set(allowedNames);
  ensure(entries.every(e=>allowed.has(e.filename))&&
    new Set(entries.map(e=>e.filename)).size===entries.length,'Unsupported or duplicate companion ZIP path.');
  const output=new Map();
  for(const entry of entries){
    const max=entry.filename.endsWith('.wav')?WAV_MAX_BYTES:PROJECT_JSON_MAX_BYTES;
    output.set(entry.filename,await extractEntry(bytes,entry,max));
  }
  return output;
}
