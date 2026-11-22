/* P061D — lossless, deduplicated, browser-native SF2 persistence.
 * No network, no autosave and no mutation of the Studio player.
 * Asset objects contain Blob bytes; IndexedDB stores these via structured clone.
 */
export const MAX_SF2_BYTES = 256 * 1024 * 1024;
export const MAX_TOTAL_SF2_BYTES = 512 * 1024 * 1024;
const fail=(ok,message)=>{if(!ok)throw Error(message);};
const hashPattern=/^[0-9a-f]{64}$/;
function validFilename(filename){
  fail(typeof filename==='string'&&filename.length>=5&&filename.length<=255&&
    !/[\\/\x00-\x1f]/.test(filename)&&filename.toLowerCase().endsWith('.sf2'),
    'Invalid SoundFont filename.');
  return filename;
}
function validHeader(bytes){
  fail(bytes.byteLength>=12&&bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&
    bytes[8]===115&&bytes[9]===102&&bytes[10]===98&&bytes[11]===107,
    'Invalid SF2 RIFF/sfbk header.');
}
function validPreset(bank,program){
  fail(Number.isInteger(bank)&&bank>=0&&bank<=16383&&
    Number.isInteger(program)&&program>=0&&program<=127,
    'Invalid SoundFont bank/program.');
}
export async function sha256SoundFont(blob){
  fail(typeof Blob!=='undefined'&&blob instanceof Blob,'SoundFont binary Blob is required.');
  fail(globalThis.crypto?.subtle,'SHA-256 requires a secure browser context.');
  const digest=await globalThis.crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
// Input records are trusted *only* as unvalidated candidates from the live player.
// Every populated track must have its actual SF2 loaded; don't claim to save it otherwise.
export async function captureSoundFontAssets(records,requiredSlots=[]){
  fail(Array.isArray(records)&&records.length<=6,'Invalid SoundFont capture list.');
  fail(Array.isArray(requiredSlots)&&requiredSlots.every(s=>Number.isInteger(s)&&s>=1&&s<=6)&&
    new Set(requiredSlots).size===requiredSlots.length,'Invalid required SoundFont slots.');
  const slots=new Set(),assets=new Map(),assignments=[];
  let totalBytes=0;
  for(const item of records){
    const slot=item?.slot;
    fail(Number.isInteger(slot)&&slot>=1&&slot<=6&&!slots.has(slot),'Duplicate/invalid SoundFont slot.');
    slots.add(slot);
    const filename=validFilename(item.filename);
    validPreset(item.bank,item.program);
    const raw=item.raw;
    fail(raw instanceof ArrayBuffer||raw instanceof Uint8Array,'SoundFont raw bytes are unavailable.');
    const bytes=raw instanceof ArrayBuffer?new Uint8Array(raw):raw;
    fail(bytes.byteLength<=MAX_SF2_BYTES,'SoundFont exceeds 256 MB limit.');
    validHeader(bytes);
    const blob=new Blob([bytes],{type:'application/octet-stream'});
    const sha256=await sha256SoundFont(blob);
    if(!assets.has(sha256)){
      totalBytes+=blob.size;
      fail(totalBytes<=MAX_TOTAL_SF2_BYTES,'SoundFonts exceed the 512 MB browser-session limit.');
      assets.set(sha256,{sha256,filename,blob});
    }
    assignments.push({slot,filename,sha256,bank:item.bank,program:item.program});
  }
  for(const slot of requiredSlots){
    fail(slots.has(slot),`Track ${slot} SoundFont is not fully loaded. Wait for it to load before saving.`);
  }
  return {assets:[...assets.values()],assignments:assignments.sort((a,b)=>a.slot-b.slot)};
}
export function validateSoundFontAssets(input,{requiredSlots=[]}={}){
  fail(input&&typeof input==='object'&&!Array.isArray(input)&&
    Array.isArray(input.assets)&&Array.isArray(input.assignments)&&
    input.assets.length<=6&&input.assignments.length<=6,
    'Invalid saved SoundFont assets.');
  const known=new Map();let totalBytes=0;
  const assets=input.assets.map(item=>{
    fail(item&&typeof item==='object'&&hashPattern.test(item.sha256??''),
      'Invalid saved SoundFont fingerprint.');
    const filename=validFilename(item.filename);
    fail(item.blob instanceof Blob&&item.blob.size>=12&&item.blob.size<=MAX_SF2_BYTES,
      'Saved SoundFont file is missing or oversized.');
    fail(!known.has(item.sha256),'Duplicate SoundFont asset fingerprint.');
    totalBytes+=item.blob.size;
    fail(totalBytes<=MAX_TOTAL_SF2_BYTES,'Saved SoundFonts exceed supported size.');
    const asset={sha256:item.sha256,filename,blob:item.blob};
    known.set(item.sha256,asset);
    return asset;
  });
  const slots=new Set();
  const assignments=input.assignments.map(item=>{
    fail(item&&Number.isInteger(item.slot)&&item.slot>=1&&item.slot<=6&&
      !slots.has(item.slot),'Invalid/duplicate saved SoundFont assignment.');
    slots.add(item.slot);
    fail(known.has(item.sha256),'Saved SoundFont asset for a track is missing.');
    const filename=validFilename(item.filename);
    validPreset(item.bank,item.program);
    return {slot:item.slot,filename,sha256:item.sha256,bank:item.bank,program:item.program};
  });
  fail(assets.length===new Set(assignments.map(x=>x.sha256)).size,
    'Saved SoundFont includes an unreferenced asset.');
  for(const slot of requiredSlots)fail(slots.has(slot),`Track ${slot} saved SoundFont is missing.`);
  return {assets,assignments:assignments.sort((a,b)=>a.slot-b.slot)};
}
export async function verifySoundFontAssets(input,options={}){
  const bundle=validateSoundFontAssets(input,options);
  for(const asset of bundle.assets){
    const bytes=new Uint8Array(await asset.blob.slice(0,12).arrayBuffer());
    validHeader(bytes);
    fail(await sha256SoundFont(asset.blob)===asset.sha256,
      `SoundFont integrity check failed: ${asset.filename}.`);
  }
  return bundle;
}
export async function soundFontAssignmentsWithBytes(verifiedBundle){
  const {assets,assignments}=await verifySoundFontAssets(verifiedBundle);
  const bytesBySha=new Map();
  for(const asset of assets)bytesBySha.set(asset.sha256,await asset.blob.arrayBuffer());
  return assignments.map(x=>({
    slot:x.slot,filename:x.filename,
    raw:bytesBySha.get(x.sha256),bank:x.bank,program:x.program
  }));
}
